import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Navbar } from "@/components/Navbar";
import { NavigationProgress } from "@/components/NavigationProgress";
import { ToastProvider } from "@/components/ToastProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: {
    default: "CodeShare",
    template: "%s — CodeShare",
  },
  description: "Real-time collaborative coding rooms",
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
          <ToastProvider>
            <NavigationProgress />
            <Navbar />
            {children}
          </ToastProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}