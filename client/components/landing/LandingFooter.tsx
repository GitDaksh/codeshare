import Link from "next/link";
import { GithubIcon } from "@/components/GithubIcon";
import { LogoMark } from "@/components/LogoMark";

export function LandingFooter() {
  return (
    <footer className="border-t border-ink-900 px-4 pb-10 pt-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xs">
          <Link href="/" className="group flex items-center gap-2">
            <LogoMark className="h-7 w-7" />
            <span className="font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-tight text-ink-100">
              Code<span className="text-ink-400">Share</span>
            </span>
          </Link>
          <p className="mt-3 text-sm leading-relaxed text-ink-500">
            Real-time collaborative coding rooms. Built for pairing, interview prep, and learning together.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-ink-500">
          <Link href="/dashboard" className="transition-colors hover:text-ink-100">
            Dashboard
          </Link>
          <Link href="/sign-up" className="transition-colors hover:text-ink-100">
            Get started
          </Link>
          <Link href="/sign-in" className="transition-colors hover:text-ink-100">
            Sign in
          </Link>
          <a
            href="https://github.com/GitDaksh/codeshare"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:text-ink-100"
          >
            <GithubIcon className="h-3.5 w-3.5" />
            Source
          </a>
        </nav>
      </div>
      <div className="mx-auto mt-10 flex max-w-6xl flex-col gap-2 border-t border-ink-900 pt-6 text-xs text-ink-600 sm:flex-row sm:justify-between">
        <span>© {new Date().getFullYear()} CodeShare</span>
        <span>Built by Daksh.</span>
      </div>
    </footer>
  );
}