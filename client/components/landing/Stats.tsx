"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

const STATS = [
  { value: 100, label: "Practice problems", detail: "Easy to Hard, tested instantly" },
  { value: 40, label: "Lens concepts", detail: "Sorting, trees, graphs, DP" },
  { value: 3, label: "Languages", detail: "Python, JavaScript, TypeScript" },
  { value: 1, label: "Link to share", detail: "No installs, no setup" },
];

// Counts up once, the first time it scrolls into view. The number is a motion
// value, so counting never re-renders React.
function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();
  const value = useMotionValue(0);
  const text = useTransform(value, (v) => String(Math.round(v)));

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      value.set(to);
      return;
    }
    const controls = animate(value, to, { duration: 1.6, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [inView, reduce, to, value]);

  return <motion.span ref={ref}>{text}</motion.span>;
}

export function Stats() {
  return (
    <section aria-label="CodeShare in numbers" className="px-4 py-16 sm:py-20">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-y-10 sm:grid-cols-4">
        {STATS.map((stat, i) => (
          <div
            key={stat.label}
            className={`px-3 text-center sm:px-6 ${i > 0 ? "sm:border-l sm:border-ink-800" : ""} ${i % 2 === 1 ? "border-l border-ink-800 sm:border-l" : ""}`}
          >
            <div className="text-gradient font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl">
              <CountUp to={stat.value} />
            </div>
            <div className="mt-2 text-sm font-medium text-ink-100">{stat.label}</div>
            <div className="mt-1 text-xs text-ink-500">{stat.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}