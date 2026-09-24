"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Code2 } from "lucide-react";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { NavbarAvatar } from "@/components/NavbarAvatar";

export function Navbar() {
  const pathname = usePathname();
  const isOnboarding = pathname === "/onboarding";
  // Room pages have their own header with a back button. On phones the
  // global navbar is hidden there so the editor gets the full screen height.
  const isRoom = pathname.startsWith("/room/");

  return (
    <header
      className={`sticky top-0 z-30 border-b border-ink-800 bg-ink-950/80 backdrop-blur-md ${
        isRoom ? "hidden md:block" : ""
      }`}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5 font-[family-name:var(--font-display)] text-sm font-semibold tracking-tight text-ink-100"
        >
          <Code2 className="h-4 w-4 text-ink-400" />
          Code<span className="text-ink-400">Share</span>
        </Link>
        {!isOnboarding && (
          <nav className="flex min-w-0 items-center gap-3 text-sm text-ink-400 sm:gap-4">
            <Link href="/dashboard" className="shrink-0 transition-colors hover:text-ink-100">
              Dashboard
            </Link>
            <Show when="signed-out">
              <SignInButton>
                <button className="shrink-0 rounded-md border border-ink-700 px-3 py-1.5 text-ink-100 transition-colors hover:border-ink-500">
                  Sign in
                </button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
                <NavbarAvatar />
                <UserButton />
              </div>
            </Show>
          </nav>
        )}
      </div>
    </header>
  );
}