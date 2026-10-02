"use client";

import { Lightbulb } from "lucide-react";
import { formatClock, type InterviewState } from "@/lib/interview";

// The hints given so far, shown with the question for everyone in the room.
export function GivenHints({ interview, hints }: { interview: InterviewState; hints: string[] }) {
  const times = interview.events.filter((event) => event.type === "hint").map((event) => event.at);
  const given = hints.slice(0, interview.hintsGiven);
  if (!given.length) return null;
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
        <Lightbulb className="h-3.5 w-3.5" />
        Hints from your interviewer
      </p>
      {given.map((hint, index) => (
        <div key={index} className="rounded-xl border border-ink-700 bg-ink-800/50 px-3 py-2.5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            Hint {index + 1} · {formatClock(times[index] ?? 0)}
          </p>
          <p className="text-sm leading-relaxed text-ink-200">{hint}</p>
        </div>
      ))}
    </div>
  );
}

// The interviewer's own question, in place of a Practice problem.
export function QuestionPanel({ interview, hints }: { interview: InterviewState; hints: string[] }) {
  if (!interview.custom) return null;
  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">Question</p>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink-100">{interview.custom.title}</h2>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-300">{interview.custom.prompt}</p>
      <GivenHints interview={interview} hints={hints} />
    </div>
  );
}