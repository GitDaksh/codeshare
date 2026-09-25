import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Navbar } from "@/components/Navbar";
import { NavigationProgress } from "@/components/NavigationProgress";
import { MotionProvider } from "@/components/MotionProvider";
import { ShortcutsDialog } from "@/components/ShortcutsDialog";
import { ToastProvider } from "@/components/ToastProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

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

// Matches --color-ink-950 so the phone browser's toolbar blends with the app.
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${jetbrainsMono.variable} ${spaceGrotesk.variable} antialiased`}>
        <ClerkProvider
          appearance={{
            theme: dark,
            // Matches Clerk's sign-in/up cards and the account settings modal
            // to the app's ink scale (surface = ink-900, input = ink-950).
            variables: {
              colorPrimary: "#f5f5f5",
              colorPrimaryForeground: "#0a0a0a",
              colorBackground: "#141414",
              colorForeground: "#f5f5f5",
              colorMutedForeground: "#a3a3a3",
              colorInput: "#0a0a0a",
              colorInputForeground: "#f5f5f5",
              borderRadius: "0.75rem",
            },
          }}
        >
          <MotionProvider>
            <ToastProvider>
              {/* Hidden until a keyboard user presses Tab; jumps past the navbar */}
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[80] focus:rounded-full focus:bg-ink-100 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink-950"
              >
                Skip to content
              </a>
              <NavigationProgress />
              <Navbar />
              {children}
              <ShortcutsDialog />
            </ToastProvider>
          </MotionProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}