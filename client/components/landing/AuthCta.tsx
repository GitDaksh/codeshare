"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

// The page's big button: "Go to dashboard" when you're signed in, "Get
// started" when you're not. Until Clerk knows which, both buttons keep their
// size (the label is a quiet placeholder), so nothing jumps when it resolves.
export function AuthCta() {
  const { isLoaded, isSignedIn } = useAuth();
  const reduce = useReducedMotion();
  const state = !isLoaded ? "loading" : isSignedIn ? "in" : "out";

  return (
    <div className="flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
      <Link
        href={state === "in" ? "/dashboard" : "/sign-up"}
        aria-busy={state === "loading"}
        className="group relative inline-flex h-11 w-full items-center justify-center overflow-hidden rounded-lg bg-ink-100 px-5 text-[15px] font-medium text-ink-950 shadow-xs transition-[background-color,box-shadow,transform] duration-300 hover:bg-ink-200 hover:shadow-card active:scale-[0.98] sm:w-auto sm:min-w-[11.5rem]"
      >
        {/* A soft sheen that sweeps across on hover. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 -left-2/3 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/80 to-transparent opacity-0 transition-[transform,opacity] duration-700 ease-out group-hover:translate-x-[420%] group-hover:opacity-100"
        />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={state}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="relative inline-flex items-center gap-2"
          >
            {state === "loading" ? (
              <span className="h-2 w-24 animate-pulse rounded-full bg-ink-950/15" />
            ) : (
              <>
                {state === "in" ? "Go to dashboard" : "Get started"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </>
            )}
          </motion.span>
        </AnimatePresence>
      </Link>

      <Link
        href={state === "in" ? "/lens" : "/sign-in"}
        aria-hidden={state === "loading" ? true : undefined}
        tabIndex={state === "loading" ? -1 : undefined}
        className={`inline-flex h-11 w-full items-center justify-center rounded-lg border border-ink-700 bg-ink-950/50 px-5 text-[15px] font-medium text-ink-100 backdrop-blur transition-[border-color,opacity] duration-300 hover:border-ink-500 sm:w-auto sm:min-w-[8.5rem] ${
          state === "loading" ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        {state === "in" ? "Explore Lens" : "Sign in"}
      </Link>
    </div>
  );
}