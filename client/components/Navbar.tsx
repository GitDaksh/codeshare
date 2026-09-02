import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";

export function Navbar() {
  return (
    <header className="border-b border-neutral-800">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Code<span className="text-neutral-400">Share</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-neutral-400">
          <Link href="/dashboard" className="hover:text-neutral-100 transition-colors">
            Dashboard
          </Link>
          <Show when="signed-out">
            <SignInButton>
              <button className="rounded-md border border-neutral-700 px-3 py-1.5 text-neutral-100 transition-colors hover:border-neutral-500">
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