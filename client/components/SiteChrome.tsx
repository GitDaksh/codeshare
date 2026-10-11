"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { AppShell } from "@/components/AppShell";
import { Navbar } from "@/components/Navbar";

// The signed-in app's sections; they get the sidebar.
const APP_ROUTES = ["/dashboard", "/practice", "/lens", "/interviews", "/games", "/profile"];

// Full-screen pages with their own header: rooms, and games being played.
function isFullScreen(pathname: string) {
  return pathname.startsWith("/room/") || pathname.startsWith("/games/play/") || /^\/games\/[^/]+\/solo$/.test(pathname);
}

// Picks the frame around each page: none for rooms and games in play
// (they're full-screen, with their own header), the app's sidebar for
// signed-in sections, and the top navbar everywhere else. The server says up front whether you're signed
// in, so the right frame shows from the first paint.
export function SiteChrome({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuth();
  const signed = isLoaded ? !!isSignedIn : signedIn;

  if (isFullScreen(pathname)) return <>{children}</>;
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