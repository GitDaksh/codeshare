"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Eye, Loader2, Play, ShieldCheck, UserRound, Users } from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
import { LANGUAGES } from "@/lib/languages";
import {
  formatDuration,
  isCandidateIn,
  isInterviewerIn,
  questionTitle,
  type InterviewState,
} from "@/lib/interview";

type InterviewLobbyProps = {
  interview: InterviewState;
  me: string | null;
  onlineIds: Set<string>;
  onStart: () => void;
  onConsent: () => void;
};

const SETTING_LABELS: { key: keyof InterviewState["settings"]; on: string; off: string }[] = [
  { key: "hints", on: "Hints on", off: "No hints" },
  { key: "runTests", on: "Candidate can run tests", off: "No test runs" },
  { key: "lens", on: "Lens allowed", off: "No Lens" },
  { key: "meter", on: "Big-O meter on", off: "No Big-O meter" },
  { key: "monitoring", on: "Monitoring on", off: "No monitoring" },
];

function when(iso: string | null): string {
  if (!iso) return "Starts when the interviewer is ready";
  const date = new Date(iso);
  const minutes = Math.round((date.getTime() - Date.now()) / 60000);
  const label = date.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit", month: "short", day: "numeric" });
  if (minutes > 0 && minutes < 120) return `${label} · in ${minutes} min`;
  return label;
}

function LinkRow({ label, detail, code }: { label: string; detail: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/interviews/join/${code}` : "";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-950/60 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-ink-100">{label}</p>
        <p className="truncate text-[11px] text-ink-500">{detail}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
        className={`flex h-7 shrink-0 items-center gap-1 rounded-lg border bg-ink-900 px-2.5 text-[11px] font-medium shadow-xs transition-colors ${
          copied ? "border-success-line text-success" : "border-ink-700 text-ink-200 hover:border-ink-600 hover:text-ink-100"
        }`}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

// The three invite links (interviewers only see them).
export function InterviewLinks({ interview }: { interview: InterviewState }) {
  if (!interview.codes) return null;
  return (
    <div className="space-y-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">Invite links</h2>
      <LinkRow
        label="Candidate"
        detail={
          interview.invitedCandidateId
            ? `Only for ${interview.candidate?.name ?? "the invited candidate"}`
            : interview.candidate
              ? `${interview.candidate.name} has joined as the candidate`
              : "The first person to open it becomes the candidate"
        }
        code={interview.codes.candidate}
      />
      <LinkRow label="Interviewer" detail="Joins the panel: shared notes and their own scorecard" code={interview.codes.interviewer} />
      <LinkRow label="Observer" detail="Watches everything, can't type or see your notes" code={interview.codes.observer} />
    </div>
  );
}

// The waiting room before an interview starts: who's here, what's planned,
// the invite links, and (for the candidate) what monitoring records.
export function InterviewLobby({ interview, me, onlineIds, onStart, onConsent }: InterviewLobbyProps) {
  const [consented, setConsented] = useState(false);
  const [starting, setStarting] = useState(false);
  const staff = isInterviewerIn(interview, me);
  const candidate = isCandidateIn(interview, me);
  const solo = interview.mode === "solo";
  const language = LANGUAGES.find((option) => option.value === interview.language)?.label ?? interview.language;
  const candidateHere = !!interview.candidate && onlineIds.has(interview.candidate.userId);
  const total = interview.durationMs;

  function start() {
    setStarting(true);
    onStart();
    setTimeout(() => setStarting(false), 4000);
  }

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-ink-950/95 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-3xl px-5 py-10"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-ink-500">
          {solo ? "Mock interview" : "Interview lobby"}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink-100">
          {interview.title}
        </h1>
        <p className="mt-2 text-sm text-ink-400">
          {[interview.position, interview.level, language].filter(Boolean).join(" · ")}
          <span className="text-ink-600"> · </span>
          {when(interview.scheduledFor)}
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* People */}
          <section className="rounded-xl border border-ink-800 bg-ink-900 p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
              <Users className="h-3.5 w-3.5" />
              Who&apos;s here
            </h2>
            <ul className="space-y-2">
              {interview.interviewers.map((person) => (
                <li key={person.userId} className="flex items-center gap-2.5">
                  <span className="relative">
                    <AvatarIcon avatarId={person.avatarId} className="h-7 w-7 rounded-full" />
                    {onlineIds.has(person.userId) && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-900 bg-success-strong" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-100">
                    {person.userId === me ? "You" : person.name}
                  </span>
                  <span className="text-[11px] text-ink-500">{solo ? "You" : "Interviewer"}</span>
                </li>
              ))}
              {!solo && (
                <li className="flex items-center gap-2.5">
                  {interview.candidate ? (
                    <span className="relative">
                      <AvatarIcon avatarId={interview.candidate.avatarId} className="h-7 w-7 rounded-full" />
                      {candidateHere && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-900 bg-success-strong" />
                      )}
                    </span>
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded-full border border-dashed border-ink-700">
                      <UserRound className="h-3.5 w-3.5 text-ink-500" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-100">
                    {interview.candidate ? (candidate ? "You" : interview.candidate.name) : "No candidate yet"}
                  </span>
                  <span className="text-[11px] text-ink-500">
                    {interview.candidate ? (candidateHere ? "Candidate · here" : "Candidate · not here yet") : "Send the candidate link"}
                  </span>
                </li>
              )}
            </ul>
          </section>

          {/* The plan */}
          <section className="rounded-xl border border-ink-800 bg-ink-900 p-4">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
              {interview.questions.length} question{interview.questions.length === 1 ? "" : "s"} · {formatDuration(total)}
            </h2>
            {staff ? (
              <ol className="space-y-1.5">
                {interview.questions.map((question, index) => (
                  <li key={index} className="flex items-center gap-2.5 text-sm">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-ink-700 text-[10px] font-semibold text-ink-400">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-ink-200">{questionTitle(question, index)}</span>
                    <span className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] text-ink-500">{question.minutes}m</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm leading-relaxed text-ink-400">
                The questions are revealed one at a time once the interview starts. Each has its own time budget; the
                interviewers move you on.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {SETTING_LABELS.filter((setting) => !(solo && setting.key === "monitoring")).map((setting) => (
                <span
                  key={setting.key}
                  className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${
                    interview.settings[setting.key] ? "border-ink-600 text-ink-200" : "border-ink-800 text-ink-500"
                  }`}
                >
                  {interview.settings[setting.key] ? setting.on : setting.off}
                </span>
              ))}
            </div>
          </section>
        </div>

        {/* What monitoring records, said plainly to the candidate */}
        {candidate && !staff && interview.settings.monitoring && (
          <section className="mt-4 rounded-xl border border-ink-700 bg-ink-900 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-ink-200" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-100">This interview is monitored</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-400">
                  Your interviewers will see when you switch away from this tab (and for how long), when you paste
                  into the editor, when a lot of code appears at once, and if you open the interview in another tab
                  or lose your connection. Nothing else, and never your screen or camera.
                </p>
              </div>
              <button
                type="button"
                disabled={consented}
                onClick={() => {
                  setConsented(true);
                  onConsent();
                }}
                className="h-8 shrink-0 rounded-lg bg-ink-100 px-3.5 text-xs font-semibold text-ink-950 transition-colors hover:bg-ink-200 disabled:cursor-default disabled:bg-success-soft disabled:text-success"
              >
                {consented ? "✓ Understood" : "I understand"}
              </button>
            </div>
          </section>
        )}

        {/* The links */}
        {staff && !solo && interview.codes && (
          <section className="mt-4">
            <InterviewLinks interview={interview} />
          </section>
        )}

        {/* Start, or wait */}
        <div className="mt-8 flex flex-col items-center gap-2 text-center">
          {staff ? (
            <>
              <button
                type="button"
                onClick={start}
                disabled={starting || (!solo && !interview.candidate)}
                className="flex h-12 items-center gap-2 rounded-lg bg-ink-100 px-7 text-sm font-semibold text-ink-950 shadow-xs transition-all hover:bg-ink-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Start the interview
              </button>
              <p className="text-xs text-ink-500">
                {solo
                  ? "A 3-2-1 countdown, then your first question."
                  : !interview.candidate
                    ? "Waiting for a candidate: share the candidate link."
                    : candidateHere
                      ? "Everyone sees a 3-2-1 countdown, then question 1."
                      : `${interview.candidate.name} isn't here yet. You can start anyway.`}
              </p>
            </>
          ) : candidate ? (
            <p className="flex items-center gap-2 text-sm text-ink-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink-100 opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-ink-100" />
              </span>
              Waiting for your interviewer to start. Good luck!
            </p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-ink-400">
              <Eye className="h-4 w-4" />
              You&apos;re observing: you&apos;ll see everything, but can&apos;t type.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}