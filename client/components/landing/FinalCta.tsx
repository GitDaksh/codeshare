import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";

export function FinalCta() {
  return (
    <section className="px-4 pb-24 pt-4 sm:pb-32">
      <Reveal className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-ink-800 px-6 py-16 text-center sm:px-12 sm:py-24">
        <div className="hero-grid pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[42rem] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.09] blur-[100px]" />
        <div className="relative">
          <h2 className="text-gradient font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-5xl">
            Your next pairing session
            <br className="hidden sm:block" /> starts here.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-ink-400">
            Free, in the browser, and ready in about ten seconds.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink-100 px-6 py-3 text-sm font-semibold text-ink-950 shadow-[0_0_40px_-10px_rgba(255,255,255,0.6)] transition-all hover:bg-white hover:shadow-[0_0_60px_-6px_rgba(255,255,255,0.8)] sm:w-auto"
            >
              Start coding free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex w-full items-center justify-center rounded-full border border-ink-700 px-6 py-3 text-sm font-medium text-ink-100 transition-colors hover:border-ink-500 sm:w-auto"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}