import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { dark } from "@clerk/themes";
import { THEME_COLORS, THEME_SCRIPT } from "@/lib/themeScript";
import { SiteChrome } from "@/components/SiteChrome";
import { NavigationProgress } from "@/components/NavigationProgress";
import { MotionProvider } from "@/components/MotionProvider";
import { ShortcutsDialog } from "@/components/ShortcutsDialog";
import { ToastProvider } from "@/components/ToastProvider";
import "./globals.css";

// Geist for everything you read (headings use it too, via --font-display);
// JetBrains Mono for code.
const geist = Geist({ subsets: ["latin"], variable: "--font-display" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

const SITE_URL = "https://codeshare.tech";
const SITE_TITLE = "CodeShare — Code together in real time";
const SITE_DESCRIPTION =
  "Real-time collaborative coding rooms: a shared editor with live cursors, built-in chat, and code that runs right in the browser. Create a room, share the link, code together.";

export const metadata: Metadata = {
  // Makes generated image URLs (like the link preview) absolute on the real domain.
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s — CodeShare",
  },
  description: SITE_DESCRIPTION,
  applicationName: "CodeShare",
  // The preview image comes from app/opengraph-image.tsx and is added automatically.
  openGraph: {
    type: "website",
    siteName: "CodeShare",
    url: "/",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

// Matches the page background (--ink-950) so the phone browser's toolbar
// blends with the app. Dark is the default; the theme script updates it for
// the light theme.
export const viewport: Viewport = {
  themeColor: THEME_COLORS.dark,
  colorScheme: "dark light",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Whether you're signed in, so the right frame (sidebar or navbar) shows
  // from the very first paint.
  const { userId } = await auth();
  return (
    // The theme script may add the "light" class before React loads.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${geist.className} ${geist.variable} ${jetbrainsMono.variable} antialiased`}>
        <ClerkProvider
          appearance={{
            // Dark by default, matched to the app's ink scale (surface =
            // ink-900, text = ink-100). The light theme passes its own to the
            // sign-in, sign-up and account screens (lib/theme.ts).
            theme: dark,
            variables: {
              colorPrimary: "#f6f6f7",
              colorPrimaryForeground: "#131316",
              colorBackground: "#1b1b1f",
              colorForeground: "#f6f6f7",
              colorMutedForeground: "#a9a9b2",
              colorInput: "#131316",
              colorInputForeground: "#f6f6f7",
              colorBorder: "#36363d",
              borderRadius: "0.5rem",
              fontFamily: "var(--font-display)",
            },
          }}
        >
          <MotionProvider>
            <ToastProvider>
              {/* Hidden until a keyboard user presses Tab; jumps past the navbar */}
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[80] focus:rounded-lg focus:bg-ink-100 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink-950"
              >
                Skip to content
              </a>
              <NavigationProgress />
              <SiteChrome signedIn={!!userId}>{children}</SiteChrome>
              <ShortcutsDialog />
            </ToastProvider>
          </MotionProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}