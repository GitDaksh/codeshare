"use client";

import { useMemo } from "react";
import { CodeBlock } from "@/components/games/quiz/CodeBlock";
import { OptionButton, optionState } from "@/components/games/quiz/OptionButton";
import { QuizFrame } from "@/components/games/quiz/QuizFrame";
import { ORACLE_ITEMS } from "@/lib/games/content/oracle";
import { pickItems } from "@/lib/games/logic/quiz";
import { rng, shuffled } from "@/lib/games/rng";
import type { GameProps } from "@/lib/games/types";

const TIMING = { questionMs: 20_000, revealMs: 5_000 };
const SOLO_TIMING = { questionMs: 20_000, revealMs: 3_800 };

// Four markers, each its own shape and color, so choices are easy to tell apart.
const MARKERS = [
  { color: "#f43f5e", shape: <svg viewBox="0 0 16 16" className="h-4 w-4"><path d="M8 2 L14.5 13.5 H1.5 Z" fill="currentColor" /></svg> },
  { color: "#3b82f6", shape: <svg viewBox="0 0 16 16" className="h-4 w-4"><path d="M8 1.5 L14.5 8 L8 14.5 L1.5 8 Z" fill="currentColor" /></svg> },
  { color: "#f59e0b", shape: <svg viewBox="0 0 16 16" className="h-4 w-4"><circle cx="8" cy="8" r="6" fill="currentColor" /></svg> },
  { color: "#10b981", shape: <svg viewBox="0 0 16 16" className="h-4 w-4"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" fill="currentColor" /></svg> },
];

const LANGUAGE_NAMES = { javascript: "JavaScript", python: "Python" };

export default function OutputOracle(props: GameProps) {
  const { match, mode } = props;
  const count = Number(match.settings.rounds) || 10;
  const language = String(match.settings.language ?? "mixed");
  const items = useMemo(
    () => pickItems(match.seed, ORACLE_ITEMS.filter((item) => language === "mixed" || item.language === language), count),
    [match.seed, language, count]
  );
  // Each question's choices in a shuffled order (the same for everyone).
  const orders = useMemo(() => items.map((_, i) => shuffled(rng(match.seed + i * 7919), [0, 1, 2, 3])), [items, match.seed]);

  return (
    <QuizFrame
      game={props}
      timing={mode === "online" ? TIMING : SOLO_TIMING}
      rounds={items.length}
      isCorrect={(round, choice) => items[round]?.answer === choice}
      prompt={() => "What does this print?"}
      explain={(round) => items[round]?.explain}
    >
      {(ctx) => {
        const item = items[ctx.round];
        const revealed = ctx.phase !== "question";
        return (
          <>
            <div className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900 shadow-card">
              <div className="flex items-center justify-between border-b border-ink-800 px-4 py-2">
                <span className="text-xs font-medium text-ink-500">main.{item.language === "python" ? "py" : "js"}</span>
                <span className="rounded-md border border-ink-800 bg-ink-950 px-1.5 py-0.5 text-[11px] font-medium text-ink-400">{LANGUAGE_NAMES[item.language]}</span>
              </div>
              <CodeBlock code={item.code} language={item.language} />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {orders[ctx.round].map((option, position) => (
                <OptionButton
                  key={option}
                  marker={MARKERS[position].shape}
                  color={MARKERS[position].color}
                  state={optionState(option, ctx.mine, item.answer, revealed)}
                  disabled={!ctx.open}
                  pickers={revealed ? ctx.picks.get(option) : undefined}
                  onClick={() => ctx.answer(option)}
                >
                  <span className="gs-code block whitespace-pre-wrap break-words font-[family-name:var(--font-mono)] text-sm text-ink-100">{item.options[option]}</span>
                </OptionButton>
              ))}
            </div>
          </>
        );
      }}
    </QuizFrame>
  );
}
