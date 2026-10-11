"use client";

import { useId, type ComponentType, type CSSProperties } from "react";
import { useMediaQuery } from "@/lib/useMediaQuery";
import type { GameDef } from "@/lib/games/registry";
import type { GameId } from "@/lib/games/types";
import "./games.css";

// Each game's little animated scene, for its card and its page. Drawn with
// SVG and CSS (no images), in the game's own colors.

const vars = (game: GameDef) => ({ "--g1": game.colors[0], "--g2": game.colors[1] }) as CSSProperties;
const cssVar = (name: string, value: string | number) => ({ [name]: value }) as CSSProperties;

const LANES = [
  { y: 42, color: "#60a5fa", d: "3.4s", delay: "-0.4s" },
  { y: 76, color: "#f472b6", d: "2.9s", delay: "-1.6s" },
  { y: 110, color: "#34d399", d: "3.8s", delay: "-2.4s" },
];

function CodeRacerArt() {
  return (
    <svg viewBox="0 0 320 150" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <text x="24" y="22" className="fill-ink-500 font-[family-name:var(--font-mono)]" fontSize="9" opacity="0.8">
        const wpm = chars / 5 / minutes;
      </text>
      {LANES.map((lane) => (
        <g key={lane.y}>
          <line x1="24" x2="292" y1={lane.y + 12} y2={lane.y + 12} stroke="currentColor" className="text-ink-700" strokeDasharray="4 6" />
          <g className="ga-racer" style={{ ...cssVar("--d", lane.d), ...cssVar("--delay", lane.delay), ...cssVar("--track", "236px") }}>
            <rect x="22" y={lane.y} width="34" height="16" rx="8" fill={lane.color} opacity="0.22" />
            <rect x="34" y={lane.y + 3} width="22" height="10" rx="5" fill={lane.color} />
            <circle cx="51" cy={lane.y + 8} r="2" fill="white" opacity="0.9" />
          </g>
        </g>
      ))}
      {/* The finish line */}
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={i % 2 === 0 ? 292 : 298} y={32 + i * 8} width="6" height="8" className={i % 2 ? "fill-ink-100" : "fill-ink-700"} opacity="0.85" />
      ))}
    </svg>
  );
}

const TILES = [
  { letter: "A", color: "#22c55e" },
  { letter: "S", color: "#eab308" },
  { letter: "Y", color: "#22c55e" },
  { letter: "N", color: "#52525b" },
  { letter: "C", color: "#22c55e" },
];

function KeywordArt() {
  return (
    <div className="ga-stage" style={{ perspective: 600 }}>
      <div className="flex gap-1.5 sm:gap-2">
        {TILES.map((tile, i) => (
          <div
            key={i}
            className="ga-tile relative grid h-11 w-11 place-items-center rounded-lg border-2 border-ink-700 bg-ink-900 text-xl font-bold text-ink-100 sm:h-12 sm:w-12"
            style={cssVar("--delay", `${i * 0.14}s`)}
          >
            {tile.letter}
            <span
              className="ga-tile-color absolute inset-[-2px] grid place-items-center rounded-lg text-white"
              style={{ background: tile.color, ...cssVar("--delay", `${i * 0.14}s`) }}
            >
              {tile.letter}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 42 = 00101010, then 200 = 11001000: each lamp knows when it's on.
const BITS = [128, 64, 32, 16, 8, 4, 2, 1].map((value, i) => ({
  value,
  a: (42 >> (7 - i)) & 1,
  b: (200 >> (7 - i)) & 1,
}));

function BitFlipArt() {
  return (
    <div className="ga-stage">
      <div className="flex flex-col items-center">
        <div className="relative h-8 text-2xl font-semibold tabular-nums text-ink-100">
          <span className="ga-bit absolute inset-0 text-center" style={{ ...cssVar("--from", 1), ...cssVar("--to", 0), ...cssVar("--d", "3.2s") }}>
            42
          </span>
          <span className="ga-bit block text-center" style={{ ...cssVar("--from", 0), ...cssVar("--to", 1), ...cssVar("--d", "3.2s") }}>
            200
          </span>
        </div>
        <div className="mt-3 flex gap-1.5">
          {BITS.map((bit) => (
            <div key={bit.value} className="flex flex-col items-center gap-1">
              <span className="relative block h-7 w-7 rounded-md border border-ink-700 bg-ink-900">
                <span
                  className="ga-bit absolute inset-0 rounded-md"
                  style={{
                    background: "linear-gradient(135deg, var(--g1), var(--g2))",
                    boxShadow: "0 0 14px var(--g1)",
                    ...cssVar("--from", bit.a),
                    ...cssVar("--to", bit.b),
                    ...cssVar("--d", "3.2s"),
                  }}
                />
              </span>
              <span className="text-[9px] tabular-nums text-ink-500">{bit.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OracleArt() {
  return (
    <div className="ga-stage">
      <div className="gs-code w-[250px] rounded-xl border border-ink-800 bg-ink-900/90 p-3 font-[family-name:var(--font-mono)] text-[11px] leading-5 shadow-card">
        <div>
          <span className="syn-keyword">const</span> <span className="syn-text">xs</span> <span className="syn-punct">=</span>{" "}
          <span className="syn-punct">[</span>
          <span className="syn-number">1</span>
          <span className="syn-punct">,</span> <span className="syn-number">2</span>
          <span className="syn-punct">,</span> <span className="syn-number">3</span>
          <span className="syn-punct">];</span>
        </div>
        <div>
          <span className="syn-text">console</span>
          <span className="syn-punct">.</span>
          <span className="syn-type">log</span>
          <span className="syn-punct">(</span>
          <span className="syn-text">xs</span>
          <span className="syn-punct">.</span>
          <span className="syn-type">map</span>
          <span className="syn-punct">(</span>
          <span className="syn-text">x</span> <span className="syn-punct">=&gt;</span> <span className="syn-text">x</span> <span className="syn-punct">*</span>{" "}
          <span className="syn-number">2</span>
          <span className="syn-punct">));</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 border-t border-ink-800 pt-2">
          <span style={{ color: "var(--g1)" }}>›</span>
          <span className="ga-reveal text-ink-100">[ 2, 4, 6 ]</span>
          <span className="ga-caret inline-block h-3 w-1.5" style={{ background: "var(--g1)" }} />
        </div>
      </div>
    </div>
  );
}

const CURVES = [
  { label: "1", d: "M30 112 L290 112", delay: "0s" },
  { label: "log n", d: "M30 112 C 80 70, 160 64, 290 58", delay: "0.25s" },
  { label: "n", d: "M30 112 L290 30", delay: "0.5s" },
  { label: "n²", d: "M30 112 C 150 108, 205 70, 238 14", delay: "0.75s" },
];

function BigOArt() {
  const gradient = `ga-bigo-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox="0 0 320 140" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--g1)" />
          <stop offset="1" stopColor="var(--g2)" />
        </linearGradient>
      </defs>
      <line x1="30" x2="30" y1="10" y2="114" className="stroke-ink-700" strokeWidth="1.5" />
      <line x1="28" x2="296" y1="114" y2="114" className="stroke-ink-700" strokeWidth="1.5" />
      {CURVES.map((curve, i) => (
        <g key={curve.label}>
          <path
            d={curve.d}
            pathLength={1}
            fill="none"
            stroke={`url(#${gradient})`}
            strokeWidth={i === 3 ? 3 : 2}
            strokeLinecap="round"
            opacity={0.45 + i * 0.18}
            className="ga-curve"
            style={cssVar("--delay", curve.delay)}
          />
        </g>
      ))}
      <text x="296" y="110" textAnchor="end" className="fill-ink-500" fontSize="9">O(1)</text>
      <text x="296" y="54" textAnchor="end" className="fill-ink-500" fontSize="9">O(log n)</text>
      <text x="282" y="26" textAnchor="end" className="fill-ink-500" fontSize="9">O(n)</text>
      <text x="244" y="12" textAnchor="start" className="fill-ink-400" fontSize="9">O(n²)</text>
    </svg>
  );
}

function BugHuntArt() {
  const widths = [150, 120, 176, 96, 140];
  return (
    <div className="ga-stage">
      <div className="relative w-[230px] rounded-xl border border-ink-800 bg-ink-900/90 p-3 shadow-card">
        {widths.map((width, i) => (
          <div key={i} className="relative flex h-[17px] items-center gap-2">
            <span className="w-3 text-right font-[family-name:var(--font-mono)] text-[9px] text-ink-600">{i + 1}</span>
            {i === 3 && <span className="ga-flash absolute inset-y-0 left-4 right-0 rounded" style={{ background: "color-mix(in srgb, var(--g1) 30%, transparent)" }} />}
            <span className="relative h-1.5 rounded-full bg-ink-700" style={{ width }} />
          </div>
        ))}
        <svg viewBox="0 0 20 20" className="ga-crawl absolute left-6 top-[18px] h-4 w-4" aria-hidden="true">
          <ellipse cx="10" cy="11" rx="5" ry="6.5" fill="var(--g1)" />
          <circle cx="10" cy="4.5" r="3" fill="var(--g2)" />
          <path d="M5 8 L1 6 M5 12 L1 12 M5 15 L1 18 M15 8 L19 6 M15 12 L19 12 M15 15 L19 18" stroke="var(--g2)" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

// A real game's moves (column, row, player), ending in a diagonal for the
// first player: (3,5) (4,4) (5,3) (6,2).
const DISCS = [
  { c: 3, r: 5, p: 0 },
  { c: 4, r: 5, p: 1 },
  { c: 4, r: 4, p: 0 },
  { c: 5, r: 5, p: 1 },
  { c: 2, r: 5, p: 0 },
  { c: 5, r: 4, p: 1 },
  { c: 5, r: 3, p: 0 },
  { c: 6, r: 5, p: 1 },
  { c: 6, r: 4, p: 0 },
  { c: 6, r: 3, p: 1 },
  { c: 6, r: 2, p: 0 },
];
const CYCLE_S = 6.4;
const STEP_S = 0.36;
// One loop for all the discs: disc i falls in at its moment, and they all
// fade out together at the end.
const DROP_CSS = DISCS.map((_, i) => {
  const at = ((i * STEP_S) / CYCLE_S) * 100;
  const pct = (n: number) => `${Math.min(n, 87).toFixed(2)}%`;
  return `@keyframes ga-drop-${i} {
  0%, ${pct(at)} { transform: translate3d(0, var(--from), 0); opacity: 0; }
  ${pct(at + 1)} { opacity: 1; }
  ${pct(at + 6)} { transform: translate3d(0, 0, 0); }
  ${pct(at + 7.5)} { transform: translate3d(0, -5px, 0); }
  ${pct(at + 9)}, 88% { transform: translate3d(0, 0, 0); opacity: 1; }
  96%, 100% { transform: translate3d(0, 0, 0); opacity: 0; }
}`;
}).join("\n");

function FourArt() {
  const size = 15;
  const gap = 4;
  const left = (c: number) => 8 + c * (size + gap);
  const top = (r: number) => 8 + r * (size + gap);
  return (
    <div className="ga-stage">
      <style>{DROP_CSS}</style>
      <div className="relative rounded-xl border border-ink-700 bg-ink-900 shadow-card" style={{ width: 7 * (size + gap) + 12, height: 6 * (size + gap) + 12 }}>
        {Array.from({ length: 42 }, (_, i) => (
          <span key={i} className="absolute rounded-full bg-ink-950" style={{ left: left(i % 7), top: top(Math.floor(i / 7)), width: size, height: size }} />
        ))}
        {DISCS.map((disc, i) => (
          <span
            key={i}
            className="ga-disc absolute rounded-full"
            style={{
              left: left(disc.c),
              top: top(disc.r),
              width: size,
              height: size,
              background: disc.p === 0 ? "#fb7185" : "#facc15",
              animationName: `ga-drop-${i}`,
              ...cssVar("--from", `${-top(disc.r) - 20}px`),
            }}
          />
        ))}
        {/* The winning diagonal */}
        <span
          className="ga-win absolute h-1 origin-left rounded-full bg-white/90"
          style={{ left: left(3) + size / 2, top: top(5) + size / 2, width: Math.hypot(3 * (size + gap), 3 * (size + gap)), transform: "rotate(-45deg)", boxShadow: "0 0 10px #fb7185" }}
        />
      </div>
    </div>
  );
}

const CARDS = [
  { front: "LIFO", flip: true, delay: "0s" },
  { front: "", flip: false },
  { front: "Stack", flip: true, delay: "0.35s" },
  { front: "", flip: false },
  { front: "", flip: false },
  { front: "O(1)", flip: false },
  { front: "", flip: false },
  { front: "", flip: false },
];

function PairsArt() {
  return (
    <div className="ga-stage" style={{ perspective: 700 }}>
      <div className="grid grid-cols-4 gap-1.5">
        {CARDS.map((card, i) => (
          <div key={i} className={`relative h-14 w-12 ${card.flip ? "ga-card" : ""}`} style={card.flip ? cssVar("--delay", card.delay ?? "0s") : undefined}>
            <div
              className="ga-card-face grid place-items-center rounded-lg border border-ink-700 font-[family-name:var(--font-mono)] text-[11px] font-semibold text-white/80"
              style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--g1) 55%, var(--ink-900)), color-mix(in srgb, var(--g2) 45%, var(--ink-900)))" }}
            >
              {"</>"}
            </div>
            <div
              className="ga-card-face ga-card-back grid place-items-center rounded-lg border-2 bg-ink-900 text-[11px] font-semibold text-ink-100"
              style={{ borderColor: "var(--g1)", boxShadow: "0 0 16px color-mix(in srgb, var(--g1) 50%, transparent)" }}
            >
              {card.front}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// A loop through the grid the snake follows forever.
const SNAKE_PATH = "M52 106 V34 H148 V82 H244 V34 H268 V106 Z";

function SnakeArt() {
  const still = useMediaQuery("(prefers-reduced-motion: reduce)");
  const segments = 7;
  return (
    <svg viewBox="0 0 320 140" className="h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {Array.from({ length: 11 }, (_, i) => (
        <line key={`v${i}`} x1={40 + i * 24} x2={40 + i * 24} y1="22" y2="118" className="stroke-ink-800" strokeWidth="1" />
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <line key={`h${i}`} x1="40" x2="280" y1={22 + i * 24} y2={22 + i * 24} className="stroke-ink-800" strokeWidth="1" />
      ))}
      <g className="ga-byte">
        <rect x="188" y="74" width="16" height="16" rx="4" fill="#facc15" opacity="0.92" />
        <text x="196" y="86" textAnchor="middle" fontSize="10" fontWeight="700" fill="#713f12">1</text>
      </g>
      {Array.from({ length: segments }, (_, i) =>
        still ? (
          <rect key={i} x={46 + i * 13} y={28} width="12" height="12" rx="3" fill="var(--g1)" opacity={1 - i * 0.1} />
        ) : (
          <rect key={i} x="-6" y="-6" width="12" height="12" rx="3" fill={i === 0 ? "var(--g1)" : "var(--g2)"} opacity={1 - i * 0.09}>
            <animateMotion dur="6s" repeatCount="indefinite" path={SNAKE_PATH} begin={`${-i * 0.12}s`} />
          </rect>
        )
      )}
    </svg>
  );
}

const ART: Record<GameId, ComponentType> = {
  "code-racer": CodeRacerArt,
  keyword: KeywordArt,
  "bit-flip": BitFlipArt,
  "output-oracle": OracleArt,
  "big-o-blitz": BigOArt,
  "bug-hunt": BugHuntArt,
  "four-in-a-row": FourArt,
  "pair-programming": PairsArt,
  "byte-snake": SnakeArt,
};

export function GameArt({ game, className = "" }: { game: GameDef; className?: string }) {
  const Art = ART[game.id];
  return (
    <div className={`ga ${className}`} style={vars(game)}>
      <div className="ga-stage">
        <Art />
      </div>
    </div>
  );
}
