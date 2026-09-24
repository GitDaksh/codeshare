import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Navbar } from "@/components/Navbar";
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

export const viewport: Viewport = {
  themeColor: "#000000",
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
            // to the app's monochrome design. Plain hex values are used for the
            // widest browser support (Clerk derives hover shades from these).
            variables: {
              colorPrimary: "#f5f5f5",
              colorPrimaryForeground: "#000000",
              colorBackground: "#0d0d0d",
              colorForeground: "#f5f5f5",
              colorMutedForeground: "#999999",
              colorInput: "#000000",
              colorInputForeground: "#f5f5f5",
              borderRadius: "0.75rem",
            },
          }}
        >
          <ToastProvider>
            <Navbar />
            {children}
          </ToastProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}