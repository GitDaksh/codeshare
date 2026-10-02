"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  FlaskConical,
  Flag,
  Gauge,
  Lightbulb,
  Pause,
  Play,
  Plus,
  Square,
} from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
import {
  INTERVIEW_PHASES,
  countdownAt,
  elapsedAt,
  formatClock,
  latestComplexity,
  latestTests,
  remainingAt,
  useClock,
  type InterviewEvent,
  type InterviewPhase,
  type InterviewState,
} from "@/lib/interview";

type InterviewBarProps = {
  interview: InterviewState;
  skew: number;
  me: string | null;
  title: string;
  // How many hints this question has (3 for Practice problems).
  hintCount: number;
  onControl: (action: "pause" | "resume" | "extend" | "end" | "hint" | "phase", extra?: Record<string, unknown>) => void;
  onDone: () => void;
  // The interviewer, once it's over.
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

function markerLabel(event: InterviewEvent): string | null {
  switch (event.type) {
    case "hint":
      return `Hint ${event.data?.index ?? ""}`;
    case "tests":
      return `Tests ${event.data?.passed}/${event.data?.total}`;
    case "done":
      return "Candidate said they're done";
    case "pause":
      return "Paused";
    case "extend":
      return "+5 minutes";
    case "phase": {
      const phase = INTERVIEW_PHASES.find((p) => p.id === event.data?.phase);
      return phase ? `Moved to ${phase.label}` : null;
    }
    default:
      return null;
  }
}

// The events along the bottom edge of the bar, placed by interview time.
function Timeline({ events, span }: { events: InterviewEvent[]; span: number }) {
  return (
    <>
      {events.map((event, index) => {
        const label = markerLabel(event);
        if (!label || span <= 0) return null;
        const left = Math.min(100, (event.at / span) * 100);
        const allPassed = event.type === "tests" && event.data?.passed === event.data?.total;
        return (
          <motion.span
            key={`${event.type}-${event.at}-${index}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            title={`${label} · ${formatClock(event.at)}`}
            style={{ left: `${left}%` }}
            className={`absolute bottom-0 h-2.5 w-1 -translate-x-1/2 rounded-full ${
              event.type === "hint"
                ? "bg-ink-100"
                : event.type === "tests"
                  ? allPassed
                    ? "bg-ink-100 shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                    : "bg-ink-400"
                  : event.type === "done"
                    ? "h-3.5 bg-ink-100"
                    : "bg-ink-600"
            }`}
          />
        );
      })}
    </>
  );
}

// The live strip under the room header: the clock, the phases, what's
// happened so far, and the controls for whoever is allowed to use them.
export function InterviewBar({ interview, skew, me, title, hintCount, onControl, onDone, onScorecard }: InterviewBarProps) {
  const now = useClock() + skew;
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [saidDone, setSaidDone] = useState(false);

  const isInterviewer = me === interview.interviewer.userId;
  const isCandidate = me === interview.candidate.userId;
  const solo = interview.mode === "solo";
  const ended = interview.status === "ended";
  const paused = interview.status === "paused";
  const starting = !ended && countdownAt(interview, now) > 0;
  const elapsed = elapsedAt(interview, now);
  const remaining = remainingAt(interview, now);
  const total = interview.durationMs + interview.extraMs;
  const overtime = !ended && remaining < 0;
  const progress = Math.min(100, (elapsed / Math.max(total, 1)) * 100);
  const tests = latestTests(interview.events);
  const complexity = latestComplexity(interview.events);
  const phaseIndex = INTERVIEW_PHASES.findIndex((phase) => phase.id === interview.phase);
  const canGiveHint = solo && !ended && (interview.problemSlug ? interview.hintsGiven < hintCount : false);
  const lowTime = !ended && !overtime && remaining < 5 * 60 * 1000;

  function setPhase(phase: InterviewPhase) {
    if (isInterviewer && !ended) onControl("phase", { phase });
  }

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
        {/* Who and what */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {!ended && !paused && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink-100 opacity-50" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${ended ? "bg-ink-500" : paused ? "bg-ink-400" : "bg-ink-100"}`}
            />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
              {solo ? "Mock interview" : "Interview"}
              {ended && <span className="normal-case tracking-normal text-ink-400">· ended</span>}
            </p>
            <p className="truncate text-sm font-semibold text-ink-100">{starting ? "Starting…" : title}</p>
          </div>
          {!solo && (
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-ink-800 py-0.5 pl-0.5 pr-2 text-[11px] text-ink-300 xl:flex">
              <AvatarIcon avatarId={interview.interviewer.avatarId} className="h-5 w-5 rounded-full" />
              {interview.interviewer.name}
              <span className="text-ink-600">→</span>
              <AvatarIcon avatarId={interview.candidate.avatarId} className="h-5 w-5 rounded-full" />
              {interview.candidate.name}
            </span>
          )}
        </div>

        {/* Phases */}
        <div className="relative hidden items-center rounded-lg border border-ink-800 bg-ink-950/60 p-0.5 lg:flex">
          {INTERVIEW_PHASES.map((phase, index) => {
            const active = phase.id === interview.phase;
            return (
              <button
                key={phase.id}
                type="button"
                onClick={() => setPhase(phase.id)}
                disabled={!isInterviewer || ended}
                title={isInterviewer && !ended ? `Move to ${phase.label}` : phase.label}
                className={`relative rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  active ? "text-ink-950" : index < phaseIndex ? "text-ink-300" : "text-ink-500"
                } ${isInterviewer && !ended ? "hover:text-ink-100" : "cursor-default"}`}
              >
                {active && (
                  <motion.span
                    layoutId={`interview-phase-${interview.id}`}
                    className="absolute inset-0 rounded-md bg-ink-100"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <span className="relative flex items-center gap-1">
                  {index < phaseIndex && <Check className="h-3 w-3" />}
                  {phase.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* What's happened */}
        <div className="hidden items-center gap-1.5 md:flex">
          <span className={CHIP} title="Hints given">
            <Lightbulb className="h-3.5 w-3.5" />
            {interview.problemSlug ? `${interview.hintsGiven}/${hintCount}` : interview.hintsGiven}
          </span>
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
        </div>

        {/* The clock */}
        <div
          className={`flex shrink-0 flex-col items-end leading-none ${overtime ? "text-ink-100" : lowTime ? "text-ink-100" : "text-ink-200"}`}
          aria-live="off"
        >
          <span
            className={`font-[family-name:var(--font-mono)] text-xl font-semibold tabular-nums ${
              paused ? "animate-pulse" : ""
            } ${overtime ? "drop-shadow-[0_0_10px_rgba(255,255,255,0.45)]" : ""}`}
          >
            {ended ? formatClock(elapsed) : starting ? formatClock(total) : overtime ? `+${formatClock(remaining)}` : formatClock(remaining)}
          </span>
          <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-500">
            {ended ? "used" : paused ? "paused" : overtime ? "overtime" : starting ? "get ready" : "left"}
          </span>
        </div>

        {/* Controls */}
        <div className="flex shrink-0 items-center gap-1.5">
          {isInterviewer && !ended && (
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
              {canGiveHint && (
                <button type="button" onClick={() => onControl("hint")} className={CONTROL} title="Reveal the next hint">
                  <Lightbulb className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Hint</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleEnd}
                className={confirmEnd ? PRIMARY : CONTROL}
                title="End the interview"
              >
                <Square className="h-3 w-3" />
                {confirmEnd ? "Click again" : "End"}
              </button>
            </>
          )}
          {isCandidate && !isInterviewer && !ended && (
            <button
              type="button"
              onClick={() => {
                setSaidDone(true);
                onDone();
              }}
              disabled={starting}
              className={saidDone ? CONTROL : PRIMARY}
              title="Tell the interviewer you've finished"
            >
              {saidDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Flag className="h-3.5 w-3.5" />}
              {saidDone ? "Done" : "I'm done"}
            </button>
          )}
          {isInterviewer && ended && onScorecard && (
            <button
              type="button"
              onClick={onScorecard}
              className={PRIMARY}
            >
              Scorecard
            </button>
          )}
        </div>
      </div>

      {/* Progress, with the events on it */}
      <div className="relative h-1 bg-ink-800">
        <motion.div
          className={`absolute inset-y-0 left-0 ${overtime ? "animate-pulse bg-ink-100" : "bg-ink-300"}`}
          animate={{ width: `${starting ? 0 : progress}%` }}
          transition={{ duration: 0.25, ease: "linear" }}
        />
        <Timeline events={interview.events} span={Math.max(total, elapsed)} />
      </div>
    </div>
  );
}