"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LiveDemoPreview } from "@/components/LiveDemoPreview";

const SMALL_FEATURES = [
  {
    title: "Built-in chat",
    description: "Talk through the problem without leaving the editor.",
  },
  {
    title: "Multi-language",
    description: "JavaScript, TypeScript, Python, C++, and Java, with real syntax highlighting.",
  },
  {
    title: "One link to share",
    description: "Send a room link — no downloads, no setup for the other side.",
  },
];

const STEPS = [
  { step: "01", title: "Create a room", description: "Name it, pick a language, and you're in." },
  { step: "02", title: "Share the link", description: "Send it to anyone — they join in one click." },
  { step: "03", title: "Code together", description: "Edit, chat, and see who's online, live." },
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-24 pt-20 lg:grid-cols-[1fr_1.1fr] lg:pt-28"
      >
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold leading-[1.1] tracking-tight text-ink-100 sm:text-5xl">
            Code together, in real time.
          </h1>
          <p className="mt-5 max-w-md text-ink-400">
            Create a room, share the link, and edit code with your team live —
            no setup, no friction.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="rounded-md bg-ink-100 px-5 py-2.5 text-center text-sm font-medium text-ink-950 transition-colors hover:bg-white"
            >
              Get started
            </Link>
            <Link
              href="/sign-in"
              className="rounded-md border border-ink-700 px-5 py-2.5 text-center text-sm font-medium text-ink-100 transition-colors hover:border-ink-500"
            >
              Sign in
            </Link>
          </div>
        </div>
        <LiveDemoPreview />
      </motion.section>

      {/* How it works */}
      <section className="border-t border-ink-800 px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-ink-100">
            How it works
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.step}>
                <span className="font-[family-name:var(--font-mono)] text-sm text-ink-600">
                  {s.step}
                </span>
                <h3 className="mt-2 font-medium text-ink-100">{s.title}</h3>
                <p className="mt-1 text-sm text-ink-400">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bento feature section */}
      <section className="border-t border-ink-800 px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="max-w-md font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-ink-100">
            Everything happens together
          </h2>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-ink-700 bg-ink-900 p-8">
              <div className="flex gap-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
                <span
                  className="h-2 w-2 animate-pulse rounded-full bg-amber-400"
                  style={{ animationDelay: "200ms" }}
                />
                <span
                  className="h-2 w-2 animate-pulse rounded-full bg-emerald-400"
                  style={{ animationDelay: "400ms" }}
                />
              </div>
              <h3 className="mt-6 text-lg font-medium text-ink-100">Real-time editing</h3>
              <p className="mt-2 text-sm text-ink-400">
                Every keystroke syncs instantly. No refresh, no merge conflicts, no waiting.
              </p>
            </div>
            <div className="rounded-2xl border border-ink-700 bg-ink-900 p-8">
              <div className="flex -space-x-2">
                <span className="h-7 w-7 rounded-full border-2 border-ink-900 bg-sky-400" />
                <span className="h-7 w-7 rounded-full border-2 border-ink-900 bg-amber-400" />
                <span className="h-7 w-7 rounded-full border-2 border-ink-900 bg-emerald-400" />
              </div>
              <h3 className="mt-6 text-lg font-medium text-ink-100">Live presence</h3>
              <p className="mt-2 text-sm text-ink-400">
                See exactly who's in the room and who's typing, at all times.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {SMALL_FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-ink-700 p-6">
                <h3 className="text-sm font-medium text-ink-100">{f.title}</h3>
                <p className="mt-1.5 text-sm text-ink-400">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-ink-800 px-4 py-24 text-center">
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink-100">
          Ready to start a room?
        </h2>
        <p className="mt-3 text-sm text-ink-400">
          Every room is authenticated, and access is verified on every request.
        </p>
        <Link
          href="/sign-up"
          className="mt-8 inline-block rounded-md bg-ink-100 px-6 py-2.5 text-sm font-medium text-ink-950 transition-colors hover:bg-white"
        >
          Get started free
        </Link>
      </section>
    </main>
  );
}