"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pause, Pencil, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { LensMemory } from "@/components/lens/LensMemory";
import { describeStep, diffSteps, type LensTrace } from "@/lib/lens";

const SPEEDS = [0.5, 1, 2, 4];
const STEP_MS = 700;

function cx(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

// ---------- Code ----------

function LensCode({
  code,
  line,
  previousLine,
  error,
}: {
  code: string;
  line: number | null;
  previousLine: number | null;
  error: boolean;
}) {
  const lines = useMemo(() => code.replace(/\s+$/, "").split("\n"), [code]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // Keep the current line in view without scrolling the page itself.
  useEffect(() => {
    const box = scrollRef.current;
    const row = activeRef.current;
    if (!box || !row) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < box.scrollTop + 32) box.scrollTop = Math.max(0, top - 32);
    else if (bottom > box.scrollTop + box.clientHeight - 32) box.scrollTop = bottom - box.clientHeight + 32;
  }, [line]);

  return (
    <div ref={scrollRef} className="relative h-full overflow-auto py-3 font-mono text-[13px] leading-6">
      {lines.map((text, position) => {
        const number = position + 1;
        const current = number === line;
        const ran = !current && number === previousLine;
        return (
          <div
            key={number}
            ref={current ? activeRef : undefined}
            aria-current={current ? "step" : undefined}
            className={cx(
              "relative flex min-w-max pr-6 transition-colors duration-150",
              current && (error ? "bg-danger-soft" : "bg-ink-800"),
              ran && "bg-ink-900",
            )}
          >
            <span
              className={cx(
                "absolute inset-y-0 left-0 w-0.5",
                current ? (error ? "bg-danger-strong" : "bg-ink-100") : ran ? "bg-ink-600" : "bg-transparent",
              )}
            />
            <span
              className={cx("w-11 shrink-0 select-none pr-3 text-right", current ? "text-ink-300" : "text-ink-600")}
            >
              {number}
            </span>
            <span className="w-4 shrink-0 select-none text-ink-100">{current ? "›" : ""}</span>
            <span
              className={cx(
                "whitespace-pre",
                current ? (error ? "text-danger" : "text-ink-100") : ran ? "text-ink-300" : "text-ink-400",
              )}
            >
              {text || " "}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Player ----------

type LensPlayerProps = {
  code: string;
  trace: LensTrace;
  onEdit?: () => void;
  // Controlled mode (shared room sessions): the parent owns the current step.
  step?: number;
  onStepChange?: (step: number) => void;
  // Extra controls for the status bar.
  actions?: ReactNode;
  // Fill the parent's height instead of being a fixed-height card.
  fill?: boolean;
  autoFocus?: boolean;
};

export function LensPlayer({
  code,
  trace,
  onEdit,
  step: controlledStep,
  onStepChange,
  actions,
  fill = false,
  autoFocus = true,
}: LensPlayerProps) {
  const total = trace.steps.length;
  const [ownIndex, setOwnIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLPreElement>(null);

  const current = Math.max(0, Math.min(controlledStep ?? ownIndex, total - 1));
  const step = trace.steps[current];
  const previous = current > 0 ? trace.steps[current - 1] : undefined;
  const diff = useMemo(() => diffSteps(previous, step), [previous, step]);
  const status = describeStep(trace, current);
  const output = trace.stdout.slice(0, step.out);
  const atEnd = current >= total - 1;
  const isError = status.tone === "error" && (step.event === "exception" || atEnd);
  const isPlaying = playing && !atEnd;

  const changeStep = (next: number) => {
    const target = Math.max(0, Math.min(total - 1, next));
    if (controlledStep !== undefined) onStepChange?.(target);
    else setOwnIndex(target);
  };

  // The playback timer always calls the latest version.
  const changeStepRef = useRef(changeStep);
  useEffect(() => {
    changeStepRef.current = changeStep;
  });

  // Playback: one step per tick, stopping on the last step.
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setTimeout(() => {
      changeStepRef.current(current + 1);
      if (current + 1 >= total - 1) setPlaying(false);
    }, STEP_MS / speed);
    return () => window.clearTimeout(timer);
  }, [isPlaying, total, speed, current]);

  // Keyboard control works as soon as the player appears.
  useEffect(() => {
    if (autoFocus) rootRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  // Keep the newest output visible.
  useEffect(() => {
    const box = outputRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [output]);

  const goTo = (next: number) => {
    setPlaying(false);
    changeStep(next);
  };

  const togglePlay = () => {
    if (isPlaying) {
      setPlaying(false);
      return;
    }
    if (atEnd) changeStep(0);
    setPlaying(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    // The slider handles its own arrow keys; buttons handle Space themselves.
    if (target instanceof HTMLInputElement && target.type === "range" && event.key.startsWith("Arrow")) return;
    if (target instanceof HTMLButtonElement && (event.key === " " || event.key === "Enter")) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(current + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(current - 1);
    } else if (event.key === " ") {
      event.preventDefault();
      togglePlay();
    } else if (event.key === "Home") {
      event.preventDefault();
      goTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      goTo(total - 1);
    }
  };

  const iconButton =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100 disabled:pointer-events-none disabled:opacity-30";

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="Lens player. Use the arrow keys to step and Space to play."
      className={cx(
        "bg-ink-950 outline-none focus-visible:ring-2 focus-visible:ring-ink-500/60",
        fill ? "flex h-full flex-col focus-visible:ring-inset" : "overflow-hidden rounded-xl border border-ink-800",
      )}
    >
      {/* Status */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-800 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5" aria-live="polite">
          <span
            className={cx(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              status.tone === "error" ? "bg-danger-strong" : status.tone === "done" ? "bg-ink-400" : "bg-ink-100",
            )}
          />
          <span
            className={cx("truncate text-xs font-medium", status.tone === "error" ? "text-danger" : "text-ink-300")}
          >
            {status.text}
          </span>
        </div>
        {actions}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900 px-2.5 text-xs font-medium text-ink-300 shadow-xs transition-colors hover:border-ink-600 hover:text-ink-100"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit code
          </button>
        )}
      </div>

      {/* Code + output | memory */}
      <div
        className={cx(
          "grid lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]",
          fill ? "min-h-0 flex-1 overflow-y-auto lg:overflow-hidden" : "lg:h-[540px]",
        )}
      >
        <div className="flex min-h-0 flex-col border-b border-ink-800 lg:border-b-0 lg:border-r">
          <div className="max-h-72 min-h-0 flex-1 lg:max-h-none">
            <LensCode code={code} line={step.line} previousLine={previous?.line ?? null} error={isError} />
          </div>
          <div className="flex h-32 shrink-0 flex-col border-t border-ink-800">
            <div className="flex items-center justify-between px-4 pt-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-ink-500">Output</span>
              {trace.outputClipped && atEnd && <span className="text-[10px] text-ink-600">Output clipped</span>}
            </div>
            <pre
              ref={outputRef}
              className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-4 pb-2 pt-1 font-mono text-xs leading-5 text-ink-300"
            >
              {output || <span className="text-ink-600">Nothing printed yet</span>}
            </pre>
          </div>
        </div>
        <div className="h-[440px] min-h-0 lg:h-auto">
          <LensMemory step={step} stepIndex={current} diff={diff} />
        </div>
      </div>

      {/* Controls */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-ink-800 px-3 py-2.5">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className={iconButton}
            onClick={() => goTo(0)}
            disabled={current === 0}
            aria-label="First step"
          >
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={iconButton}
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
            aria-label="Previous step"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : atEnd ? "Replay" : "Play"}
            className="mx-1 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 text-ink-950 transition-transform hover:scale-105 active:scale-95"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : atEnd ? (
              <RotateCcw className="h-4 w-4" />
            ) : (
              <Play className="ml-0.5 h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            className={iconButton}
            onClick={() => goTo(current + 1)}
            disabled={atEnd}
            aria-label="Next step"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={iconButton}
            onClick={() => goTo(total - 1)}
            disabled={atEnd}
            aria-label="Last step"
          >
            <SkipForward className="h-4 w-4" />
          </button>
        </div>

        <input
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          value={current}
          onChange={(event) => goTo(Number(event.target.value))}
          aria-label="Step"
          className="h-1 min-w-[8rem] flex-1 cursor-pointer accent-ink-100"
        />

        <span className="w-[5.5rem] shrink-0 text-right font-mono text-[11px] tabular-nums text-ink-400">
          {current + 1} / {total}
        </span>

        <div
          className="flex shrink-0 items-center rounded-lg border border-ink-800 p-0.5"
          role="group"
          aria-label="Speed"
        >
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSpeed(value)}
              aria-pressed={speed === value}
              className={cx(
                "rounded-md px-2 py-0.5 font-mono text-[11px] transition-colors",
                speed === value ? "bg-ink-800 text-ink-100" : "text-ink-500 hover:text-ink-300",
              )}
            >
              {value}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}