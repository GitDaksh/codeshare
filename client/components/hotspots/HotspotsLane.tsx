"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { formatRuns, heatOf, heatStep, type HotspotsResult } from "@/lib/hotspots";
import type { HotspotsEditor } from "@/components/hotspots/useEditorHeat";

// How much room the lane takes beside the code (the editor gives it up).
export const HOTSPOTS_LANE_WIDTH = 168;

// Where the line markers sit, and how many jumps get drawn and animated.
const X = 14;
const MAX_ARCS = 40;
const MAX_STREAMS = 14;

type Geometry = { centers: Map<number, number> };

type Arc = {
  key: string;
  d: string;
  color: string;
  width: number;
  opacity: number;
  label: string;
  stream: { duration: number; particles: number } | null;
};

// Every jump the run made between lines (back up into a loop, over a
// branch, into a function and out again) as an arc beside the code: busier
// jumps are thicker, brighter and hotter, and the busiest ones carry a
// stream of particles. Each line that ran gets a glowing marker.
export function HotspotsLane({
  getEditor,
  result,
  stale,
}: {
  getEditor: () => HotspotsEditor | null;
  result: HotspotsResult;
  stale: boolean;
}) {
  const reduce = useReducedMotion();
  const groupRef = useRef<SVGGElement>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);

  // Where each line sits in the editor, kept in step with its scrolling. The
  // scroll only moves one group (no re-render), so it stays smooth.
  useEffect(() => {
    const editor = getEditor();
    if (!editor) return;
    let frame = 0;
    const scroll = () => {
      groupRef.current?.setAttribute("transform", `translate(0 ${-editor.getScrollTop()})`);
    };
    const measure = () => {
      const model = editor.getModel();
      if (!model) return;
      const lines = Math.min(model.getLineCount(), result.lineCount);
      const tops: number[] = [];
      for (let line = 1; line <= lines + 1; line++) tops.push(editor.getTopForLineNumber(Math.min(line, model.getLineCount())));
      // A wrapped line is taller; its marker sits on its first row.
      let row = Infinity;
      for (let index = 0; index < lines; index++) {
        const height = tops[index + 1] - tops[index];
        if (height > 0) row = Math.min(row, height);
      }
      if (!Number.isFinite(row)) row = 20;
      const centers = new Map<number, number>();
      for (let line = 1; line <= lines; line++) centers.set(line, tops[line - 1] + row / 2);
      setGeometry({ centers });
      requestAnimationFrame(scroll);
    };
    frame = requestAnimationFrame(measure);
    const subscriptions = [
      editor.onDidScrollChange(scroll),
      editor.onDidLayoutChange(() => requestAnimationFrame(measure)),
      editor.onDidContentSizeChange(() => requestAnimationFrame(measure)),
    ];
    return () => {
      cancelAnimationFrame(frame);
      subscriptions.forEach((subscription) => subscription.dispose());
    };
  }, [getEditor, result]);

  const arcs = useMemo<Arc[]>(() => {
    if (!geometry) return [];
    const flows = result.flows
      .filter((flow) => geometry.centers.has(flow.from) && geometry.centers.has(flow.to))
      .slice(0, MAX_ARCS);
    const busiest = flows.reduce((max, flow) => Math.max(max, flow.count), 0);
    return flows
      .map((flow, rank) => {
        const y1 = geometry.centers.get(flow.from)!;
        const y2 = geometry.centers.get(flow.to)!;
        const t = heatOf(flow.count, busiest);
        const bend = Math.min(HOTSPOTS_LANE_WIDTH - X - 16, 20 + Math.abs(y2 - y1) * 0.5);
        const color = `var(--hs-${heatStep(flow.count, busiest)})`;
        return {
          key: `${flow.from}-${flow.to}`,
          d: `M ${X} ${y1} C ${X + bend} ${y1}, ${X + bend} ${y2}, ${X} ${y2}`,
          color,
          width: 1.1 + 2.6 * t,
          opacity: 0.35 + 0.55 * t,
          label: `Line ${flow.from} → line ${flow.to}: ${formatRuns(flow.count)}×`,
          stream: rank < MAX_STREAMS ? { duration: 3.4 - 2.2 * t, particles: t > 0.6 ? 3 : 2 } : null,
        };
      })
      .reverse();
  }, [geometry, result]);

  const markers = useMemo(() => {
    if (!geometry) return [];
    return [...result.counts]
      .filter(([line]) => geometry.centers.has(line))
      .map(([line, count]) => {
        const t = heatOf(count, result.hottest);
        return {
          line,
          y: geometry.centers.get(line)!,
          r: 1.8 + 2.4 * t,
          color: `var(--hs-${heatStep(count, result.hottest)})`,
          hottest: count === result.hottest && result.hottest > 1,
        };
      });
  }, [geometry, result]);

  const animate = !reduce && !stale;

  return (
    <div
      aria-hidden="true"
      data-hotspots-lane=""
      className="pointer-events-none absolute inset-y-0 right-0 hidden overflow-hidden border-l border-ink-800 md:block"
      style={{ width: HOTSPOTS_LANE_WIDTH }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-ink-950/50 to-transparent" />
      <svg className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${stale ? "opacity-30" : "opacity-100"}`}>
        <g ref={groupRef}>
          {arcs.map((arc) => (
            <g key={arc.key}>
              <path
                d={arc.d}
                fill="none"
                strokeLinecap="round"
                style={{ stroke: arc.color, strokeWidth: arc.width * 4, opacity: arc.opacity * 0.18, pointerEvents: "stroke" }}
              >
                <title>{arc.label}</title>
              </path>
              <path
                d={arc.d}
                fill="none"
                strokeLinecap="round"
                style={{ stroke: arc.color, strokeWidth: arc.width, opacity: arc.opacity }}
              />
              {animate &&
                arc.stream &&
                Array.from({ length: arc.stream.particles }, (_, index) => (
                  <circle key={index} r={1.6 + arc.width * 0.35} style={{ fill: arc.color }}>
                    <animateMotion
                      dur={`${arc.stream!.duration}s`}
                      begin={`-${((arc.stream!.duration / arc.stream!.particles) * index).toFixed(2)}s`}
                      repeatCount="indefinite"
                      path={arc.d}
                    />
                  </circle>
                ))}
            </g>
          ))}
          {markers.map((marker) => (
            <g key={marker.line}>
              {marker.hottest && animate && (
                <circle cx={X} cy={marker.y} r={marker.r} className="hs-pulse" style={{ fill: marker.color }} />
              )}
              <circle
                cx={X}
                cy={marker.y}
                r={marker.r}
                style={{ fill: marker.color, filter: `drop-shadow(0 0 3px ${marker.color})` }}
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}