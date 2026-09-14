import Link from "next/link";
import { Code2 } from "lucide-react";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";

export function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-1.5 font-[family-name:var(--font-display)] text-sm font-semibold tracking-tight text-ink-100"
        >
          <Code2 className="h-4 w-4 text-ink-400" />
          Code<span className="text-ink-400">Share</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-ink-400">
          <Link href="/dashboard" className="transition-colors hover:text-ink-100">
            Dashboard
          </Link>
          <Show when="signed-out">
            <SignInButton>
              <button className="rounded-md border border-ink-700 px-3 py-1.5 text-ink-100 transition-colors hover:border-ink-500">
                Sign in
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </nav>
      </div>
    </header>
  );
}