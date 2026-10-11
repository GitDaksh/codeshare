"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/games/sound";

type Step = 3 | 2 | 1 | "go" | null;

function stepAt(t: number): Step {
  if (t < -2000) return 3;
  if (t < -1000) return 2;
  if (t < 0) return 1;
  if (t < 750) return "go";
  return null;
}

// 3, 2, 1, Go! over the game, timed by the match clock (so everyone in an
// online match sees the same count at the same moment).
export function Countdown({ now }: { now: () => number }) {
  const [step, setStep] = useState<Step>(() => stepAt(now()));
  const lastRef = useRef<Step>(null);

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const t = now();
      const next = stepAt(t);
      if (next !== lastRef.current) {
        lastRef.current = next;
        setStep(next);
        if (next === "go") sfx.go();
        else if (next !== null) sfx.tick();
      }
      if (t < 1000) frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [now]);

  if (step === null) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center" aria-live="assertive">
      <div className={`absolute inset-0 bg-ink-950/55 transition-opacity duration-500 ${step === "go" ? "opacity-0" : "opacity-100"}`} />
      <div key={String(step)} className="relative grid place-items-center">
        <span className="gs-ring absolute h-40 w-40 rounded-full border-2" style={{ borderColor: "var(--g1)" }} />
        <span
          className={`gs-count font-semibold tabular-nums tracking-tight ${step === "go" ? "gs-gradient-text text-7xl sm:text-8xl" : "text-8xl text-ink-100 sm:text-9xl"}`}
        >
          {step === "go" ? "Go!" : step}
        </span>
      </div>
    </div>
  );
}
