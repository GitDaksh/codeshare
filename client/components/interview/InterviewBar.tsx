"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Flag,
  FlaskConical,
  Gauge,
  Lightbulb,
  Pause,
  Play,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Square,
} from "lucide-react";
import {
  countdownAt,
  elapsedAt,
  formatClock,
  isCandidateIn,
  isInterviewerIn,
  latestComplexity,
  latestTests,
  questionElapsedAt,
  questionTitle,
  remainingAt,
  summarizeIntegrity,
  useClock,
  type InterviewState,
} from "@/lib/interview";

type Control = "start" | "pause" | "resume" | "extend" | "end" | "hint" | "phase" | "goto" | "next";

type InterviewBarProps = {
  interview: InterviewState;
  skew: number;
  me: string | null;
  // How many hints the current question has (3 for Practice problems).
  hintCount: number;
  onControl: (action: Control, extra?: Record<string, unknown>) => void;
  onDone: () => void;
  // An interviewer, once it's over.
  onScorecard?: () => void;
};

const CHIP =
  "flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-ink-800 bg-ink-950/60 px-2 text-[11px] tabular-nums text-ink-300";
// Two separate looks (stacking one's colours over the other's would let the
// stylesheet, not the class order, decide which wins).
const CONTROL_BASE =
  "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const CONTROL = `${CONTROL_BASE} border-ink-700 bg-ink-900 text-ink-200 hover:border-ink-500 hover:text-ink-100`;
const PRIMARY = `${CONTROL_BASE} border-ink-100 bg-ink-100 font-semibold text-ink-950 hover:bg-white`;

// The live strip under the room header: the questions, the clocks, what's
// happened so far, and the controls for whoever may use them.
export function InterviewBar({ interview, skew, me, hintCount, onControl, onDone, onScorecard }: InterviewBarProps) {
  const now = useClock() + skew;
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [doneFor, setDoneFor] = useState<number | null>(null);

  const staff = isInterviewerIn(interview, me);
  const candidate = isCandidateIn(interview, me);
  const solo = interview.mode === "solo";
  const scheduled = interview.status === "scheduled";
  const ended = interview.status === "ended";
  const paused = interview.status === "paused";
  const starting = !ended && countdownAt(interview, now) > 0;
  const elapsed = elapsedAt(interview, now);
  const remaining = remainingAt(interview, now);
  const total = interview.durationMs + interview.extraMs;
  const overtime = !ended && !scheduled && remaining < 0;
  const progress = Math.min(100, (elapsed / Math.max(total, 1)) * 100);
  const question = interview.questions[interview.current];
  const onQuestion = questionElapsedAt(interview, now);
  const questionBudget = (question?.minutes ?? 0) * 60000;
  const questionOver = !scheduled && !ended && onQuestion > questionBudget;
  const tests = latestTests(interview.events, interview.current);
  const complexity = latestComplexity(interview.events, interview.current);
  const integrity = staff && interview.settings.monitoring && !solo ? summarizeIntegrity(interview.events) : null;
  const last = interview.current >= interview.questions.length - 1;
  const canHint = solo && !ended && !scheduled && interview.settings.hints && question?.problemSlug && question.hintsGiven < hintCount;
  const said = doneFor === interview.current || interview.events.some((e) => e.type === "done" && e.question === interview.current);

  function handleEnd() {
    if (!confirmEnd) {
      setConfirmEnd(true);
      setTimeout(() => setConfirmEnd(false), 3000);
      return;
    }
    setConfirmEnd(false);
    onControl("end");
  }

  return (
    <div className="relative mx-0 mb-0 shrink-0 overflow-hidden border-b border-ink-800 bg-ink-900 md:mx-2 md:mb-2 md:rounded-xl md:border">
      <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        {/* What's going on */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {!ended && !paused && !scheduled && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink-100 opacity-50" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                ended || scheduled ? "bg-ink-500" : paused ? "bg-ink-400" : "bg-ink-100"
              }`}
            />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
              {solo ? "Mock interview" : interview.title}
              {scheduled && <span className="normal-case tracking-normal text-ink-400">· in the lobby</span>}
              {ended && <span className="normal-case tracking-normal text-ink-400">· ended</span>}
            </p>
            <p className="truncate text-sm font-semibold text-ink-100">
              {scheduled
                ? `${interview.questions.length} question${interview.questions.length === 1 ? "" : "s"} · ${formatClock(total)}`
                : starting
                  ? "Starting…"
                  : `${interview.questions.length > 1 ? `Q${interview.current + 1} · ` : ""}${question ? questionTitle(question, interview.current) : ""}`}
            </p>
          </div>
        </div>

        {/* The questions: done, now, still to come (interviewers can jump) */}
        {interview.questions.length > 1 && !scheduled && (
          <div className="hidden items-center gap-1 rounded-lg border border-ink-800 bg-ink-950/60 p-0.5 lg:flex">
            {interview.questions.map((q, index) => {
              const active = index === interview.current;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => staff && !ended && !active && onControl("goto", { index })}
                  disabled={!staff || ended || active}
                  title={`${questionTitle(q, index)} · ${q.minutes} min${staff && !ended && !active ? " (click to go there)" : ""}`}
                  className={`relative flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold tabular-nums transition-colors ${
                    active ? "text-ink-950" : q.status === "done" ? "text-ink-300 hover:text-ink-100" : "text-ink-600 hover:text-ink-300"
                  } ${!staff || ended || active ? "cursor-default" : ""}`}
                >
                  {active && (
                    <motion.span
                      layoutId={`interview-question-${interview.id}`}
                      className="absolute inset-0 rounded-md bg-ink-100"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  <span className="relative flex items-center gap-0.5">
                    {q.status === "done" && !active && <Check className="h-3 w-3" />}
                    {index + 1}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* This question so far */}
        {!scheduled && (
          <div className="hidden items-center gap-1.5 md:flex">
            {interview.settings.hints && (
              <span className={CHIP} title="Hints given for this question">
                <Lightbulb className="h-3.5 w-3.5" />
                {question?.problemSlug ? `${question.hintsGiven}/${hintCount}` : (question?.hintsGiven ?? 0)}
              </span>
            )}
            <span className={CHIP} title={tests ? `Last test run at ${formatClock(tests.at)}` : "No test runs yet"}>
              <FlaskConical className="h-3.5 w-3.5" />
              {tests ? `${tests.passed}/${tests.total}` : "–"}
            </span>
            {complexity && (
              <span className={`${CHIP} hidden xl:flex`} title="Latest Big-O measurement">
                <Gauge className="h-3.5 w-3.5" />
                {complexity.time}
              </span>
            )}
            {integrity && (
              <span
                className={`${CHIP} ${integrity.flags.length ? "border-ink-500 text-ink-100" : ""}`}
                title={`Integrity: ${integrity.tabSwitches} tab switches, ${integrity.pastes} pastes, ${integrity.inserts} large insertions`}
              >
                {integrity.flags.length ? <ShieldAlert className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                {integrity.flags.length}
              </span>
            )}
            {candidate && !staff && interview.settings.monitoring && !ended && (
              <span className={CHIP} title="Tab switches and pastes are visible to your interviewers">
                <ShieldCheck className="h-3.5 w-3.5" />
                Monitored
              </span>
            )}
          </div>
        )}

        {/* The clocks */}
        {!scheduled && (
          <div className="flex shrink-0 items-end gap-3">
            {interview.questions.length > 1 && !ended && (
              <div className="hidden flex-col items-end leading-none sm:flex" title="Time on this question / its budget">
                <span className={`font-[family-name:var(--font-mono)] text-sm tabular-nums ${questionOver ? "text-ink-100" : "text-ink-400"}`}>
                  {formatClock(onQuestion)}
                  <span className="text-ink-600"> / {formatClock(questionBudget)}</span>
                </span>
                <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-600">this question</span>
              </div>
            )}
            <div className="flex flex-col items-end leading-none">
              <span
                className={`font-[family-name:var(--font-mono)] text-xl font-semibold tabular-nums ${
                  overtime ? "text-ink-100 drop-shadow-[0_0_10px_rgba(255,255,255,0.45)]" : "text-ink-200"
                } ${paused ? "animate-pulse" : ""}`}
              >
                {ended ? formatClock(elapsed) : starting ? formatClock(total) : overtime ? `+${formatClock(remaining)}` : formatClock(remaining)}
              </span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                {ended ? "used" : paused ? "paused" : overtime ? "overtime" : starting ? "get ready" : "left"}
              </span>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex shrink-0 items-center gap-1.5">
          {staff && scheduled && (
            <button type="button" onClick={() => onControl("start")} className={PRIMARY}>
              <Play className="h-3.5 w-3.5" />
              Start
            </button>
          )}
          {staff && !scheduled && !ended && (
            <>
              <button
                type="button"
                onClick={() => onControl(paused ? "resume" : "pause")}
                disabled={starting}
                className={CONTROL}
                title={paused ? "Resume the clock" : "Pause the clock"}
                aria-label={paused ? "Resume" : "Pause"}
              >
                {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={() => onControl("extend")} className={CONTROL} title="Add 5 minutes">
                <Plus className="h-3.5 w-3.5" />5
              </button>
              {canHint && (
                <button type="button" onClick={() => onControl("hint")} className={CONTROL} title="Reveal the next hint">
                  <Lightbulb className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Hint</span>
                </button>
              )}
              {!last && (
                <button type="button" onClick={() => onControl("next")} className={CONTROL} title="Move to the next question">
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
              <button type="button" onClick={handleEnd} className={confirmEnd ? PRIMARY : CONTROL} title="End the interview">
                <Square className="h-3 w-3" />
                {confirmEnd ? "Click again" : "End"}
              </button>
            </>
          )}
          {candidate && !staff && !scheduled && !ended && (
            <button
              type="button"
              onClick={() => {
                setDoneFor(interview.current);
                onDone();
              }}
              disabled={starting || said}
              className={said ? CONTROL : PRIMARY}
              title="Tell your interviewers you've finished this question"
            >
              {said ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Flag className="h-3.5 w-3.5" />}
              {said ? "Done" : "I'm done"}
            </button>
          )}
          {staff && ended && onScorecard && (
            <button type="button" onClick={onScorecard} className={PRIMARY}>
              Scorecard
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {!scheduled && (
        <div className="relative h-1 bg-ink-800">
          <motion.div
            className={`absolute inset-y-0 left-0 ${overtime ? "animate-pulse bg-ink-100" : "bg-ink-300"}`}
            animate={{ width: `${starting ? 0 : progress}%` }}
            transition={{ duration: 0.25, ease: "linear" }}
          />
          {interview.events
            .filter((event) => event.type === "question" || event.type === "hint" || event.type === "tests")
            .map((event, index) => (
              <span
                key={`${event.type}-${event.at}-${index}`}
                title={`${event.type === "question" ? `Question ${(event.question ?? 0) + 1}` : event.type === "hint" ? "Hint" : `Tests ${event.data?.passed}/${event.data?.total}`} · ${formatClock(event.at)}`}
                style={{ left: `${Math.min(100, (event.at / Math.max(total, elapsed, 1)) * 100)}%` }}
                className={`absolute bottom-0 -translate-x-1/2 rounded-full ${
                  event.type === "question" ? "h-3 w-0.5 bg-ink-100" : event.type === "hint" ? "h-2.5 w-1 bg-ink-200" : "h-2 w-1 bg-ink-500"
                }`}
              />
            ))}
        </div>
      )}
    </div>
  );
}