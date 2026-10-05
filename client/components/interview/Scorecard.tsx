"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import {
  INTERVIEW_CRITERIA,
  INTERVIEW_VERDICTS,
  RATING_LABELS,
  elapsedAt,
  formatClock,
  latestTests,
  summarizeIntegrity,
  type InterviewCriterion,
  type InterviewState,
  type InterviewVerdict,
} from "@/lib/interview";

export type ScorecardChoice = {
  ratings: Record<InterviewCriterion, number>;
  verdict: InterviewVerdict;
  feedback: string;
  shared?: boolean;
};

type ScorecardProps = {
  open: boolean;
  interview: InterviewState;
  // The organizer decides whether the candidate sees the report.
  canShare: boolean;
  initial?: Partial<ScorecardChoice>;
  onClose: () => void;
  onSave: (choice: ScorecardChoice) => Promise<void>;
};

function ScorecardCard({ interview, canShare, initial, onClose, onSave }: Omit<ScorecardProps, "open">) {
  const solo = interview.mode === "solo";
  const [ratings, setRatings] = useState<Partial<Record<InterviewCriterion, number>>>(initial?.ratings ?? {});
  const [verdict, setVerdict] = useState<InterviewVerdict | null>(initial?.verdict ?? null);
  const [feedback, setFeedback] = useState(initial?.feedback ?? "");
  const [shared, setShared] = useState(initial?.shared ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const used = elapsedAt(interview, Date.parse(interview.endedAt ?? interview.serverNow));
  const reached = interview.questions.filter((question) => question.status !== "pending").length;
  const hints = interview.questions.reduce((sum, question) => sum + question.hintsGiven, 0);
  const passing = interview.questions.filter((_, index) => {
    const run = latestTests(interview.events, index);
    return run && run.total > 0 && run.passed === run.total;
  }).length;
  const flags = summarizeIntegrity(interview.events).flags.length;
  const complete = INTERVIEW_CRITERIA.every((criterion) => ratings[criterion.id]) && !!verdict;

  async function save() {
    if (!complete || !verdict || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave({
        ratings: ratings as Record<InterviewCriterion, number>,
        verdict,
        feedback,
        ...(canShare || solo ? { shared: solo || shared } : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the scorecard.");
      setBusy(false);
    }
  }

  return (
    <motion.div
      role="dialog"
      aria-label={solo ? "Self-review" : "Scorecard"}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => e.stopPropagation()}
      className="flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-ink-700 bg-ink-900 shadow-2xl sm:max-w-lg sm:rounded-2xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-ink-800 px-5 pb-4 pt-5">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink-100">
            {solo ? "How did it go?" : `Your scorecard for ${interview.candidate?.name ?? "the candidate"}`}
          </h2>
          <p className="mt-0.5 text-xs text-ink-400">
            {solo
              ? "Rate yourself honestly. It's only for you."
              : interview.interviewers.length > 1
                ? "Each interviewer fills their own. Rate each area, then make your call."
                : "Rate each area, then make the call."}
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-ink-400 transition-colors hover:text-ink-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <div className="grid grid-cols-4 gap-2">
          {[
            ["Time", formatClock(used)],
            ["Questions", `${reached}/${interview.questions.length}`],
            ["Passing", `${passing}/${interview.questions.length}`],
            [solo ? "Hints" : "Flags", solo ? String(hints) : String(flags)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-ink-800 bg-ink-950/60 px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wider text-ink-500">{label}</p>
              <p className="truncate font-[family-name:var(--font-mono)] text-sm tabular-nums text-ink-100">{value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3.5">
          {INTERVIEW_CRITERIA.map((criterion) => (
            <div key={criterion.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-ink-100">{criterion.label}</p>
                <p className="truncate text-[11px] text-ink-500">{criterion.hint}</p>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {RATING_LABELS.map((label, index) => {
                  const value = index + 1;
                  const selected = ratings[criterion.id] === value;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setRatings((prev) => ({ ...prev, [criterion.id]: value }))}
                      className={`rounded-lg border py-1.5 text-[11px] font-medium transition-colors ${
                        selected
                          ? "border-ink-100 bg-ink-100 text-ink-950"
                          : "border-ink-800 text-ink-400 hover:border-ink-600 hover:text-ink-100"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-100">{solo ? "Would you have passed?" : "Your verdict"}</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {INTERVIEW_VERDICTS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setVerdict(option.id)}
                className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                  verdict === option.id
                    ? "border-ink-100 bg-ink-100 text-ink-950"
                    : "border-ink-800 text-ink-300 hover:border-ink-600 hover:text-ink-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-100">{solo ? "Notes to yourself" : "Feedback for the candidate"}</p>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value.slice(0, 4000))}
            rows={4}
            placeholder={solo ? "What to practice next…" : "What went well, and what to work on…"}
            className="w-full resize-none rounded-lg border border-ink-800 bg-ink-950/60 px-3 py-2 text-sm leading-relaxed text-ink-100 placeholder:text-ink-500 focus:border-ink-600 focus:outline-none"
          />
        </div>

        {canShare && !solo && (
          <label className="flex cursor-pointer items-start gap-2.5 text-xs text-ink-300">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-white"
            />
            <span>
              Let {interview.candidate?.name ?? "the candidate"} read the report
              <span className="block text-ink-500">
                They see every scorecard, the feedback and their code. Never your notes or the integrity details.
              </span>
            </span>
          </label>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-ink-800 px-5 py-4">
        <p className="min-w-0 flex-1 text-[11px] text-ink-500">{error ?? (complete ? "Ready to save." : "Rate every area and pick a verdict.")}</p>
        <button
          type="button"
          onClick={save}
          disabled={!complete || busy}
          className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-ink-100 px-5 text-sm font-semibold text-ink-950 transition-all hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save and see the report
        </button>
      </div>
    </motion.div>
  );
}

export function Scorecard({ open, ...props }: ScorecardProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[56] flex items-end justify-center bg-black/60 sm:items-center sm:px-4"
          onClick={props.onClose}
        >
          <ScorecardCard {...props} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}