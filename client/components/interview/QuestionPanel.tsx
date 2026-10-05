"use client";

import { Lightbulb } from "lucide-react";
import { formatClock, type InterviewEvent, type InterviewQuestion } from "@/lib/interview";

// The hints given so far for one question, shown with it for everyone.
export function GivenHints({
  hints,
  given,
  events,
  question,
}: {
  hints: string[];
  given: number;
  events: InterviewEvent[];
  question: number;
}) {
  const times = events.filter((event) => event.type === "hint" && event.question === question).map((event) => event.at);
  const shown = hints.slice(0, given);
  if (!shown.length) return null;
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
        <Lightbulb className="h-3.5 w-3.5" />
        Hints from your interviewer
      </p>
      {shown.map((hint, index) => (
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

// An interviewer's own question, in place of a Practice problem.
export function QuestionPanel({
  question,
  total,
  events,
}: {
  question: InterviewQuestion;
  total: number;
  events: InterviewEvent[];
}) {
  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
          Question {question.index + 1} of {total}
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink-100">{question.title}</h2>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-300">{question.prompt}</p>
      <GivenHints hints={question.hints ?? []} given={question.hintsGiven} events={events} question={question.index} />
    </div>
  );
}