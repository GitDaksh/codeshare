"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Lightbulb, PartyPopper, Plus, Square, X } from "lucide-react";
import {
  countdownAt,
  elapsedAt,
  formatClock,
  isCandidateIn,
  isInterviewerIn,
  questionTitle,
  remainingAt,
  useClock,
  type InterviewState,
} from "@/lib/interview";

type InterviewOverlaysProps = {
  interview: InterviewState;
  skew: number;
  me: string | null;
  // The current question's hint texts, in order.
  hints: string[];
  onControl: (action: "extend" | "end") => void;
};

const HINT_CARD_MS = 9000;
const QUESTION_CARD_MS = 2600;
const TIME_UP_MS = 12000;

// The moments everyone should notice: the 3-2-1 start, each new question, a
// new hint for the candidate, time running out, and the end.
export function InterviewOverlays({ interview, skew, me, hints, onControl }: InterviewOverlaysProps) {
  const now = useClock() + skew;
  const [dismissedHint, setDismissedHint] = useState<string | null>(null);
  const [dismissedEnd, setDismissedEnd] = useState<string | null>(null);

  const staff = isInterviewerIn(interview, me);
  const candidate = isCandidateIn(interview, me);
  const solo = interview.mode === "solo";
  const ended = interview.status === "ended";
  const running = interview.status === "running" || interview.status === "paused";
  const countdown = running ? countdownAt(interview, now) : 0;
  const sinceStart = interview.startedAt ? now - Date.parse(interview.startedAt) : -1;
  const elapsed = elapsedAt(interview, now);
  const remaining = remainingAt(interview, now);
  const question = interview.questions[interview.current];
  const total = interview.questions.length;

  // A new question, announced for everyone.
  const lastMove = [...interview.events].reverse().find((event) => event.type === "question");
  const showQuestion = running && !!lastMove && elapsed - lastMove.at < QUESTION_CARD_MS && lastMove.question === interview.current;

  // The newest hint for this question, for the candidate.
  const lastHint = [...interview.events].reverse().find((event) => event.type === "hint" && event.question === interview.current);
  const hintKey = lastHint ? `${interview.current}:${lastHint.data?.index}` : null;
  const hintIndex = Number(lastHint?.data?.index ?? 0);
  const showHint =
    !!lastHint &&
    candidate &&
    (!staff || solo) &&
    running &&
    hintKey !== dismissedHint &&
    elapsed - lastHint.at < HINT_CARD_MS &&
    !!hints[hintIndex - 1];

  const timeUp = interview.status === "running" && remaining <= 0 && -remaining < TIME_UP_MS;
  const showEnd = ended && dismissedEnd !== interview.id && !staff;

  return (
    <>
      {/* 3, 2, 1, go */}
      <AnimatePresence>
        {running && (countdown > 0 || (sinceStart >= 0 && sinceStart < 800)) && (
          <motion.div
            key="countdown"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            className="fixed inset-0 z-[60] grid place-items-center bg-ink-950/90 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
                {solo ? "Mock interview" : interview.title} starting
              </p>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={countdown > 0 ? Math.ceil(countdown / 1000) : "go"}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.6, opacity: 0 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="font-[family-name:var(--font-display)] text-[9rem] font-bold leading-none text-ink-100"
                >
                  {countdown > 0 ? Math.min(3, Math.ceil(countdown / 1000)) : "Go"}
                </motion.span>
              </AnimatePresence>
              <p className="max-w-sm text-sm text-ink-400">
                {countdown > 0
                  ? `${total} question${total === 1 ? "" : "s"} · ${formatClock(interview.durationMs)} on the clock. Think out loud.`
                  : question
                    ? questionTitle(question, interview.current)
                    : ""}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* A new question */}
      <AnimatePresence>
        {showQuestion && question && (
          <motion.div
            key={`question-${interview.current}-${lastMove?.at}`}
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
            className="pointer-events-none fixed inset-x-0 top-1/3 z-50 mx-auto w-fit rounded-xl border border-ink-700 bg-ink-900/95 px-8 py-5 text-center shadow-raised backdrop-blur"
            role="status"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-ink-400">
              Question {interview.current + 1} of {total}
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-ink-100">
              {questionTitle(question, interview.current)}
            </p>
            <p className="mt-1 text-xs text-ink-500">{question.minutes} minutes</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* A new hint, for the candidate */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            key={`hint-${hintKey}`}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
            className="fixed right-4 top-28 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-warning-line bg-ink-900/95 p-4 shadow-raised backdrop-blur"
            role="status"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-300">
                <Lightbulb className="h-4 w-4 text-warning" />
                Hint {hintIndex}
              </span>
              <button
                type="button"
                onClick={() => setDismissedHint(hintKey)}
                aria-label="Close"
                className="rounded-md p-1 text-ink-500 transition-colors hover:bg-ink-800 hover:text-ink-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-ink-100">{hints[hintIndex - 1]}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Time's up */}
      <AnimatePresence>
        {timeUp && (
          <motion.div
            key="time-up"
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed left-1/2 top-20 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-danger-line bg-ink-900 py-1.5 pl-4 pr-1.5 text-ink-100 shadow-raised"
            role="alert"
          >
            <Clock className="h-4 w-4 text-danger" />
            <span className="text-sm font-semibold text-danger">Time&apos;s up</span>
            {staff ? (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onControl("extend")}
                  className="flex items-center gap-1 rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1 text-xs font-semibold text-ink-100 transition-colors hover:border-ink-600"
                >
                  <Plus className="h-3 w-3" />5 min
                </button>
                <button
                  type="button"
                  onClick={() => onControl("end")}
                  className="flex items-center gap-1 rounded-md bg-danger-strong px-2.5 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <Square className="h-3 w-3" />
                  End
                </button>
              </span>
            ) : (
              <span className="pr-2.5 text-xs text-ink-400">Wrap up your thoughts</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* The end, for the candidate and anyone watching */}
      <AnimatePresence>
        {showEnd && (
          <motion.div
            key="ended"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] grid place-items-center bg-ink-950/70 px-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 24, scale: 0.96 }}
              animate={{ y: 0, scale: 1 }}
              transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
              className="w-full max-w-sm rounded-xl border border-ink-800 bg-ink-900 p-6 text-center shadow-raised"
            >
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-ink-700 bg-ink-950">
                <PartyPopper className="h-5 w-5 text-success" />
              </div>
              <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink-100">
                {candidate ? "Interview complete" : "The interview is over"}
              </p>
              <p className="mt-1.5 text-sm text-ink-400">
                {candidate
                  ? `Nice work${interview.candidate?.name ? `, ${interview.candidate.name}` : ""}. Your interviewers are writing feedback; you'll find the report on your Interviews page once it's shared.`
                  : "The interviewers are writing up their feedback."}
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-left">
                {[
                  ["Time", formatClock(elapsed)],
                  ["Questions", `${interview.questions.filter((q) => q.status !== "pending").length}/${total}`],
                  ["Hints", String(interview.questions.reduce((sum, q) => sum + q.hintsGiven, 0))],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-ink-800 bg-ink-950/60 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-ink-500">{label}</p>
                    <p className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-ink-100">{value}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setDismissedEnd(interview.id)}
                className="mt-5 h-9 w-full rounded-lg bg-ink-100 text-sm font-semibold text-ink-950 transition-colors hover:bg-ink-200"
              >
                Back to the room
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}