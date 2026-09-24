"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Reveal } from "@/components/landing/Reveal";

const STEPS = [
  { n: "01", title: "Create a room", body: "Name it and pick a language. It takes about five seconds." },
  { n: "02", title: "Share the link", body: "Anyone with the link can sign in and join, straight from their browser." },
  { n: "03", title: "Build together", body: "Edit, chat, and run code live, with everyone looking at the same thing." },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 60%"] });
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section className="px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal className="text-center">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em] text-ink-500">
            How it works
          </p>
          <h2 className="text-gradient mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-5xl">
            From zero to pairing in three steps.
          </h2>
        </Reveal>

        <div ref={ref} className="relative mt-14 grid gap-10 sm:mt-16 sm:grid-cols-3 sm:gap-8">
          {/* Connecting line that draws itself as you scroll (desktop) */}
          <div className="absolute left-5 right-5 top-5 hidden h-px bg-ink-800 sm:block" />
          <motion.div
            className="absolute left-5 right-5 top-5 hidden h-px origin-left bg-ink-100 sm:block"
            style={{ scaleX: reduce ? 1 : lineScale }}
          />

          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 0.12}>
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-ink-700 bg-ink-950 font-[family-name:var(--font-mono)] text-xs text-ink-300">
                {step.n}
              </div>
              <h3 className="mt-5 text-lg font-medium text-ink-100">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-400">{step.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}