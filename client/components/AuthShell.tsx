"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98];

// Shared backdrop for the sign-in and sign-up pages: the landing page's grid
// and glow, with the Clerk card easing in on top.
export function AuthShell({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();

  return (
    <div className="relative flex min-h-[calc(100dvh-56px)] items-center justify-center overflow-hidden px-4 py-10">
      <div className="hero-grid pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-1/2 top-[-12rem] h-[28rem] w-[48rem] max-w-[140vw] -translate-x-1/2 rounded-full bg-white/[0.06] blur-[120px]" />
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="relative"
      >
        {children}
      </motion.div>
    </div>
  );
}