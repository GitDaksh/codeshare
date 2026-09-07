"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Code2, Users, MessageSquare, Share2, Globe2, ShieldCheck } from "lucide-react";

const FEATURES = [
  {
    icon: Code2,
    title: "Real-time editing",
    description: "Every keystroke syncs instantly across everyone in the room.",
  },
  {
    icon: Users,
    title: "Live presence",
    description: "See exactly who's online in your room, in real time.",
  },
  {
    icon: MessageSquare,
    title: "Built-in chat",
    description: "Talk through the problem without leaving the editor.",
  },
  {
    icon: Globe2,
    title: "Multi-language",
    description: "JavaScript, TypeScript, Python, C++, and Java, with real syntax highlighting.",
  },
  {
    icon: Share2,
    title: "One link to share",
    description: "Send a room link — no downloads, no setup for the other side.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    description: "Authentication and room access are verified on every request.",
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
      <section className="mx-auto flex max-w-6xl flex-col items-center px-4 pb-20 pt-28 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          Code together,
          <br />
          in real time.
        </h1>
        <p className="mt-4 max-w-xl text-neutral-400">
          Create a room, share the link, and edit code with your team live —
          no setup, no friction.
        </p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/sign-up"
            className="w-full rounded-md bg-neutral-100 px-5 py-2.5 text-center text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-200 sm:w-auto"
          >
            Get started
          </Link>
          <Link
            href="/sign-in"
            className="w-full rounded-md border border-neutral-700 px-5 py-2.5 text-center text-sm font-medium transition-colors hover:border-neutral-500 sm:w-auto"
          >
            Sign in
          </Link>
        </div>

        {/* Decorative editor preview */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-16 w-full max-w-3xl overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 text-left shadow-2xl"
        >
          <div className="flex items-center gap-1.5 border-b border-neutral-800 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
            <span className="ml-3 text-xs text-neutral-500">interview-prep — twoSum.js</span>
          </div>
          <pre className="overflow-x-auto p-5 font-[family-name:var(--font-mono)] text-sm leading-6">
            <code>
              <span className="text-violet-400">function</span>{" "}
              <span className="text-sky-400">twoSum</span>
              <span className="text-neutral-300">(nums, target) {"{"}</span>
              {"\n  "}
              <span className="text-violet-400">const</span> seen ={" "}
              <span className="text-violet-400">new</span>{" "}
              <span className="text-sky-400">Map</span>();
              {"\n\n  "}
              <span className="text-violet-400">for</span> (
              <span className="text-violet-400">let</span> i = 0; i {"<"} nums.length; i++) {"{"}
              {"\n    "}
              <span className="text-violet-400">const</span> complement = target - nums[i];
              {"\n    "}
              <span className="text-violet-400">if</span> (seen.has(complement)) {"{"}
              {"\n      "}
              <span className="text-violet-400">return</span> [seen.get(complement), i];
              {"\n    "}
              {"}"}
              {"\n    "}
              seen.set(nums[i], i);
              {"\n  "}
              {"}"}
              {"\n\n  "}
              <span className="text-violet-400">return</span> [];
              {"\n"}
              {"}"}
            </code>
          </pre>
        </motion.div>
      </section>

      {/* How it works */}
      <section className="border-t border-neutral-900 px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold">How it works</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
              >
                <span className="font-[family-name:var(--font-mono)] text-sm text-neutral-600">
                  {s.step}
                </span>
                <h3 className="mt-2 font-medium">{s.title}</h3>
                <p className="mt-1 text-sm text-neutral-500">{s.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="border-t border-neutral-900 px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold">Everything you need to pair</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="rounded-lg border border-neutral-800 p-5 transition-colors hover:border-neutral-700"
              >
                <f.icon className="h-5 w-5 text-neutral-400" />
                <h3 className="mt-3 text-sm font-medium">{f.title}</h3>
                <p className="mt-1 text-sm text-neutral-500">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-neutral-900 px-4 py-20 text-center">
        <h2 className="text-2xl font-semibold">Ready to start a room?</h2>
        <p className="mt-2 text-sm text-neutral-500">
          It takes about ten seconds — no credit card, no install.
        </p>
        <Link
          href="/sign-up"
          className="mt-6 inline-block rounded-md bg-neutral-100 px-6 py-2.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-200"
        >
          Get started free
        </Link>
      </section>
    </main>
  );
}