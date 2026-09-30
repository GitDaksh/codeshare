"use client";

import { useRef, type MouseEvent } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { ArrowRight } from "lucide-react";
import { AuthCta } from "@/components/landing/AuthCta";
import { HeroMockup } from "@/components/landing/HeroMockup";

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98];
const HEADLINE: string[][] = [
  ["Code", "together,"],
  ["in", "real", "time."],
];

export function Hero() {
  const reduce = useReducedMotion();

  // The mockup starts tilted back in 3D and straightens as it scrolls into view.
  const mockupRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: mockupRef,
    offset: ["start end", "center center"],
  });
  const rotateX = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 20, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [reduce ? 1 : 0.92, 1]);

  // Spotlight that follows the mouse. Motion values update the style
  // directly, with no React re-renders.
  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);
  const spotlight = useMotionTemplate`radial-gradient(640px circle at ${mouseX}px ${mouseY}px, rgba(255,255,255,0.06), transparent 65%)`;

  function handleMouseMove(e: MouseEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  }

  return (
    <section onMouseMove={handleMouseMove} className="relative overflow-hidden">
      <div className="hero-grid pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-1/2 top-[-16rem] h-[34rem] w-[58rem] max-w-[140vw] -translate-x-1/2 rounded-full bg-white/[0.07] blur-[140px]" />
      <motion.div className="pointer-events-none absolute inset-0" style={{ background: spotlight }} />

      <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-16 text-center sm:pt-24 lg:pt-32">
        <motion.a
          href="#tour"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="group inline-flex items-center gap-2 rounded-full border border-ink-800 bg-ink-900/60 py-1 pl-1 pr-3 text-xs text-ink-400 backdrop-blur transition-colors hover:border-ink-600 hover:text-ink-100"
        >
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-950">New</span>
          Lens: watch your code run, step by step
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </motion.a>

        <h1 className="mt-7 font-[family-name:var(--font-display)] text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-7xl lg:text-[5.75rem]">
          {HEADLINE.map((words, lineIndex) => (
            <span key={lineIndex} className="block">
              {words.map((word, i) => {
                const index = (lineIndex === 0 ? 0 : HEADLINE[0].length) + i;
                return (
                  <motion.span
                    key={word}
                    className="text-gradient inline-block pb-[0.1em]"
                    initial={reduce ? false : { opacity: 0, y: 24, filter: "blur(10px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.9, delay: 0.1 + index * 0.08, ease: EASE }}
                  >
                    {word}
                    {i < words.length - 1 ? "\u00a0" : ""}
                  </motion.span>
                );
              })}
            </span>
          ))}
        </h1>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
          className="mx-auto mt-6 max-w-xl text-base text-ink-400 sm:text-lg"
        >
          Pair in one shared room, watch your code run step by step, and practice 100 interview problems
          together, right in the browser.
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: EASE }}
          className="mt-9 flex justify-center"
        >
          <AuthCta />
        </motion.div>

        <motion.p
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.75 }}
          className="mt-5 text-xs text-ink-600"
        >
          Free · No install · Python, JavaScript and TypeScript
        </motion.p>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-20 sm:pb-28">
        <div className="pointer-events-none absolute inset-x-10 top-16 h-2/3 rounded-full bg-white/[0.05] blur-3xl" />
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8, ease: EASE }}
        >
          <motion.div ref={mockupRef} style={{ rotateX, scale, transformPerspective: 1400 }}>
            <HeroMockup />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}