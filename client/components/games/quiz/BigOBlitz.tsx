"use client";

import { useMemo } from "react";
import { CodeBlock } from "@/components/games/quiz/CodeBlock";
import { OptionButton, optionState } from "@/components/games/quiz/OptionButton";
import { QuizFrame } from "@/components/games/quiz/QuizFrame";
import { BIG_O_CLASSES, BIG_O_ITEMS } from "@/lib/games/content/bigo";
import { pickItems } from "@/lib/games/logic/quiz";
import type { GameProps } from "@/lib/games/types";

const TIMING = { questionMs: 15_000, revealMs: 4_500 };
const SOLO_TIMING = { questionMs: 15_000, revealMs: 3_500 };

// Each class's growth curve, drawn small next to its name.
const CURVES: Record<string, string> = {
  "1": "M3 19 L37 19",
  "log n": "M3 21 C 9 9, 19 7, 37 6",
  n: "M3 21 L37 4",
  "n log n": "M3 21 C 15 18, 28 10, 37 2",
  "n²": "M3 21 C 22 20, 30 13, 33 2",
  "2ⁿ": "M3 21 C 26 21, 29 17, 31 2",
};
const COLORS = ["#10b981", "#22d3ee", "#3b82f6", "#a78bfa", "#f59e0b", "#f43f5e"];

export default function BigOBlitz(props: GameProps) {
  const { match, mode } = props;
  const count = Number(match.settings.rounds) || 10;
  const items = useMemo(() => pickItems(match.seed, BIG_O_ITEMS, count), [match.seed, count]);

  return (
    <QuizFrame
      game={props}
      timing={mode === "online" ? TIMING : SOLO_TIMING}
      rounds={items.length}
      isCorrect={(round, choice) => BIG_O_CLASSES[choice] === items[round]?.answer}
      prompt={() => "What's its time complexity?"}
      explain={(round) => (
        <>
          <span className="font-semibold text-ink-100">O({items[round]?.answer})</span> · {items[round]?.explain}
        </>
      )}
    >
      {(ctx) => {
        const item = items[ctx.round];
        const correct = BIG_O_CLASSES.indexOf(item.answer);
        const revealed = ctx.phase !== "question";
        return (
          <>
            <div className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900 shadow-card">
              <CodeBlock code={item.code} language={item.language} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BIG_O_CLASSES.map((name, choice) => (
                <OptionButton
                  key={name}
                  color={COLORS[choice]}
                  marker={
                    <svg viewBox="0 0 40 24" className="h-5 w-7" aria-hidden="true">
                      <path d={CURVES[name]} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  }
                  state={optionState(choice, ctx.mine, correct, revealed)}
                  disabled={!ctx.open}
                  pickers={revealed ? ctx.picks.get(choice) : undefined}
                  onClick={() => ctx.answer(choice)}
                >
                  <span className="font-[family-name:var(--font-mono)] text-[15px] font-semibold text-ink-100">O({name})</span>
                </OptionButton>
              ))}
            </div>
          </>
        );
      }}
    </QuizFrame>
  );
}
