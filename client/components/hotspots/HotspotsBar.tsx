"use client";

import { useMemo, useRef, useState, type MouseEvent } from "react";
import { Flame, Loader2, RotateCw, X } from "lucide-react";
import { formatRuns, heatStep, type HotspotsResult } from "@/lib/hotspots";
import type { HotspotsState } from "@/lib/useHotspots";

function cx(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

function duration(ms: number): string {
  if (ms < 1) return "<1 ms";
  if (ms < 10) return `${ms.toFixed(1)} ms`;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

const ICON_BUTTON =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100 disabled:opacity-40";

// The whole run, start to finish, as a strip of color: each slice shows the
// line that was running then, in that line's heat. Loops show up as rhythm.
function Timeline({ result, onReveal }: { result: HotspotsResult; onReveal: (line: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; width: number; line: number; at: number } | null>(null);
  const slices = result.timeline;

  const background = useMemo(() => {
    if (!slices.length) return "transparent";
    const stops = slices.map((line, index) => {
      const count = result.counts.get(line) ?? 0;
      const color = count ? `var(--hs-${heatStep(count, result.hottest)})` : "transparent";
      const from = ((index / slices.length) * 100).toFixed(3);
      const to = (((index + 1) / slices.length) * 100).toFixed(3);
      return `${color} ${from}% ${to}%`;
    });
    return `linear-gradient(90deg, ${stops.join(", ")})`;
  }, [slices, result]);

  function track(event: MouseEvent<HTMLDivElement>) {
    const box = ref.current?.getBoundingClientRect();
    if (!box || !slices.length) return;
    const x = Math.min(Math.max(event.clientX - box.left, 0), box.width - 1);
    const index = Math.min(slices.length - 1, Math.floor((x / box.width) * slices.length));
    setHover({ x, width: box.width, line: slices[index], at: Math.round((index / slices.length) * 100) });
  }

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Timeline of the run: the line running at each moment, in its heat color"
      onMouseMove={track}
      onMouseLeave={() => setHover(null)}
      onClick={() => hover && hover.line > 0 && onReveal(hover.line)}
      className="relative h-6 min-w-0 flex-1 cursor-pointer rounded-md bg-ink-950 ring-1 ring-inset ring-ink-800"
    >
      <div className="hs-sweep absolute inset-[3px] rounded-[4px]" style={{ background }} />
      {hover && hover.line > 0 && (
        <>
          <div className="pointer-events-none absolute inset-y-0 w-px bg-ink-100" style={{ left: hover.x }} />
          <div
            className="pointer-events-none absolute bottom-full z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-[11px] text-ink-200 shadow-raised"
            style={{ left: Math.min(Math.max(hover.x, 60), hover.width - 60) }}
          >
            <span className="font-semibold text-ink-100">Line {hover.line}</span> · {hover.at}% into the run
          </div>
        </>
      )}
    </div>
  );
}

// The bar above the editor while Hotspots is showing: what ran and how much
// work it took, the run's timeline, its hottest lines, and the heat scale.
export function HotspotsBar({
  hotspots,
  onReveal,
}: {
  hotspots: HotspotsState;
  onReveal: (line: number) => void;
}) {
  const { result, running, error, stale } = hotspots;

  const hottest = useMemo(() => {
    if (!result) return [];
    return [...result.counts]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, 3)
      .map(([line, count]) => ({ line, count, share: result.total ? count / result.total : 0 }));
  }, [result]);

  const coverage = useMemo(() => {
    if (!result || !result.executable.length) return null;
    const ran = result.executable.filter((line) => (result.counts.get(line) ?? 0) > 0).length;
    return { ran, of: result.executable.length };
  }, [result]);

  const note = (() => {
    if (running) return null;
    if (stale) return { tone: "text-warning", text: "Your code changed since this run. Run it again to update the heat." };
    if (result?.error) {
      return {
        tone: "text-danger",
        text: `Stopped at an error${result.error.line ? ` on line ${result.error.line}` : ""}: ${result.error.message}`,
      };
    }
    if (result?.truncated) {
      return {
        tone: "text-warning",
        text: `Stopped after ${formatRuns(result.total)} line runs (the limit), so the heat shows the part that ran.`,
      };
    }
    if (result && result.total > 0 && result.hottest <= 1) {
      return { tone: "text-ink-400", text: "Every line ran once. Add a loop, or call your function, to see where the work goes." };
    }
    if (result && result.total === 0 && !result.error) {
      return { tone: "text-ink-400", text: "Nothing ran. Call your function at the bottom of the code to see its heat." };
    }
    return null;
  })();

  return (
    <div className="shrink-0 border-b border-ink-800 bg-ink-950/40 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white shadow-xs"
            style={{ background: "linear-gradient(135deg, var(--hs-2), var(--hs-6) 55%, var(--hs-9))" }}
          >
            <Flame className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight text-ink-100">Hotspots</p>
            <p className="truncate text-[11px] leading-tight text-ink-500">
              {running ? "Counting every line as your code runs…" : result?.input ?? "Your code, line by line, as it ran"}
            </p>
          </div>
        </div>

        {result && !running && (
          <div className="hidden items-center gap-3 text-[11px] text-ink-400 sm:flex">
            <span>
              <span className="font-semibold tabular-nums text-ink-100">{formatRuns(result.total)}</span> line runs
            </span>
            <span className="tabular-nums">{duration(result.durationMs)}</span>
            {coverage && (
              <span title="Lines that could have run, and how many did">
                <span className="font-semibold tabular-nums text-ink-100">{coverage.ran}</span> of {coverage.of} lines ran
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void hotspots.run()}
            disabled={running}
            aria-label="Run Hotspots again"
            title="Run again"
            className={cx(ICON_BUTTON, stale && "bg-ink-100 text-ink-950 hover:bg-ink-200 hover:text-ink-950")}
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={hotspots.close} aria-label="Close Hotspots" title="Close" className={ICON_BUTTON}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && !running ? (
        <p className="mt-2 text-xs text-danger">{error}</p>
      ) : (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          {running && !result ? (
            <div className="hs-shimmer h-6 min-w-0 flex-1 rounded-md opacity-60" />
          ) : result ? (
            <Timeline result={result} onReveal={onReveal} />
          ) : null}

          {result && hottest.length > 0 && (
            <div className="flex shrink-0 items-center gap-1.5">
              {hottest.map((item) => (
                <button
                  key={item.line}
                  type="button"
                  onClick={() => onReveal(item.line)}
                  title={`Line ${item.line} ran ${item.count.toLocaleString("en-US")} times`}
                  className="flex h-6 items-center gap-1.5 rounded-md border border-ink-800 bg-ink-900 px-2 text-[11px] text-ink-300 shadow-xs transition-colors hover:border-ink-600 hover:text-ink-100"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: `var(--hs-${heatStep(item.count, result.hottest)})`,
                      boxShadow: `0 0 6px var(--hs-${heatStep(item.count, result.hottest)})`,
                    }}
                  />
                  <span className="font-semibold text-ink-100">L{item.line}</span>
                  <span className="tabular-nums">{Math.round(item.share * 100)}%</span>
                </button>
              ))}
            </div>
          )}

          {result && result.hottest > 0 && (
            <div className="hidden shrink-0 items-center gap-1.5 text-[10px] tabular-nums text-ink-500 lg:flex" title="Heat scale">
              1×
              <span
                className="h-1.5 w-16 rounded-full"
                style={{ background: "linear-gradient(90deg, var(--hs-0), var(--hs-3), var(--hs-6), var(--hs-8), var(--hs-9))" }}
              />
              {formatRuns(result.hottest)}×
            </div>
          )}
        </div>
      )}

      {note && <p className={cx("mt-2 truncate text-[11px]", note.tone)} title={note.text}>{note.text}</p>}
    </div>
  );
}