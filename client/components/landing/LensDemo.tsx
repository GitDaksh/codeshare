"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { LensMemory } from "@/components/lens/LensMemory";
import { diffSteps } from "@/lib/lens";
import { LENS_DEMOS, unpack } from "@/components/landing/lensDemos";

// Each demo's largest step, measured at natural size (plus a little room), so
// a demo keeps one steady scale while it plays instead of zooming around.
const NATURAL: Record<string, [number, number]> = {
  "binary-search": [744, 364],
  "linked-list": [826, 392],
  tree: [700, 474],
};
const STEP_MS: Record<string, number> = { "binary-search": 720, "linked-list": 430, tree: 330 };
const HOLD_MS = 1800;
// With reduced motion nothing plays; each demo opens on an interesting step.
const STILL_STEP: Record<string, number> = { "binary-search": 9, "linked-list": 30, tree: 80 };

function cx(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

// The real Lens renderer (the one in rooms and on the Lens page), playing
// recordings made with the real tracer. Loaded lazily by the tour.
export default function LensDemo() {
  const demos = useMemo(() => LENS_DEMOS.map((demo) => ({ demo, trace: unpack(demo) })), []);
  const reduce = useReducedMotion();
  const [demoIndex, setDemoIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(reduce ? STILL_STEP[LENS_DEMOS[0].id] : 0);
  const [playing, setPlaying] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "-10% 0px" });
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });

  const { demo, trace } = demos[demoIndex];
  const steps = trace.steps;
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const diff = useMemo(() => diffSteps(steps[stepIndex - 1], step), [steps, stepIndex, step]);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setArea({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Play while on screen: step through, hold on the last step, then move on
  // to the next recording.
  useEffect(() => {
    if (!playing || reduce || !inView) return;
    const last = stepIndex >= steps.length - 1;
    const timer = setTimeout(
      () => {
        if (!last) {
          setStepIndex(stepIndex + 1);
        } else {
          setDemoIndex((demoIndex + 1) % demos.length);
          setStepIndex(0);
        }
      },
      last ? HOLD_MS : STEP_MS[demo.id],
    );
    return () => clearTimeout(timer);
  }, [playing, reduce, inView, stepIndex, steps.length, demoIndex, demos.length, demo.id]);

  function choose(index: number) {
    setDemoIndex(index);
    setStepIndex(reduce ? STILL_STEP[demos[index].demo.id] : 0);
    setPlaying(!reduce);
  }

  const [naturalWidth, naturalHeight] = NATURAL[demo.id];
  const scale = area.width > 0 ? Math.min(1, area.width / naturalWidth, area.height / naturalHeight) : 0;

  // Three lines of code around the one running.
  const lines = demo.code.replace(/\n$/, "").split("\n");
  const current = Math.max(1, step.line ?? 1);
  const first = Math.min(Math.max(1, current - 1), Math.max(1, lines.length - 2));
  const excerpt = lines.slice(first - 1, first + 2).map((text, i) => ({ number: first + i, text }));

  return (
    <div ref={rootRef} className="flex h-full flex-col">
      {/* Programs */}
      <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-3 py-2">
        <div className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none]">
          {demos.map(({ demo: d }, i) => (
            <button
              key={d.id}
              type="button"
              onClick={() => choose(i)}
              aria-pressed={i === demoIndex}
              className={cx(
                "shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                i === demoIndex ? "bg-ink-800 text-ink-100" : "text-ink-500 hover:text-ink-200",
              )}
            >
              {d.title}
            </button>
          ))}
        </div>
        <span className="shrink-0 font-[family-name:var(--font-mono)] text-[10px] tabular-nums text-ink-500">
          Step {stepIndex + 1} / {steps.length}
        </span>
      </div>

      {/* The line that's running */}
      <div className="border-b border-ink-800 bg-black/30 py-1.5 font-[family-name:var(--font-mono)] text-[11px] leading-5">
        {excerpt.map(({ number, text }) => (
          <div
            key={number}
            className={cx(
              "flex gap-3 whitespace-pre px-3 transition-colors duration-200",
              number === current ? "bg-white/[0.07] text-ink-100" : "text-ink-500",
            )}
          >
            <span className="w-5 shrink-0 select-none text-right text-ink-600">{number}</span>
            <span className="truncate">{text || " "}</span>
          </div>
        ))}
      </div>

      {/* Memory, drawn by the real Lens renderer and scaled to fit */}
      <div ref={areaRef} className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={demo.id}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute"
            style={{
              width: naturalWidth,
              height: naturalHeight,
              left: Math.max(0, (area.width - naturalWidth * scale) / 2),
              top: Math.max(0, (area.height - naturalHeight * scale) / 2),
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              visibility: scale > 0 ? "visible" : "hidden",
            }}
          >
            <LensMemory step={step} stepIndex={stepIndex} diff={diff} code={demo.code} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Scrub it yourself */}
      <div className="flex items-center gap-3 border-t border-ink-800 px-3 py-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          disabled={!!reduce}
          aria-label={playing && !reduce ? "Pause" : "Play"}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink-100 text-ink-950 transition-colors hover:bg-white disabled:opacity-40"
        >
          {playing && !reduce ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        </button>
        <input
          type="range"
          min={0}
          max={steps.length - 1}
          value={stepIndex}
          onChange={(e) => {
            setPlaying(false);
            setStepIndex(Number(e.target.value));
          }}
          aria-label="Step"
          className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-ink-800 accent-ink-100"
        />
        <span className="hidden shrink-0 text-[10px] text-ink-500 sm:inline">Recorded with the real Lens engine</span>
      </div>
    </div>
  );
}