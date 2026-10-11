"use client";

import { useMemo } from "react";
import { MousePointerClick } from "lucide-react";
import { CodeBlock, CodeLine, useCodeLines } from "@/components/games/quiz/CodeBlock";
import { Pickers, QuizFrame } from "@/components/games/quiz/QuizFrame";
import { BUG_ITEMS, type BugItem } from "@/lib/games/content/bugs";
import { pickItems } from "@/lib/games/logic/quiz";
import type { GameProps } from "@/lib/games/types";

const TIMING = { questionMs: 25_000, revealMs: 6_000 };
const SOLO_TIMING = { questionMs: 25_000, revealMs: 4_500 };

// The fixed line, highlighted, shown under the buggy one after the round.
function FixLine({ item }: { item: BugItem }) {
  const [tokens] = useCodeLines(item.fix, item.language);
  return (
    <div className="gs-rise flex bg-success-soft">
      <span className="w-9 shrink-0 select-none pr-3 text-right font-semibold text-success">+</span>
      <span className="min-w-0 whitespace-pre pr-4">
        <CodeLine tokens={tokens ?? []} />
      </span>
    </div>
  );
}

export default function BugHunt(props: GameProps) {
  const { match, mode } = props;
  const count = Number(match.settings.rounds) || 10;
  const items = useMemo(() => pickItems(match.seed, BUG_ITEMS, count), [match.seed, count]);

  return (
    <QuizFrame
      game={props}
      timing={mode === "online" ? TIMING : SOLO_TIMING}
      rounds={items.length}
      isCorrect={(round, choice) => items[round]?.bug === choice}
      prompt={(round) => items[round]?.goal}
      explain={(round) => (
        <>
          <span className="font-semibold text-ink-100">Line {(items[round]?.bug ?? 0) + 1}.</span> {items[round]?.explain}
        </>
      )}
    >
      {(ctx) => {
        const item = items[ctx.round];
        const revealed = ctx.phase !== "question";
        return (
          <>
            <p className="-mt-2 mb-3 flex items-center gap-1.5 text-sm text-ink-400">
              <MousePointerClick className="h-4 w-4" style={{ color: "var(--g1)" }} />
              Click the line with the bug.
            </p>
            <div className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900 shadow-card">
              <CodeBlock
                code={item.code}
                language={item.language}
                onLine={ctx.open ? (line) => ctx.answer(line) : undefined}
                lineClass={(line) => {
                  if (revealed && line === item.bug) return "bg-danger-soft line-through decoration-danger/70";
                  if (revealed && line === ctx.mine) return "bg-warning-soft";
                  if (line === ctx.mine) return "bg-ink-800 ring-1 ring-inset ring-ink-600";
                  return "";
                }}
                after={(line) =>
                  revealed && line === item.bug ? (
                    <>
                      <FixLine item={item} />
                      {ctx.picks.get(line)?.length ? (
                        <div className="flex justify-end px-3 py-1">
                          <Pickers players={ctx.picks.get(line)} />
                        </div>
                      ) : null}
                    </>
                  ) : null
                }
              />
            </div>
          </>
        );
      }}
    </QuizFrame>
  );
}
