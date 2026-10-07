"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { AppShell } from "@/components/AppShell";
import { Navbar } from "@/components/Navbar";

// The signed-in app's sections; they get the sidebar.
const APP_ROUTES = ["/dashboard", "/practice", "/lens", "/interviews", "/profile"];

// Picks the frame around each page: none for rooms (they're full-screen,
// with their own header), the app's sidebar for signed-in sections, and the
// top navbar everywhere else. The server says up front whether you're signed
// in, so the right frame shows from the first paint.
export function SiteChrome({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuth();
  const signed = isLoaded ? !!isSignedIn : signedIn;

  if (pathname.startsWith("/room/")) return <>{children}</>;
  if (signed && APP_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return <AppShell>{children}</AppShell>;
  }
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}