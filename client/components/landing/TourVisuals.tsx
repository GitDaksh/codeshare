"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Check, Eye, Loader2, Play } from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
import { DEMO_AVATARS } from "@/components/landing/demoAvatars";

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98];

function cx(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

// Counts ticks while the visual is on screen. With reduced motion it holds a
// representative still frame instead.
function useTicker(length: number, ms: number, rest: number, loop = true) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduce || !inView) return;
    if (!loop && tick >= length - 1) return;
    const timer = setTimeout(() => setTick((t) => (t + 1 >= length ? 0 : t + 1)), ms);
    return () => clearTimeout(timer);
  }, [tick, inView, reduce, length, ms, loop]);

  return { ref, tick: reduce ? rest : tick };
}

// ---------- Shared pieces ----------

export function Window({
  title,
  badge,
  right,
  children,
}: {
  title: string;
  badge?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-ink-700/80 bg-ink-900/90 text-left shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_40px_120px_-30px_rgba(255,255,255,0.18)]">
      <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
          </div>
          <span className="truncate text-xs font-medium text-ink-300">{title}</span>
          {badge}
        </div>
        {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded border border-ink-700 px-1.5 py-0.5 text-[10px] text-ink-500">{children}</span>;
}

const KEYWORDS = new Set([
  "function",
  "const",
  "let",
  "return",
  "for",
  "of",
  "if",
  "else",
  "new",
  "while",
  "def",
  "in",
  "class",
  "true",
  "false",
  "null",
]);
const TOKEN = /(\/\/.*|#.*)|("[^"]*"|'[^']*')|(\b\d+\b)|([A-Za-z_$][\w$]*)|(\s+)|([^\sA-Za-z_$\d])/g;

// A tiny highlighter in the landing page's weight-based style. matchAll
// works on its own copy of the pattern, so the shared one is never modified.
function Code({ text }: { text: string }) {
  return (
    <>
      {Array.from(text.matchAll(TOKEN), (match, i) => {
        const [token, comment, string, number, word] = match;
        const cls = comment
          ? "italic text-ink-600"
          : string
            ? "text-ink-300"
            : number
              ? "text-ink-400"
              : word
                ? KEYWORDS.has(word)
                  ? "font-semibold text-ink-100"
                  : "text-ink-300"
                : "text-ink-500";
        return (
          <span key={i} className={cls}>
            {token}
          </span>
        );
      })}
    </>
  );
}

// A caret with a name flag, positioned by character column.
function Caret({ column, name, strong }: { column: number; name: string; strong?: boolean }) {
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute top-0 h-full"
      animate={{ left: `${column}ch` }}
      transition={{ duration: 0.12, ease: "easeOut" }}
    >
      <span className={cx("absolute inset-y-0 w-[2px] rounded-full", strong ? "bg-ink-100" : "bg-ink-400")} />
      <span
        className={cx(
          "absolute -top-4 left-0 whitespace-nowrap rounded-sm px-1 py-px font-sans text-[9px] font-semibold leading-3",
          strong ? "bg-ink-100 text-ink-950" : "bg-ink-500 text-ink-950",
        )}
      >
        {name}
      </span>
    </motion.span>
  );
}

// ---------- 1. Collaborate ----------

const PODIUM = [
  "// The top three players, best first",
  "function podium(players) {",
  "  const ranked = players.sort(byScore);",
  "  return ranked.slice(0, 3);",
  "}",
  "",
  "const byScore = (a, b) => b.score - a.score;",
];
// Maya wraps `players` (line 3, column 17) as `[...players]`; you append
// `.map(toCard)` on line 4 (column 27). Then ⌘Z undoes only your edit.
const YOURS = ".map(toCard)";
const T = {
  select: 5,
  open: 12,
  close: 20,
  you: 14,
  follow: 30,
  followEnd: 52,
  toast: 55,
  undo: 59,
  fade: 84,
  end: 90,
};
const COLLAB_CHAT = [
  { at: 3, who: "maya", text: "copying players so the sort doesn't change the original" },
  { at: 24, who: "you", text: "I'll map them to cards" },
  { at: 62, who: "you", text: "actually, cards can wait" },
];

export function CollabVisual() {
  const { ref, tick } = useTicker(T.end, 90, 50);

  const selection = tick >= T.select && tick < T.open ? Math.min(7, tick - T.select + 1) : 0;
  const open = Math.max(0, Math.min(4, tick - T.open + 1));
  const closed = tick >= T.close;
  const yours = tick >= T.undo ? 0 : Math.max(0, Math.min(YOURS.length, tick - T.you + 1));
  const following = tick >= T.follow && tick < T.followEnd;
  const toast = tick >= T.toast && tick < T.fade - 4;

  const lines = [...PODIUM];
  lines[2] = `  const ranked = ${"[...".slice(0, open)}players${closed ? "]" : ""}.sort(byScore);`;
  lines[3] = `  return ranked.slice(0, 3)${YOURS.slice(0, yours)};`;

  const mayaColumn = tick < T.open ? 17 + selection : tick < T.open + 5 ? 17 + open : tick < T.close ? 28 : 29;
  const yourColumn = 27 + yours;

  return (
    <div ref={ref} className="h-full">
      <Window
        title="podium.js"
        badge={<Pill>JavaScript</Pill>}
        right={
          <>
            <AnimatePresence>
              {following && (
                <motion.span
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-1.5 rounded-full border border-ink-600 bg-ink-800 px-2 py-0.5 text-[10px] font-medium text-ink-100"
                >
                  <Eye className="h-3 w-3" aria-hidden="true" />
                  <span className="hidden sm:inline">Following</span> maya
                </motion.span>
              )}
            </AnimatePresence>
            <div className="flex -space-x-1.5">
              <AvatarIcon avatarId={DEMO_AVATARS.maya} className="h-5 w-5 rounded-full ring-2 ring-ink-900" />
              <AvatarIcon avatarId={DEMO_AVATARS.leo} className="h-5 w-5 rounded-full ring-2 ring-ink-900" />
            </div>
          </>
        }
      >
        <div
          className={cx("flex h-full transition-opacity duration-300", tick >= T.fade ? "opacity-0" : "opacity-100")}
        >
          <div className="relative flex min-w-0 flex-1 flex-col">
            <div className="flex-1 py-5 pr-4 font-[family-name:var(--font-mono)] text-[11px] leading-7 sm:text-[13px]">
              {lines.map((text, i) => (
                <div key={i} className={cx("flex", (i === 2 || i === 3) && tick > 0 && "bg-white/[0.02]")}>
                  <span className="w-10 shrink-0 select-none pr-4 text-right text-ink-700">{i + 1}</span>
                  <span className="relative whitespace-pre">
                    {i === 2 && selection > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute top-1 h-5 rounded-sm bg-ink-100/20"
                        style={{ left: "17ch", width: `${selection}ch` }}
                      />
                    )}
                    <Code text={text} />
                    {i === 2 && tick > 1 && <Caret column={mayaColumn} name="maya" strong />}
                    {i === 3 && tick > 1 && <Caret column={yourColumn} name="you" />}
                  </span>
                </div>
              ))}
            </div>

            <AnimatePresence>
              {toast && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="absolute bottom-12 left-4 flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-800/95 px-3 py-2 text-[11px] text-ink-300 shadow-lg"
                >
                  <kbd className="rounded border border-ink-600 px-1.5 font-[family-name:var(--font-mono)] text-[10px] text-ink-100">
                    ⌘Z
                  </kbd>
                  Undid your edit. Maya&apos;s stays.
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between border-t border-ink-800 px-4 py-2 text-[10px] text-ink-500">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-100" />2 editing
              </span>
              <span>All changes synced</span>
            </div>
          </div>

          <div className="hidden w-48 shrink-0 flex-col border-l border-ink-800 sm:flex">
            <div className="border-b border-ink-800 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
              Chat
            </div>
            <div className="flex flex-1 flex-col justify-end gap-2.5 p-3">
              <AnimatePresence initial={false}>
                {COLLAB_CHAT.filter((m) => tick >= m.at).map((m) => (
                  <motion.div
                    key={m.at}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="flex gap-2"
                  >
                    <AvatarIcon
                      avatarId={m.who === "maya" ? DEMO_AVATARS.maya : DEMO_AVATARS.leo}
                      className="h-5 w-5 shrink-0 rounded-full"
                    />
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold text-ink-300">{m.who}</div>
                      <div className="text-[11px] leading-snug text-ink-400">{m.text}</div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </Window>
    </div>
  );
}

// ---------- 3. Practice ----------

const SOLUTION = [
  "def two_sum(nums, target):",
  "    seen = {}",
  "    for i, n in enumerate(nums):",
  "        if target - n in seen:",
  "            return [seen[target - n], i]",
  "        seen[n] = i",
];
const TESTS = ["Example 1", "Example 2", "Example 3", "Hidden 1", "Hidden 2"];
const P = { press: 6, first: 9, each: 4, loop: 72 };
const P_DONE = P.first + TESTS.length * P.each;

export function PracticeVisual() {
  const { ref, tick } = useTicker(P.loop, 100, P_DONE + 14);
  const status = (i: number) =>
    tick < P.first + i * P.each ? "idle" : tick < P.first + i * P.each + 2 ? "running" : "passed";
  const done = tick >= P_DONE;
  const solved = done ? 15 : 14;

  return (
    <div ref={ref} className="h-full">
      <Window
        title="Two Sum"
        badge={<Pill>Easy</Pill>}
        right={<span className="rounded border border-ink-700 px-1.5 py-0.5 text-[10px] text-ink-400">Python</span>}
      >
        <div className="grid h-full sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="hidden border-r border-ink-800 py-5 pr-3 font-[family-name:var(--font-mono)] text-[12px] leading-7 sm:block">
            {SOLUTION.map((text, i) => (
              <div key={i} className="flex">
                <span className="w-9 shrink-0 select-none pr-3 text-right text-ink-700">{i + 1}</span>
                <span className="whitespace-pre">
                  <Code text={text} />
                </span>
              </div>
            ))}
          </div>

          <div className="flex min-h-0 flex-col p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-300">Tests</span>
              <motion.span
                animate={{ scale: tick >= P.press && tick < P.press + 2 ? 0.92 : 1 }}
                className="flex items-center gap-1 rounded-md bg-ink-100 px-2 py-1 text-[10px] font-semibold text-ink-950"
              >
                {tick >= P.press && !done ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                Run tests
              </motion.span>
            </div>

            <ul className="mt-3 space-y-1.5">
              {TESTS.map((name, i) => {
                const s = status(i);
                return (
                  <li
                    key={name}
                    className={cx(
                      "flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors duration-300",
                      s === "passed" ? "border-ink-600 bg-ink-800/80 text-ink-100" : "border-ink-800 text-ink-500",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="flex h-4 w-4 items-center justify-center">
                        {s === "running" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-300" />
                        ) : s === "passed" ? (
                          <motion.span
                            initial={{ scale: 0.4, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="flex h-4 w-4 items-center justify-center rounded-full bg-ink-100 text-ink-950"
                          >
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </motion.span>
                        ) : (
                          <span className="h-3 w-3 rounded-full border border-ink-700" />
                        )}
                      </span>
                      {name}
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-[10px] text-ink-500">
                      {s === "passed" ? `${(0.3 + i * 0.1).toFixed(1)} ms` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>

            <AnimatePresence>
              {done && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="mt-auto flex items-center justify-between rounded-xl border border-ink-600 bg-ink-100 px-3 py-2.5 text-ink-950"
                >
                  <span className="text-xs font-semibold">All 5 tests passed · Solved</span>
                  <span className="font-[family-name:var(--font-mono)] text-[10px] font-semibold tabular-nums">
                    {solved} / 100
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Window>
    </div>
  );
}

// ---------- 4. Big-O meter ----------

const SLOW = [
  "function hasPairSum(nums, target) {",
  "  for (const a of nums)",
  "    for (const b of nums)",
  "      if (a + b === target) return true;",
  "  return false;",
  "}",
];
const FAST = [
  "function hasPairSum(nums, target) {",
  "  const seen = new Set();",
  "  for (const n of nums) {",
  "    if (seen.has(target - n)) return true;",
  "    seen.add(n);",
  "  }",
  "  return false;",
  "}",
];
const B = { swap: 24, fade: 62, loop: 68 };

// Growth curves for n² and n, drawn so n² overtakes n the way it really does
// (the line leads only for tiny inputs). They're two paths, the old one fading
// to a ghost while the new one draws in, rather than one morphing path.
function curve(growth: (x: number) => number) {
  const points = Array.from({ length: 13 }, (_, i) => {
    const x = i / 12;
    return [8 + x * 104, 62 - growth(x) * 52];
  });
  return `M ${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")}`;
}
const QUADRATIC = curve((x) => x * x);
const LINEAR = curve((x) => x / 3);

export function BigOVisual() {
  const { ref, tick } = useTicker(B.loop, 100, B.swap + 16);
  const fast = tick >= B.swap;
  const lines = fast ? FAST : SLOW;

  return (
    <div ref={ref} className="h-full">
      <Window title="pair-sum.js" badge={<Pill>JavaScript</Pill>}>
        <div
          className={cx(
            "flex h-full flex-col transition-opacity duration-300",
            tick >= B.fade ? "opacity-0" : "opacity-100",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-ink-800 px-4 py-3">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">Big-O meter</div>
              <motion.div layout className="mt-1.5 flex items-baseline gap-2">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={fast ? "fast" : "slow"}
                    initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
                    transition={{ duration: 0.45, ease: EASE }}
                    className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink-100"
                  >
                    {fast ? "O(n)" : "O(n²)"}
                  </motion.span>
                </AnimatePresence>
                <span className="text-xs text-ink-500">time</span>
                <span className="ml-2 rounded border border-ink-700 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-ink-400">
                  {fast ? "O(n) space" : "O(1) space"}
                </span>
              </motion.div>
              <p className="mt-1.5 text-[11px] text-ink-500">
                {fast ? "One pass, remembering what it has seen" : "Nested loops over nums"}
              </p>
            </div>
            <svg viewBox="0 0 120 70" className="h-16 w-28 shrink-0" aria-hidden="true">
              <path d="M 8 62 L 114 62 M 8 62 L 8 6" className="stroke-ink-700" strokeWidth="1" fill="none" />
              <motion.path
                d={QUADRATIC}
                initial={false}
                animate={{ opacity: fast ? 0.22 : 1 }}
                transition={{ duration: 0.6, ease: EASE }}
                className="stroke-ink-100"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
              <motion.path
                d={LINEAR}
                initial={false}
                animate={{ pathLength: fast ? 1 : 0, opacity: fast ? 1 : 0 }}
                transition={{ duration: 0.8, ease: EASE }}
                className="stroke-ink-100"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
              <text x="100" y="8" className="fill-ink-500 text-[8px]">
                n²
              </text>
              <motion.text
                x="113"
                y="42"
                initial={false}
                animate={{ opacity: fast ? 1 : 0 }}
                transition={{ duration: 0.4, delay: fast ? 0.5 : 0 }}
                className="fill-ink-100 text-[8px]"
              >
                n
              </motion.text>
            </svg>
          </div>

          <div className="flex-1 py-4 pr-4 font-[family-name:var(--font-mono)] text-[11px] leading-7 sm:text-[13px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={fast ? "fast" : "slow"} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
                {lines.map((text, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05, ease: EASE }}
                    className="flex"
                  >
                    <span className="w-10 shrink-0 select-none pr-4 text-right text-ink-700">{i + 1}</span>
                    <span className="whitespace-pre">
                      <Code text={text} />
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-ink-800 px-4 py-2.5 text-[11px]">
            <span className="text-ink-500">At n = 100,000</span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={fast ? "fast" : "slow"}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="font-[family-name:var(--font-mono)] text-ink-100"
              >
                {fast ? "≈ 100 thousand steps · instant" : "≈ 10 billion steps · too slow"}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </Window>
    </div>
  );
}

// ---------- 5. Progress ----------

// A made-up but plausible 16 weeks: busier lately, with a 7-day streak at the end.
const LEVELS = Array.from({ length: 16 * 7 }, (_, i) => {
  const week = Math.floor(i / 7);
  const noise = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  if (i >= 16 * 7 - 7) return 1 + Math.floor(noise * 4);
  const chance = 0.18 + week * 0.035;
  return noise < chance ? 1 + Math.floor((noise / chance) * 4) : 0;
});
const LEVEL_CLASS = ["bg-ink-800", "bg-ink-600", "bg-ink-500", "bg-ink-300", "bg-ink-100"];
const ACTIVE_DAYS = LEVELS.filter((level) => level > 0).length;
const RECENT = [
  { title: "Trapping Rain Water", difficulty: "Hard", when: "today" },
  { title: "Coin Change", difficulty: "Medium", when: "yesterday" },
  { title: "Valid Anagram", difficulty: "Easy", when: "2 days ago" },
];

export function ProgressVisual() {
  const { ref, tick } = useTicker(60, 60, 59, false);
  const lit = Math.round((Math.min(tick, 40) / 40) * LEVELS.length);
  const solved = Math.round(15 * Math.min(1, tick / 30));
  const activeSoFar = LEVELS.slice(0, lit).filter((level) => level > 0).length;
  const percent = (solved / 100) * 100;

  return (
    <div ref={ref} className="h-full">
      <Window title="Dashboard" right={<span className="text-[10px] text-ink-500">@you</span>}>
        <div className="flex h-full flex-col gap-4 p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-950/40 p-3">
              <div className="relative h-12 w-12 shrink-0">
                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden="true">
                  <circle cx="18" cy="18" r="15.915" fill="none" strokeWidth="3.5" className="stroke-ink-800" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="none"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    className="stroke-ink-100"
                    strokeDasharray={`${percent} ${100 - percent}`}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums text-ink-100">
                  {solved}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-ink-500">Solved</div>
                <div className="truncate text-xs font-medium text-ink-100">of 100</div>
              </div>
            </div>
            <div className="rounded-xl border border-ink-800 bg-ink-950/40 p-3">
              <div className="font-[family-name:var(--font-display)] text-xl font-semibold tabular-nums text-ink-100">
                {activeSoFar}
              </div>
              <div className="text-[10px] text-ink-500">Active days</div>
            </div>
            <div className="rounded-xl border border-ink-800 bg-ink-950/40 p-3">
              <div className="font-[family-name:var(--font-display)] text-xl font-semibold tabular-nums text-ink-100">
                {tick >= 40 ? 7 : Math.min(7, Math.max(0, lit - (LEVELS.length - 7)))} days
              </div>
              <div className="text-[10px] text-ink-500">Current streak</div>
            </div>
          </div>

          <div className="rounded-xl border border-ink-800 bg-ink-950/40 p-3">
            <div className="flex items-center justify-between text-[10px] text-ink-500">
              <span className="font-medium text-ink-300">Activity</span>
              <span>Last 16 weeks · {ACTIVE_DAYS} active days</span>
            </div>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div className="grid grid-flow-col grid-rows-[repeat(7,11px)] auto-cols-[11px] gap-[3px]">
                {LEVELS.map((level, i) => (
                  <span
                    key={i}
                    className={cx(
                      "rounded-[2px] transition-colors duration-500",
                      i < lit ? LEVEL_CLASS[level] : "bg-ink-800/60",
                      i === LEVELS.length - 1 && i < lit && "ring-1 ring-ink-300 ring-offset-1 ring-offset-ink-900",
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1 text-[9px] text-ink-500" aria-hidden="true">
                Less
                {LEVEL_CLASS.map((className) => (
                  <span key={className} className={cx("h-2 w-2 rounded-[2px]", className)} />
                ))}
                More
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 rounded-xl border border-ink-800 bg-ink-950/40 p-3">
            <div className="text-[10px] font-medium text-ink-300">Recent solves</div>
            <ul className="mt-2 space-y-1.5">
              {RECENT.map((solve, i) => (
                <motion.li
                  key={solve.title}
                  initial={false}
                  animate={{ opacity: tick >= 42 + i * 5 ? 1 : 0, x: tick >= 42 + i * 5 ? 0 : -6 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="flex items-center justify-between gap-3 text-[11px]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Check className="h-3 w-3 shrink-0 text-ink-300" strokeWidth={3} aria-hidden="true" />
                    <span className="truncate text-ink-100">{solve.title}</span>
                    <span className="shrink-0 text-ink-500">{solve.difficulty}</span>
                  </span>
                  <span className="shrink-0 text-ink-500">{solve.when}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </Window>
    </div>
  );
}