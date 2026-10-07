"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Gauge, Loader2, MemoryStick, RotateCw, Timer, X } from "lucide-react";
import type { Verdict } from "@/lib/complexity";
import type { ComplexityState } from "@/lib/useComplexity";

const FIT: Record<Verdict["confidence"], string> = {
  high: "Clear fit",
  medium: "Good fit",
  low: "Rough estimate",
};

// Rough estimates are marked "≈".
const shown = (verdict: Verdict) => (verdict.confidence === "low" ? `≈${verdict.label}` : verdict.label);

// A small growth chart: the measured points, and the fitted curve drawn
// smoothly across the whole range.
function Growth({ verdict, label }: { verdict: Verdict; label: string }) {
  const width = 132;
  const height = 52;
  const pad = 4;
  const minN = verdict.points[0].n;
  const maxN = verdict.points[verdict.points.length - 1].n;
  const smooth = Array.from({ length: 49 }, (_, i) => {
    const n = minN + ((maxN - minN) * i) / 48;
    return { n, y: verdict.at(n) };
  });
  const maxY = Math.max(...verdict.points.map((p) => p.y), ...smooth.map((p) => p.y), 1e-12);
  const x = (n: number) => pad + ((n - minN) / Math.max(maxN - minN, 1)) * (width - 2 * pad);
  const y = (v: number) => height - pad - (Math.max(v, 0) / maxY) * (height - 2 * pad);
  const curve = smooth.map((p, i) => `${i ? "L" : "M"}${x(p.n).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[52px] w-[132px] shrink-0" role="img" aria-label={label}>
      <path d={`M${pad},${pad} V${height - pad} H${width - pad}`} fill="none" className="stroke-ink-800" />
      <path
        d={curve}
        fill="none"
        className="stroke-ink-400"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {verdict.points.map((p) => (
        <circle key={p.n} cx={x(p.n)} cy={y(p.y)} r={1.9} className="fill-ink-100" />
      ))}
    </svg>
  );
}

function Row({
  icon,
  title,
  verdict,
  detail,
}: {
  icon: ReactNode;
  title: string;
  verdict: Verdict | null;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-500">
          {icon}
          {title}
        </p>
        <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-ink-100">
          {verdict ? shown(verdict) : "–"}
        </p>
        <p className="mt-0.5 text-[11px] text-ink-500">{verdict ? detail : "Couldn't be measured"}</p>
      </div>
      {verdict && <Growth verdict={verdict} label={`How ${title.toLowerCase()} grows`} />}
    </div>
  );
}

// The Big-O badge over the editor, and its card.
export function ComplexityMeter({ meter }: { meter: ComplexityState }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on a click anywhere else.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (!meter.supported) return null;
  const { result, measuring, stale } = meter;
  const ok = result?.status === "ok" ? result : null;
  const failure = result && result.status !== "ok" ? result : null;
  const dim = stale && !measuring ? "opacity-60" : "";

  const onPill = () => {
    if (!result && !measuring) {
      meter.start();
      setOpen(true);
      return;
    }
    setOpen((value) => !value);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") setOpen(false);
  };

  return (
    <div ref={rootRef} className="absolute bottom-9 right-4 z-10" onKeyDown={onKeyDown}>
      {open && (
        <div
          role="dialog"
          aria-label="Big-O complexity"
          className="absolute bottom-full right-0 mb-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-ink-800 bg-ink-900/95 p-4 shadow-raised backdrop-blur"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-ink-100">Complexity</p>
              <span className="rounded-md border border-ink-700 px-1.5 py-px text-[10px] text-ink-400">Measured</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="flex h-6 w-6 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-100"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {ok ? (
            <>
              <p className="mt-1 truncate font-mono text-[11px] text-ink-500" title={`${ok.label}, n = ${ok.n}`}>
                {ok.label} · n = {ok.n}
              </p>
              <div className={`mt-1 divide-y divide-ink-800 ${dim}`}>
                <Row
                  icon={<Timer className="h-3 w-3" aria-hidden="true" />}
                  title="Time"
                  verdict={ok.time}
                  detail={FIT[ok.time.confidence]}
                />
                <Row
                  icon={<MemoryStick className="h-3 w-3" aria-hidden="true" />}
                  title="Space"
                  verdict={ok.space}
                  detail={
                    ok.space
                      ? `${FIT[ok.space.confidence]} · ${ok.spaceFrom === "recursion" ? "from recursion depth" : "extra memory"}`
                      : ""
                  }
                />
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                Timed on random inputs with n from {ok.sizes[0].toLocaleString()} to {ok.sizes[1].toLocaleString()}. The
                worst case can be slower.
              </p>
              {ok.note && <p className="mt-2 text-[11px] leading-relaxed text-ink-400">{ok.note}</p>}
            </>
          ) : measuring ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-ink-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Running your code on bigger and bigger inputs…
            </p>
          ) : failure ? (
            <p
              className={`mt-3 text-xs leading-relaxed ${failure.status === "error" ? "text-danger" : "text-ink-300"}`}
            >
              {failure.message}
            </p>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-ink-300">
              Measure how your code&apos;s time and memory grow as its input grows.
            </p>
          )}

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-800 pt-3">
            <span className="text-[11px] text-ink-500">
              {measuring
                ? "Measuring…"
                : stale && result
                  ? "Your code changed."
                  : meter.live
                    ? "Updates as you type."
                    : ""}
            </span>
            <button
              type="button"
              onClick={meter.start}
              disabled={measuring}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900 px-2.5 text-xs font-medium text-ink-300 shadow-xs transition-colors hover:border-ink-600 hover:text-ink-100 disabled:cursor-wait disabled:opacity-50"
            >
              <RotateCw className={`h-3 w-3 ${measuring ? "animate-spin" : ""}`} aria-hidden="true" />
              Measure again
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onPill}
        aria-expanded={open}
        aria-label="Big-O complexity"
        title="Big-O: how your code's time and memory grow"
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-ink-700 bg-ink-900/90 px-2.5 font-mono text-[11px] text-ink-300 shadow-raised backdrop-blur transition-colors hover:border-ink-600 hover:text-ink-100"
      >
        {ok ? (
          <>
            <Timer className="h-3.5 w-3.5 text-ink-500" aria-hidden="true" />
            <span className={`text-ink-100 ${dim}`}>{shown(ok.time)}</span>
            <span className="text-ink-600" aria-hidden="true">
              ·
            </span>
            <MemoryStick className="h-3.5 w-3.5 text-ink-500" aria-hidden="true" />
            <span className={`text-ink-100 ${dim}`}>{ok.space ? shown(ok.space) : "–"}</span>
            {measuring && <Loader2 className="h-3 w-3 animate-spin text-ink-500" aria-hidden="true" />}
          </>
        ) : measuring ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Measuring…
          </>
        ) : failure ? (
          <>
            <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
            {failure.status === "too-slow" ? "Too slow" : "Big-O"}
            {failure.status === "error" && <span className="h-1.5 w-1.5 rounded-full bg-danger-strong" aria-hidden="true" />}
          </>
        ) : (
          <>
            <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
            Measure Big-O
          </>
        )}
      </button>
    </div>
  );
}