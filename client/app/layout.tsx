import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Navbar } from "@/components/Navbar";
import { ToastProvider } from "@/components/ToastProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: {
    default: "CodeShare",
    template: "%s — CodeShare",
  },
  description: "Real-time collaborative coding rooms",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} ${jetbrainsMono.variable} bg-neutral-950 text-neutral-100 antialiased`}
      >
        <ClerkProvider appearance={{ theme: dark }}>
          <ToastProvider>
            <Navbar />
            {children}
          </ToastProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}