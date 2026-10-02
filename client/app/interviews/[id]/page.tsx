"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Code2,
  ExternalLink,
  Flag,
  FlaskConical,
  Gauge,
  Lightbulb,
  ListChecks,
  Loader2,
  Lock,
  Pause,
  Play,
  Plus,
  Printer,
  Square,
} from "lucide-react";
import { useApi } from "@/lib/api";
import { AvatarIcon } from "@/components/AvatarIcon";
import { Scorecard, type ScorecardChoice } from "@/components/interview/Scorecard";
import { getProblem } from "@/lib/problems";
import { interviewKit } from "@/lib/interviewKits";
import { LANGUAGES } from "@/lib/languages";
import {
  INTERVIEW_CRITERIA,
  INTERVIEW_PHASES,
  INTERVIEW_VERDICTS,
  RATING_LABELS,
  elapsedAt,
  formatClock,
  latestComplexity,
  latestTests,
  sameComplexity,
  type InterviewEvent,
  type InterviewReport,
} from "@/lib/interview";

const EVENT_ICONS = {
  start: Play,
  phase: ListChecks,
  hint: Lightbulb,
  pause: Pause,
  resume: Play,
  extend: Plus,
  tests: FlaskConical,
  complexity: Gauge,
  done: Flag,
  end: Square,
} as const;

function describe(event: InterviewEvent): string {
  switch (event.type) {
    case "start":
      return "Started";
    case "phase":
      return `Moved to ${INTERVIEW_PHASES.find((phase) => phase.id === event.data?.phase)?.label ?? "the next phase"}`;
    case "hint":
      return `Hint ${event.data?.index ?? ""} given`;
    case "pause":
      return "Paused";
    case "resume":
      return "Resumed";
    case "extend":
      return "+5 minutes";
    case "tests":
      return event.data?.passed === event.data?.total
        ? `All tests passed (${event.data?.passed}/${event.data?.total})`
        : `Tests: ${event.data?.passed}/${event.data?.total} passed`;
    case "complexity":
      return `Big-O measured: ${event.data?.time}${event.data?.space ? ` time, ${event.data.space} space` : ""}`;
    case "done":
      return "Said they were done";
    case "end":
      return "Ended";
  }
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">{label}</p>
      <p className="mt-1 truncate font-[family-name:var(--font-mono)] text-lg tabular-nums text-ink-100">{value}</p>
      {note && <p className="mt-0.5 truncate text-[11px] text-ink-500">{note}</p>}
    </div>
  );
}

export default function InterviewReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const api = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [scoring, setScoring] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    api
      .get<InterviewReport>(`/api/interviews/${id}`)
      .then((res) => setReport(res.data))
      .catch((err) =>
        setError({
          status: err?.response?.status ?? 0,
          message: err?.response?.data?.error ?? "Couldn't load this report.",
        })
      );
  }, [api, id, isLoaded, isSignedIn]);

  const problemSlug = report?.problemSlug ?? null;
  const problem = useMemo(() => (problemSlug ? getProblem(problemSlug) : null), [problemSlug]);
  const kit = useMemo(() => (problem ? interviewKit(problem) : null), [problem]);

  if (isLoaded && !isSignedIn) {
    return (
      <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-4 text-center">
        <Lock className="h-5 w-5 text-ink-400" />
        <p className="mt-3 font-semibold text-ink-100">Sign in to see this report</p>
        <Link href={`/sign-in?redirect_url=${encodeURIComponent(`/interviews/${id}`)}`} className="mt-4 text-sm text-ink-300 underline">
          Sign in
        </Link>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-4 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-ink-700 bg-ink-900">
          <Lock className="h-5 w-5 text-ink-300" />
        </div>
        <p className="mt-4 font-semibold text-ink-100">{error.status === 403 ? "Not shared yet" : "Report not found"}</p>
        <p className="mt-1.5 text-sm text-ink-400">
          {error.status === 403
            ? "Your interviewer is still writing feedback. The report will appear on your dashboard once it's shared."
            : error.message}
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex h-9 items-center rounded-full border border-ink-700 bg-ink-900 px-4 text-sm text-ink-100 transition-colors hover:border-ink-500"
        >
          Back to dashboard
        </Link>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="grid min-h-[60dvh] place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-ink-400" />
      </main>
    );
  }

  const title = report.custom?.title ?? problem?.title ?? "Interview";
  const used = elapsedAt(report, Date.parse(report.endedAt ?? report.serverNow));
  const allotted = report.durationMs + report.extraMs;
  const tests = latestTests(report.events);
  const complexity = latestComplexity(report.events);
  const verdict = INTERVIEW_VERDICTS.find((option) => option.id === report.verdict);
  const solo = report.mode === "solo";
  const isInterviewer = report.viewer === "interviewer";
  // The code at each test run (the final code is always shown on its own).
  const snapshots = report.snapshots.filter((snapshot) => snapshot.label !== "Final");
  const shown = picked === null ? null : (snapshots[picked] ?? null);
  const language = LANGUAGES.find((option) => option.value === report.language)?.label ?? report.language;

  async function saveScorecard(choice: ScorecardChoice) {
    try {
      const res = await api.post<InterviewReport>(`/api/interviews/${id}/scorecard`, choice);
      setReport(res.data);
      setScoring(false);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      throw new Error(message ?? "Couldn't save the scorecard.");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 print:max-w-none print:px-0 print:pt-0">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-ink-400 transition-colors hover:text-ink-100">
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/room/${report.roomId}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900 px-3 text-xs text-ink-200 transition-colors hover:border-ink-500 hover:text-ink-100"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open the room
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900 px-3 text-xs text-ink-200 transition-colors hover:border-ink-500 hover:text-ink-100"
          >
            <Printer className="h-3.5 w-3.5" />
            Save as PDF
          </button>
        </div>
      </div>

      {/* The headline */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-500">
            {solo ? "Mock interview report" : "Interview report"}
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink-100 sm:text-4xl">
            {title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-400">
            <span>{new Date(report.startedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
            <span className="text-ink-700">·</span>
            <span>{language}</span>
            {problem && (
              <>
                <span className="text-ink-700">·</span>
                <span>{problem.difficulty}</span>
              </>
            )}
            {!solo && (
              <>
                <span className="text-ink-700">·</span>
                <span className="flex items-center gap-1.5">
                  <AvatarIcon avatarId={report.interviewer.avatarId} className="h-5 w-5 rounded-full" />
                  {report.interviewer.name}
                  <span className="text-ink-600">→</span>
                  <AvatarIcon avatarId={report.candidate.avatarId} className="h-5 w-5 rounded-full" />
                  {report.candidate.name}
                </span>
              </>
            )}
          </div>
        </div>
        {verdict ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: "spring", bounce: 0.35 }}
            className={`flex shrink-0 items-center gap-2 rounded-2xl border px-5 py-3 ${
              report.verdict === "yes" || report.verdict === "strong-yes"
                ? "border-ink-100 bg-ink-100 text-ink-950 shadow-[0_0_40px_-12px_rgba(255,255,255,0.6)]"
                : "border-ink-600 bg-ink-900 text-ink-100"
            }`}
          >
            {(report.verdict === "yes" || report.verdict === "strong-yes") && <Check className="h-5 w-5" />}
            <span className="font-[family-name:var(--font-display)] text-xl font-semibold">{verdict.label}</span>
          </motion.div>
        ) : (
          isInterviewer && (
            <button
              type="button"
              onClick={() => setScoring(true)}
              className="h-11 shrink-0 rounded-full bg-ink-100 px-5 text-sm font-semibold text-ink-950 transition-colors hover:bg-white print:hidden"
            >
              {solo ? "Review yourself" : "Fill in the scorecard"}
            </button>
          )
        )}
      </motion.header>

      {/* The numbers */}
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Time used" value={formatClock(used)} note={`of ${formatClock(allotted)}`} />
        <Stat
          label="Hints"
          value={String(report.hintsGiven)}
          note={report.problemSlug ? `of ${kit?.hints.length ?? 3}` : undefined}
        />
        <Stat
          label="Tests"
          value={tests ? `${tests.passed}/${tests.total}` : "–"}
          note={tests ? (tests.passed === tests.total ? "All passing" : "Some failing") : "Never run"}
        />
        <Stat
          label="Big-O"
          value={complexity?.time ?? "–"}
          note={kit ? (sameComplexity(complexity?.time, kit.time) ? "✓ Matched the target" : `Target ${kit.time}`) : undefined}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="space-y-6">
          {/* Scores */}
          {report.ratings && (
            <section className="rounded-2xl border border-ink-800 bg-ink-900 p-5">
              <h2 className="text-sm font-semibold text-ink-100">{solo ? "Self-review" : "Scores"}</h2>
              <div className="mt-4 space-y-4">
                {INTERVIEW_CRITERIA.map((criterion, index) => {
                  const rating = report.ratings?.[criterion.id] ?? 0;
                  return (
                    <div key={criterion.id}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-ink-200">{criterion.label}</span>
                        <span className="text-xs text-ink-400">{RATING_LABELS[rating - 1] ?? "–"}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-ink-800">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(rating / 4) * 100}%` }}
                          transition={{ delay: 0.2 + index * 0.08, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full rounded-full bg-ink-100"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Feedback */}
          {report.feedback && (
            <section className="rounded-2xl border border-ink-800 bg-ink-900 p-5">
              <h2 className="text-sm font-semibold text-ink-100">{solo ? "Notes to self" : "Feedback"}</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-300">{report.feedback}</p>
            </section>
          )}

          {/* The interviewer's private notes */}
          {isInterviewer && !solo && report.notes.length > 0 && (
            <section className="rounded-2xl border border-ink-800 bg-ink-900 p-5">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-100">
                <Lock className="h-3.5 w-3.5 text-ink-500" />
                Your notes
                <span className="text-xs font-normal text-ink-500">· only you see these</span>
              </h2>
              <ul className="mt-3 space-y-2">
                {report.notes.map((note, index) => (
                  <li key={index} className="flex gap-3 text-sm">
                    <span className="w-12 shrink-0 font-[family-name:var(--font-mono)] text-xs tabular-nums text-ink-500">
                      {formatClock(note.at)}
                    </span>
                    <span className="min-w-0 flex-1 text-ink-300">
                      {note.tag && note.tag !== "follow-up" && <span className="mr-1 text-ink-500">{note.tag}</span>}
                      {note.text}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* The timeline */}
          <section className="rounded-2xl border border-ink-800 bg-ink-900 p-5">
            <h2 className="text-sm font-semibold text-ink-100">Timeline</h2>
            <ol className="relative mt-4 space-y-1 before:absolute before:bottom-2 before:left-[3.4rem] before:top-2 before:w-px before:bg-ink-800">
              {report.events.map((event, index) => {
                const Icon = EVENT_ICONS[event.type];
                // A test run shows the code at that moment; the end shows the final code.
                const snapshotIndex =
                  event.type === "tests" ? snapshots.findIndex((snapshot) => snapshot.at === event.at) : -1;
                const isEnd = event.type === "end";
                const hasCode = isEnd || snapshotIndex >= 0;
                const active = isEnd ? picked === null : snapshotIndex >= 0 && picked === snapshotIndex;
                return (
                  <li key={`${event.type}-${event.at}-${index}`}>
                    <button
                      type="button"
                      disabled={!hasCode}
                      onClick={() => setPicked(isEnd ? null : snapshotIndex)}
                      className={`relative flex w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-left text-sm transition-colors ${
                        hasCode ? "hover:bg-ink-800/60" : "cursor-default"
                      } ${active ? "bg-ink-800/80" : ""}`}
                    >
                      <span className="w-11 shrink-0 font-[family-name:var(--font-mono)] text-xs tabular-nums text-ink-500">
                        {formatClock(event.at)}
                      </span>
                      <span
                        className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                          event.type === "tests" && event.data?.passed === event.data?.total
                            ? "border-ink-100 bg-ink-100 text-ink-950"
                            : "border-ink-700 bg-ink-950 text-ink-300"
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink-200">{describe(event)}</span>
                      {hasCode && (
                        <span className="flex shrink-0 items-center gap-1 text-[11px] text-ink-500">
                          <Code2 className="h-3 w-3" />
                          code
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        {/* The code, at the chosen moment */}
        <section className="flex min-h-[24rem] flex-col overflow-hidden rounded-2xl border border-ink-800 bg-ink-900 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-7rem)] print:max-h-none">
          <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
              <Code2 className="h-4 w-4 text-ink-400" />
              {shown ? `Code at ${shown.label.toLowerCase()}` : "Final code"}
            </h2>
            <span className="font-[family-name:var(--font-mono)] text-xs text-ink-500">{formatClock(shown ? shown.at : used)}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-ink-950/60 py-3">
            <pre className="font-[family-name:var(--font-mono)] text-[12.5px] leading-6 text-ink-200">
              {(shown ? shown.code : report.finalCode).split("\n").map((line, index) => (
                <div key={index} className="flex">
                  <span className="w-12 shrink-0 select-none pr-4 text-right tabular-nums text-ink-600">{index + 1}</span>
                  <code className="whitespace-pre pr-4">{line || " "}</code>
                </div>
              ))}
            </pre>
          </div>
          {snapshots.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto border-t border-ink-800 px-3 py-2 print:hidden">
              {snapshots.map((snapshot, index) => (
                <button
                  key={`${snapshot.at}-${index}`}
                  type="button"
                  onClick={() => setPicked(index)}
                  className={`shrink-0 rounded-md border px-2 py-1 text-[11px] transition-colors ${
                    snapshot === shown
                      ? "border-ink-100 bg-ink-100 text-ink-950"
                      : "border-ink-700 text-ink-400 hover:border-ink-500 hover:text-ink-100"
                  }`}
                >
                  {formatClock(snapshot.at)} · {snapshot.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPicked(null)}
                className={`shrink-0 rounded-md border px-2 py-1 text-[11px] transition-colors ${
                  shown === null
                    ? "border-ink-100 bg-ink-100 text-ink-950"
                    : "border-ink-700 text-ink-400 hover:border-ink-500 hover:text-ink-100"
                }`}
              >
                {formatClock(used)} · Final
              </button>
            </div>
          )}
        </section>
      </div>

      <Scorecard
        open={scoring}
        interview={report}
        target={kit?.time ?? null}
        onClose={() => setScoring(false)}
        onSave={saveScorecard}
      />
    </main>
  );
}