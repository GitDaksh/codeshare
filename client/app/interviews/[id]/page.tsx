"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Code2,
  Eye,
  EyeOff,
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
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  UserRound,
} from "lucide-react";
import { useApi } from "@/lib/api";
import { PageContainer, PageHeader } from "@/components/PageHeader";
import { ui } from "@/lib/ui";
import { AvatarIcon } from "@/components/AvatarIcon";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { Scorecard, type ScorecardChoice } from "@/components/interview/Scorecard";
import { InterviewLinks } from "@/components/interview/InterviewLobby";
import { getProblem } from "@/lib/problems";
import { interviewKit } from "@/lib/interviewKits";
import { LANGUAGES } from "@/lib/languages";
import {
  INTERVIEW_CRITERIA,
  INTERVIEW_VERDICTS,
  RATING_LABELS,
  describeMonitor,
  elapsedAt,
  formatClock,
  formatDuration,
  latestComplexity,
  latestTests,
  panelVerdict,
  questionTitle,
  sameComplexity,
  summarizeIntegrity,
  type InterviewEvent,
  type InterviewReport,
} from "@/lib/interview";

const EVENT_ICONS: Partial<Record<InterviewEvent["type"], typeof Play>> = {
  start: Play,
  question: ListChecks,
  hint: Lightbulb,
  pause: Pause,
  resume: Play,
  extend: Plus,
  tests: FlaskConical,
  complexity: Gauge,
  done: Flag,
  end: Square,
};

function describe(event: InterviewEvent): string {
  switch (event.type) {
    case "start":
      return "Started";
    case "question":
      return `Moved to question ${(event.question ?? 0) + 1}`;
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
      return `Big-O measured: ${event.data?.time}`;
    case "done":
      return "Said they were done";
    case "end":
      return "Ended";
    default:
      return "";
  }
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">{label}</p>
      <p className="mt-1 truncate font-[family-name:var(--font-mono)] text-lg tabular-nums text-ink-100">{value}</p>
      {note && <p className="mt-0.5 truncate text-[11px] text-ink-500">{note}</p>}
    </div>
  );
}

const SECTION = "rounded-xl border border-ink-800 bg-ink-900 p-5";
// One interview: its plan and links before it happens, its report after.
export default function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const api = useApi();
  const router = useRouter();
  const created = useSearchParams().get("created") === "1";
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [data, setData] = useState<InterviewReport | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [scoring, setScoring] = useState(false);
  const [tab, setTab] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    api
      .get<InterviewReport>(`/api/interviews/${id}`)
      .then((res) => {
        setData(res.data);
        document.title = `${res.data.title} — Interviews — CodeShare`;
      })
      .catch((err) =>
        setError({ status: err?.response?.status ?? 0, message: err?.response?.data?.error ?? "Couldn't load this interview." })
      );
  }, [api, id, isLoaded, isSignedIn]);

  const question = data?.questions[tab] ?? null;
  const problemSlug = question?.problemSlug ?? null;
  const problem = useMemo(() => (problemSlug ? getProblem(problemSlug) : null), [problemSlug]);
  const kit = useMemo(() => (problem ? interviewKit(problem) : null), [problem]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-4 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-xl border border-ink-700 bg-ink-900">
          <Lock className="h-5 w-5 text-ink-300" />
        </div>
        <p className="mt-4 font-semibold text-ink-100">{error.status === 403 ? "Not shared yet" : "Interview not found"}</p>
        <p className="mt-1.5 text-sm text-ink-400">
          {error.status === 403
            ? "Your interviewers are still writing feedback. The report will appear here once it's shared."
            : error.message}
        </p>
        <Link href="/interviews" className="mt-5 inline-flex h-9 items-center rounded-lg border border-ink-700 bg-ink-900 px-4 text-sm text-ink-100 transition-colors hover:border-ink-500">
          Back to Interviews
        </Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="grid min-h-[60dvh] place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-ink-400" />
      </main>
    );
  }

  const staff = data.viewer === "interviewer";
  const when =
    data.status === "ended"
      ? new Date(data.endedAt ?? data.serverNow).toLocaleDateString(undefined, { dateStyle: "medium" })
      : data.scheduledFor
        ? new Date(data.scheduledFor).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
        : "Not scheduled";
  const organizer = data.organizerId === userId;
  const solo = data.mode === "solo";
  const ended = data.status === "ended";
  const live = data.status === "running" || data.status === "paused";
  const language = LANGUAGES.find((option) => option.value === data.language)?.label ?? data.language;
  const scorecards = data.scorecards ?? [];
  const mine = scorecards.find((card) => card.interviewerId === userId);
  const verdict = panelVerdict(scorecards.map((card) => card.verdict));
  const used = elapsedAt(data, Date.parse(data.endedAt ?? data.serverNow));
  const reached = data.questions.filter((q) => q.status !== "pending").length;
  const passing = data.questions.filter((_, i) => {
    const run = latestTests(data.events, i);
    return run && run.total > 0 && run.passed === run.total;
  }).length;
  const hints = data.questions.reduce((sum, q) => sum + q.hintsGiven, 0);
  const integrity = summarizeIntegrity(data.events);
  const monitored = staff && !solo && data.settings.monitoring;
  const snapshots = (data.snapshots ?? []).filter((snapshot) => snapshot.question === tab && snapshot.label !== "Final");
  const shown = picked === null ? null : (snapshots[picked] ?? null);
  const run = question ? latestTests(data.events, tab) : null;
  const complexity = question ? latestComplexity(data.events, tab) : null;

  async function saveScorecard(choice: ScorecardChoice) {
    try {
      const res = await api.post<InterviewReport>(`/api/interviews/${id}/scorecard`, choice);
      setData(res.data);
      setScoring(false);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      throw new Error(message ?? "Couldn't save the scorecard.");
    }
  }

  async function toggleShare() {
    if (!data) return;
    const res = await api.post<InterviewReport>(`/api/interviews/${id}/share`, { shared: !data.shared }).catch(() => null);
    if (res) setData(res.data);
  }

  async function remove() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    await api.delete(`/api/interviews/${id}`).catch(() => null);
    router.push("/interviews");
  }

  return (
    <PageContainer className="print:max-w-none print:px-0 print:pt-0">
      <PageHeader
        back={{ href: "/interviews", label: "Interviews" }}
        title={data.title}
        description={[solo ? "Mock interview" : null, data.position, data.level, language, when].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {organizer && ended && !solo && (
              <button type="button" onClick={toggleShare} className={ui.secondarySm} title="Whether the candidate can read this report">
                {data.shared ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {data.shared ? "Shared with the candidate" : "Not shared"}
              </button>
            )}
            {ended && (
              <button type="button" onClick={() => window.print()} className={ui.secondarySm}>
                <Printer className="h-3.5 w-3.5" />
                Save as PDF
              </button>
            )}
            {organizer && !live && (
              <button
                type="button"
                onClick={remove}
                className={confirmDelete ? `${ui.secondarySm} border-danger-line text-danger hover:bg-danger-soft` : ui.secondarySm}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {confirmDelete ? "Click again to delete" : "Delete"}
              </button>
            )}
            {ended && staff && !mine && (
              <button type="button" onClick={() => setScoring(true)} className={ui.primarySm}>
                {solo ? "Review yourself" : "Fill in your scorecard"}
              </button>
            )}
          </div>
        }
      >
        {!solo && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-300">
            {data.interviewers.map((person) => (
              <span key={person.userId} className="flex items-center gap-1.5 rounded-md border border-ink-800 bg-ink-900 py-0.5 pl-0.5 pr-2">
                <AvatarIcon avatarId={person.avatarId} className="h-5 w-5 rounded-full" />
                {person.name}
              </span>
            ))}
            <ArrowRight className="h-3.5 w-3.5 text-ink-600" />
            {data.candidate ? (
              <span className="flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-900 py-0.5 pl-0.5 pr-2 font-medium text-ink-100">
                <AvatarIcon avatarId={data.candidate.avatarId} className="h-5 w-5 rounded-full" />
                {data.candidate.name}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-ink-500">
                <UserRound className="h-4 w-4" />
                No candidate yet
              </span>
            )}
          </div>
        )}
      </PageHeader>

      {/* ---------- Before (and during) ---------- */}
      {!ended && (
        <>
          {created && staff && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex items-start gap-3 rounded-xl border border-success-line bg-success-soft p-4"
            >
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              <div>
                <p className="text-sm font-semibold text-success">Your interview is ready.</p>
                <p className="mt-0.5 text-sm text-success">
                  {solo
                    ? "Open the room and start whenever you like."
                    : "Send the candidate link (and the interviewer link to your panel). When it's time, open the lobby and start."}
                </p>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className={SECTION}>
              <h2 className="text-sm font-semibold text-ink-100">
                {data.questions.length} question{data.questions.length === 1 ? "" : "s"} · {formatDuration(data.durationMs)}
              </h2>
              {staff ? (
                <ol className="mt-4 space-y-2">
                  {data.questions.map((q, i) => {
                    const p = q.problemSlug ? getProblem(q.problemSlug) : null;
                    return (
                      <li key={i} className="flex items-center gap-3 rounded-lg border border-ink-800 px-3 py-2.5">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-ink-700 text-[11px] font-semibold text-ink-300">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-ink-100">{questionTitle(q, i)}</p>
                          <p className="truncate text-[11px] text-ink-500">{p ? p.topics.join(" · ") : "Your own question"}</p>
                        </div>
                        {p && <DifficultyBadge difficulty={p.difficulty} />}
                        <span className="shrink-0 font-[family-name:var(--font-mono)] text-xs text-ink-400">{q.minutes}m</span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-ink-400">
                  The questions are revealed one at a time once the interview starts. Each one has its own time budget.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {[
                  ["Hints", data.settings.hints],
                  ["Test runs", data.settings.runTests],
                  ["Lens", data.settings.lens],
                  ["Big-O meter", data.settings.meter],
                  ...(solo ? [] : [["Monitoring", data.settings.monitoring] as const]),
                ].map(([label, on]) => (
                  <span
                    key={String(label)}
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${on ? "border-ink-600 text-ink-200" : "border-ink-800 text-ink-500 line-through"}`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </section>

            <div className="space-y-6">
              {staff && !solo && data.codes && (
                <section className={SECTION}>
                  <InterviewLinks interview={data} />
                </section>
              )}
              {!staff && data.settings.monitoring && (
                <section className={`${SECTION} flex items-start gap-3`}>
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-ink-200" />
                  <p className="text-sm leading-relaxed text-ink-400">
                    This interview is monitored: your interviewers will see tab switches, pastes, large insertions,
                    other tabs and dropped connections. Never your screen or camera.
                  </p>
                </section>
              )}
              <Link
                href={`/room/${data.roomId}`}
                className="flex h-12 items-center justify-center gap-2 rounded-lg bg-ink-100 text-sm font-semibold text-ink-950 shadow-xs transition-all hover:bg-ink-200 active:scale-[0.99]"
              >
                {live ? "Join the live interview" : staff ? "Open the lobby" : "Go to the interview room"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </>
      )}

      {/* ---------- After: the report ---------- */}
      {ended && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {verdict ? (
              <div className={`rounded-xl border px-4 py-3 ${verdict.score >= 3 ? "border-success-line bg-success-soft" : "border-danger-line bg-danger-soft"}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${verdict.score >= 3 ? "text-success" : "text-danger"}`}>
                  Verdict
                </p>
                <p className={`mt-1 truncate text-lg font-semibold ${verdict.score >= 3 ? "text-success" : "text-danger"}`}>{verdict.label}</p>
                <p className={`mt-0.5 truncate text-[11px] ${verdict.score >= 3 ? "text-success" : "text-danger"}`}>
                  {scorecards.length > 1 ? `Average of ${scorecards.length} scorecards` : "From the scorecard"}
                </p>
              </div>
            ) : (
              <Stat label="Verdict" value="–" note="No scorecards yet" />
            )}
            <Stat label="Time used" value={formatClock(used)} note={`of ${formatClock(data.durationMs + data.extraMs)}`} />
            <Stat label="Questions" value={`${reached}/${data.questions.length}`} note="reached" />
            <Stat label="Passing" value={`${passing}/${data.questions.length}`} note="all tests passed" />
            <Stat label="Hints" value={String(hints)} note="given in total" />
            {monitored ? (
              <Stat label="Integrity" value={String(integrity.flags.length)} note={integrity.flags.length ? "things to review" : "nothing unusual"} />
            ) : (
              <Stat label="Scorecards" value={String(scorecards.length)} note={solo ? "self-review" : `of ${data.interviewers.length}`} />
            )}
          </div>

          {/* Each question */}
          <section className="mt-8">
            <div className="flex gap-1.5 overflow-x-auto pb-1 print:hidden">
              {data.questions.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setTab(i);
                    setPicked(null);
                    setShowAnswer(false);
                  }}
                  className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    i === tab ? "border-ink-100 bg-ink-100 text-ink-950" : "border-ink-800 text-ink-300 hover:border-ink-600"
                  }`}
                >
                  <span className="block font-semibold">Q{i + 1}</span>
                  <span className="block max-w-[11rem] truncate opacity-80">{questionTitle(q, i)}</span>
                </button>
              ))}
            </div>

            {question && (
              <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                <div className={SECTION}>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink-100">{questionTitle(question, tab)}</h2>
                    {problem ? <DifficultyBadge difficulty={problem.difficulty} /> : !question.hidden && <span className="text-[11px] text-ink-500">Your own question</span>}
                  </div>
                  {question.hidden ? (
                    <p className="mt-3 text-sm text-ink-500">The interview didn&apos;t reach this question.</p>
                  ) : (
                    <>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {[
                          ["Time", `${formatDuration(question.timeSpentMs)} / ${question.minutes}m`],
                          ["Hints", String(question.hintsGiven)],
                          ["Tests", run ? `${run.passed}/${run.total}` : "Never run"],
                          ["Big-O", complexity?.time ?? "–"],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-lg border border-ink-800 bg-ink-950 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wider text-ink-500">{label}</p>
                            <p className="mt-0.5 font-[family-name:var(--font-mono)] text-sm tabular-nums text-ink-100">{value}</p>
                          </div>
                        ))}
                      </div>
                      {kit && (
                        <p className="mt-2 text-[11px] text-ink-500">
                          {complexity && sameComplexity(complexity.time, kit.time) ? "✓ Matched the target complexity" : `Target complexity: ${kit.time}`}
                        </p>
                      )}
                      {question.prompt && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-400">{question.prompt}</p>}
                      {staff && (kit || question.answer) && (
                        <div className="mt-4 print:hidden">
                          <button type="button" onClick={() => setShowAnswer((s) => !s)} className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-100">
                            {showAnswer ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            {showAnswer ? "Hide the answer key" : "Show the answer key"}
                          </button>
                          {showAnswer && (
                            <p className="mt-2 whitespace-pre-wrap rounded-lg border border-ink-800 bg-ink-950 p-3 text-xs leading-relaxed text-ink-300">
                              {kit ? `${kit.approach} (${kit.time} time, ${kit.space} space)` : question.answer}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="flex min-h-[22rem] flex-col overflow-hidden rounded-xl border border-ink-800 bg-ink-900">
                  <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-4 py-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
                      <Code2 className="h-4 w-4 text-ink-400" />
                      {shown ? `Code at ${shown.label.toLowerCase()}` : "Final code"}
                    </h3>
                    {shown && <span className="font-[family-name:var(--font-mono)] text-xs text-ink-500">{formatClock(shown.at)}</span>}
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto bg-ink-950/60 py-3">
                    <pre className="font-[family-name:var(--font-mono)] text-[12.5px] leading-6 text-ink-200">
                      {(shown ? shown.code : (question.code ?? "")).split("\n").map((line, i) => (
                        <div key={i} className="flex">
                          <span className="w-12 shrink-0 select-none pr-4 text-right tabular-nums text-ink-600">{i + 1}</span>
                          <code className="whitespace-pre pr-4">{line || " "}</code>
                        </div>
                      ))}
                    </pre>
                  </div>
                  {snapshots.length > 0 && (
                    <div className="flex gap-1.5 overflow-x-auto border-t border-ink-800 px-3 py-2 print:hidden">
                      {snapshots.map((snapshot, i) => (
                        <button
                          key={`${snapshot.at}-${i}`}
                          type="button"
                          onClick={() => setPicked(i)}
                          className={`shrink-0 rounded-md border px-2 py-1 text-[11px] transition-colors ${
                            picked === i ? "border-ink-100 bg-ink-100 text-ink-950" : "border-ink-700 text-ink-400 hover:border-ink-500 hover:text-ink-100"
                          }`}
                        >
                          {formatClock(snapshot.at)} · {snapshot.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setPicked(null)}
                        className={`shrink-0 rounded-md border px-2 py-1 text-[11px] transition-colors ${
                          picked === null ? "border-ink-100 bg-ink-100 text-ink-950" : "border-ink-700 text-ink-400 hover:border-ink-500 hover:text-ink-100"
                        }`}
                      >
                        Final
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Scorecards */}
          <section className="mt-8">
            <h2 className="text-sm font-semibold text-ink-100">{solo ? "Self-review" : "Scorecards"}</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {scorecards.map((card) => {
                const option = INTERVIEW_VERDICTS.find((choice) => choice.id === card.verdict);
                const good = (option?.score ?? 0) >= 3;
                return (
                  <div key={card.interviewerId} className={SECTION}>
                    <div className="flex items-center gap-2.5">
                      <AvatarIcon avatarId={card.avatarId} className="h-8 w-8 rounded-full" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink-100">{card.interviewerId === userId ? "You" : card.name}</p>
                        <p className="text-[11px] text-ink-500">{new Date(card.at).toLocaleDateString(undefined, { dateStyle: "medium" })}</p>
                      </div>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${
                          good ? "border-success-line bg-success-soft text-success" : "border-danger-line bg-danger-soft text-danger"
                        }`}
                      >
                        {option?.label}
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {INTERVIEW_CRITERIA.map((criterion, i) => {
                        const rating = card.ratings?.[criterion.id] ?? 0;
                        return (
                          <div key={criterion.id}>
                            <div className="mb-1 flex items-baseline justify-between text-xs">
                              <span className="text-ink-300">{criterion.label}</span>
                              <span className="text-ink-500">{RATING_LABELS[rating - 1] ?? "–"}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(rating / 4) * 100}%` }}
                                transition={{ delay: 0.15 + i * 0.06, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                className="h-full rounded-full bg-ink-100"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {card.feedback && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-300">{card.feedback}</p>}
                    {card.interviewerId === userId && (
                      <button type="button" onClick={() => setScoring(true)} className="mt-3 text-xs text-ink-400 underline-offset-4 hover:text-ink-100 hover:underline print:hidden">
                        Edit
                      </button>
                    )}
                  </div>
                );
              })}
              {staff && !mine && (
                <button
                  type="button"
                  onClick={() => setScoring(true)}
                  className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-700 text-sm text-ink-300 transition-colors hover:border-ink-500 hover:text-ink-100 print:hidden"
                >
                  <Plus className="h-5 w-5" />
                  {solo ? "Review yourself" : "Add your scorecard"}
                </button>
              )}
              {!staff && scorecards.length === 0 && <p className="text-sm text-ink-500">No scorecards yet.</p>}
            </div>
          </section>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* What monitoring saw (interviewers only) */}
            {monitored && (
              <section className={SECTION}>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
                  {integrity.flags.length ? (
                    <ShieldAlert className="h-4 w-4 text-warning" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-success" />
                  )}
                  Integrity
                  <span className="text-xs font-normal text-ink-500">· interviewers only</span>
                </h2>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    ["Tab switches", String(integrity.tabSwitches)],
                    ["Time away", formatDuration(integrity.awayMs)],
                    ["Pastes", String(integrity.pastes)],
                    ["Largest paste", integrity.largestPaste ? `${integrity.largestPaste}` : "–"],
                    ["Insertions", String(integrity.inserts)],
                    ["Tabs / drops", `${integrity.extraTabs} / ${integrity.drops}`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-ink-800 bg-ink-950 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-ink-500">{label}</p>
                      <p className="mt-0.5 font-[family-name:var(--font-mono)] text-sm tabular-nums text-ink-100">{value}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-ink-500">
                  {integrity.consented ? "The candidate acknowledged monitoring before it started." : "The candidate didn't acknowledge monitoring."}
                </p>
                {integrity.flags.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {integrity.flags.map((event, i) => (
                      <li key={i} className="flex gap-3 text-xs">
                        <span className="w-11 shrink-0 font-[family-name:var(--font-mono)] tabular-nums text-ink-500">{formatClock(event.at)}</span>
                        <span className="min-w-0 flex-1 text-ink-300">{describeMonitor(event)}</span>
                        <span className="shrink-0 text-[10px] text-ink-600">Q{(event.question ?? 0) + 1}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* The panel's notes */}
            {staff && !solo && (data.notes ?? []).length > 0 && (
              <section className={SECTION}>
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-100">
                  <Lock className="h-3.5 w-3.5 text-ink-500" />
                  Notes
                  <span className="text-xs font-normal text-ink-500">· interviewers only</span>
                </h2>
                <ul className="mt-3 space-y-2.5">
                  {data.notes.map((note, i) => (
                    <li key={i} className="text-sm">
                      <p className="text-[10px] text-ink-500">
                        <span className="font-[family-name:var(--font-mono)] tabular-nums">{formatClock(note.at)}</span> · Q{note.question + 1} ·{" "}
                        {note.authorName}
                      </p>
                      <p className="mt-0.5 text-ink-300">
                        {note.tag && note.tag !== "follow-up" && <span className="mr-1 text-ink-500">{note.tag}</span>}
                        {note.text}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Everything that happened */}
            <section className={SECTION}>
              <h2 className="text-sm font-semibold text-ink-100">Timeline</h2>
              <ol className="mt-3 space-y-1">
                {data.events
                  .filter((event) => event.type !== "monitor" && event.type !== "phase")
                  .map((event, i) => {
                    const Icon = EVENT_ICONS[event.type] ?? Play;
                    return (
                      <li key={i} className="flex items-center gap-3 py-1 text-sm">
                        <span className="w-11 shrink-0 font-[family-name:var(--font-mono)] text-xs tabular-nums text-ink-500">{formatClock(event.at)}</span>
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-ink-700 bg-ink-950 text-ink-300">
                          <Icon className="h-3 w-3" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-ink-200">{describe(event)}</span>
                        {data.questions.length > 1 && <span className="shrink-0 text-[10px] text-ink-600">Q{(event.question ?? 0) + 1}</span>}
                      </li>
                    );
                  })}
              </ol>
            </section>
          </div>
        </>
      )}

      {staff && ended && (
        <Scorecard
          open={scoring}
          interview={data}
          canShare={organizer}
          initial={mine ? { ratings: mine.ratings, verdict: mine.verdict, feedback: mine.feedback, shared: data.shared } : { shared: data.shared || true }}
          onClose={() => setScoring(false)}
          onSave={saveScorecard}
        />
      )}
    </PageContainer>
  );
}