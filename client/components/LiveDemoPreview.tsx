"use client";

import { useEffect, useMemo, useState } from "react";

type Author = "priya" | "arjun";

const SCRIPT: { author: Author; text: string }[] = [
  { author: "priya", text: "function twoSum(nums, target) {\n  const seen = new Map();\n\n" },
  {
    author: "arjun",
    text: "  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (seen.has(complement)) {\n      return [seen.get(complement), i];\n    }\n    seen.set(nums[i], i);\n  }\n\n  return [];\n}",
  },
];

const AUTHORS: Record<Author, { name: string; dot: string; text: string }> = {
  priya: { name: "Priya", dot: "bg-sky-400", text: "text-sky-400" },
  arjun: { name: "Arjun", dot: "bg-amber-400", text: "text-amber-400" },
};

const CHARS = SCRIPT.flatMap((segment) =>
  [...segment.text].map((char) => ({ char, author: segment.author }))
);

const TYPE_SPEED_MS = 20;
const PAUSE_MS = 2200;

export function LiveDemoPreview() {
  const [revealed, setRevealed] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    if (revealed >= CHARS.length) {
      const pause = setTimeout(() => setRevealed(0), PAUSE_MS);
      return () => clearTimeout(pause);
    }
    const tick = setTimeout(() => setRevealed((n) => n + 1), TYPE_SPEED_MS);
    return () => clearTimeout(tick);
  }, [revealed, reducedMotion]);

  const displayCount = reducedMotion ? CHARS.length : revealed;
  const currentAuthor = CHARS[Math.min(displayCount, CHARS.length - 1)]?.author ?? "priya";
  const visibleText = useMemo(
    () => CHARS.slice(0, displayCount).map((c) => c.char).join(""),
    [displayCount]
  );

  return (
    <div className="w-full overflow-hidden rounded-xl border border-ink-700 bg-ink-900 text-left shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between border-b border-ink-700 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-700" />
          <span className="ml-3 text-xs text-ink-400">interview-prep — twoSum.js</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-ink-400">
          <span className={`h-1.5 w-1.5 rounded-full ${AUTHORS[currentAuthor].dot}`} />
          <span className={AUTHORS[currentAuthor].text}>{AUTHORS[currentAuthor].name}</span>
          <span>is typing</span>
        </div>
      </div>
      <pre className="min-h-[280px] overflow-x-auto p-5 font-[family-name:var(--font-mono)] text-sm leading-6 text-ink-300">
        {visibleText}
        {!reducedMotion && (
          <span
            className={`inline-block h-4 w-[7px] translate-y-0.5 animate-pulse ${AUTHORS[currentAuthor].dot}`}
          />
        )}
      </pre>
    </div>
  );
}