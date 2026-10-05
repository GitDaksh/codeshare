"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { ArrowRight, CalendarClock, ClipboardCheck, Plus, ShieldCheck, Timer, UserRound, Users } from "lucide-react";
import { useApi } from "@/lib/api";
import { AvatarIcon } from "@/components/AvatarIcon";
import { formatDuration, panelVerdict, type InterviewSummary } from "@/lib/interview";

type Group = "live" | "upcoming" | "past";
type StatusFilter = "all" | Group;
type RoleFilter = "all" | "interviewer" | "candidate";

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98];

const FEATURES = [
  {
    icon: CalendarClock,
    title: "Plan it",
    text: "Pick questions from 100 problems or write your own, set the time for each, schedule it, and invite your candidate and panel.",
  },
  {
    icon: Timer,
    title: "Run it live",
    text: "A lobby, a countdown, one question at a time. Hints, shared notes and live test results, with optional integrity monitoring.",
  },
  {
    icon: ClipboardCheck,
    title: "Decide together",
    text: "Every interviewer scores independently. The report shows each question's code, time, tests and every scorecard.",
  },
];

function groupOf(item: InterviewSummary): Group {
  if (item.status === "running" || item.status === "paused") return "live";
  return item.status === "scheduled" ? "upcoming" : "past";
}

function when(item: InterviewSummary): string {
  const group = groupOf(item);
  const format = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  if (group === "upcoming") return item.scheduledFor ? format(item.scheduledFor) : "Not scheduled · starts when you're ready";
  if (group === "live") return "Happening now";
  return item.endedAt ? new Date(item.endedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  id,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  id: string;
}) {
  return (
    <div className="flex h-9 rounded-lg border border-ink-700 bg-ink-900 p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button key={option.value} type="button" onClick={() => onChange(option.value)} className="relative rounded-md px-3 text-xs font-medium">
            {active && (
              <motion.span
                layoutId={`interviews-${id}`}
                className="absolute inset-0 rounded-md bg-ink-700"
                transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
              />
            )}
            <span className={`relative transition-colors ${active ? "text-ink-100" : "text-ink-400 hover:text-ink-100"}`}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function InterviewCard({ item, index }: { item: InterviewSummary; index: number }) {
  const group = groupOf(item);
  const verdict = panelVerdict(item.verdicts);
  const href = group === "live" ? `/room/${item.roomId}` : `/interviews/${item.id}`;
  const status =
    group === "live"
      ? "Live now"
      : group === "upcoming"
        ? "Upcoming"
        : item.role === "interviewer"
          ? (verdict?.label ?? "Awaiting scorecards")
          : verdict
            ? "Report shared"
            : "Awaiting feedback";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04, ease: EASE }}
    >
      <Link
        href={href}
        className="group flex h-full flex-col rounded-2xl border border-ink-700 bg-ink-900 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:border-ink-500"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink-100">{item.title}</p>
            <p className="mt-0.5 truncate text-xs text-ink-500">
              {[item.mode === "solo" ? "Mock interview" : item.position, item.level].filter(Boolean).join(" · ") || "Interview"}
            </p>
          </div>
          <span
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              group === "live" ? "border-ink-100 bg-ink-100 text-ink-950" : "border-ink-700 text-ink-300"
            }`}
          >
            {group === "live" && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink-950 opacity-50" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ink-950" />
              </span>
            )}
            {status}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {item.interviewers.slice(0, 3).map((person) => (
              <AvatarIcon key={person.userId} avatarId={person.avatarId} className="h-6 w-6 rounded-full ring-2 ring-ink-900" />
            ))}
          </div>
          {item.mode === "live" && (
            <>
              <ArrowRight className="h-3.5 w-3.5 text-ink-600" />
              {item.candidate ? (
                <AvatarIcon avatarId={item.candidate.avatarId} className="h-6 w-6 rounded-full" />
              ) : (
                <span className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-ink-700">
                  <UserRound className="h-3 w-3 text-ink-500" />
                </span>
              )}
              <span className="min-w-0 truncate text-xs text-ink-400">
                {item.role === "candidate" ? "You" : (item.candidate?.name ?? "No candidate yet")}
              </span>
            </>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-[11px] text-ink-500">
          <span className="truncate">{when(item)}</span>
          <span className="shrink-0 tabular-nums">
            {item.questionCount} question{item.questionCount === 1 ? "" : "s"} · {formatDuration(item.durationMs)}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

export default function InterviewsPage() {
  const api = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const [items, setItems] = useState<InterviewSummary[] | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [role, setRole] = useState<RoleFilter>("all");

  useEffect(() => {
    document.title = "Interviews — CodeShare";
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    api
      .get<InterviewSummary[]>("/api/interviews")
      .then((res) => setItems(res.data))
      .catch(() => setItems([]));
  }, [api, isLoaded, isSignedIn]);

  const stats = useMemo(() => {
    const list = items ?? [];
    return [
      { label: "Live now", value: list.filter((i) => groupOf(i) === "live").length },
      { label: "Upcoming", value: list.filter((i) => groupOf(i) === "upcoming").length },
      { label: "You've interviewed", value: list.filter((i) => i.mode === "live" && i.role === "interviewer" && i.status === "ended").length },
      { label: "You've been interviewed", value: list.filter((i) => i.mode === "live" && i.role === "candidate" && i.status === "ended").length },
      { label: "Mock interviews", value: list.filter((i) => i.mode === "solo").length },
    ];
  }, [items]);

  const groups = useMemo(() => {
    const list = (items ?? []).filter(
      (item) =>
        (role === "all" || (item.mode === "live" && item.role === role)) && (status === "all" || groupOf(item) === status)
    );
    const upcoming = list
      .filter((item) => groupOf(item) === "upcoming")
      .sort((a, b) => Date.parse(a.scheduledFor ?? a.createdAt) - Date.parse(b.scheduledFor ?? b.createdAt));
    return [
      { id: "live" as const, title: "Live now", items: list.filter((item) => groupOf(item) === "live") },
      { id: "upcoming" as const, title: "Upcoming", items: upcoming },
      { id: "past" as const, title: "Past", items: list.filter((item) => groupOf(item) === "past") },
    ].filter((group) => group.items.length);
  }, [items, role, status]);

  const signedOut = isLoaded && !isSignedIn;
  const empty = items !== null && items.length === 0;

  return (
    <main className="relative min-h-[calc(100dvh-56px)] overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
      />
      <div className="pointer-events-none absolute left-1/2 top-[-14rem] h-[28rem] w-[56rem] max-w-[140vw] -translate-x-1/2 rounded-full bg-white/[0.05] blur-[130px]" />

      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-10 sm:pt-14">
        {/* ---------- Hero ---------- */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-ink-500">Interviews</p>
          <h1 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink-100 sm:text-5xl">
            Run real technical interviews.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-400 sm:text-base">
            Plan the questions, invite your candidate and your panel, and run it live: one question at a time, with
            hints, shared notes, live test results and integrity monitoring. Everyone scores, and the report keeps it
            all.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            {signedOut ? (
              <Link
                href="/sign-in?redirect_url=%2Finterviews"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-ink-100 px-5 text-sm font-semibold text-ink-950 shadow-[0_0_28px_-8px_rgba(255,255,255,0.6)] transition-all hover:bg-white active:scale-[0.98]"
              >
                Sign in to get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/interviews/new"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-ink-100 px-5 text-sm font-semibold text-ink-950 shadow-[0_0_28px_-8px_rgba(255,255,255,0.6)] transition-all hover:bg-white active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" />
                  New interview
                </Link>
                <Link
                  href="/interviews/new?mode=solo"
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-ink-700 bg-ink-900 px-5 text-sm font-medium text-ink-100 transition-colors hover:border-ink-500"
                >
                  <Timer className="h-4 w-4" />
                  Mock interview
                </Link>
              </>
            )}
          </div>
        </motion.div>

        {/* ---------- How it works (signed out, or nothing yet) ---------- */}
        {(signedOut || empty) && (
          <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.1 + i * 0.08, ease: EASE }}
                className="rounded-2xl border border-ink-800 bg-ink-900/80 p-5"
              >
                <feature.icon className="h-5 w-5 text-ink-200" />
                <p className="mt-4 font-semibold text-ink-100">{feature.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{feature.text}</p>
              </motion.div>
            ))}
          </div>
        )}
        {empty && (
          <p className="mt-6 flex items-center gap-2 text-xs text-ink-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Monitoring is always visible to the candidate: they&apos;re told what&apos;s recorded before it starts.
          </p>
        )}

        {/* ---------- Yours ---------- */}
        {!signedOut && items === null && (
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl border border-ink-800 bg-ink-900" />
            ))}
          </div>
        )}

        {items && items.length > 0 && (
          <>
            <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-ink-800 bg-ink-900 px-4 py-3">
                  <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums text-ink-100">{stat.value}</p>
                  <p className="mt-0.5 text-[11px] text-ink-500">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-2">
              <Segmented
                id="status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all", label: "All" },
                  { value: "live", label: "Live" },
                  { value: "upcoming", label: "Upcoming" },
                  { value: "past", label: "Past" },
                ]}
              />
              <Segmented
                id="role"
                value={role}
                onChange={setRole}
                options={[
                  { value: "all", label: "Any role" },
                  { value: "interviewer", label: "Interviewing" },
                  { value: "candidate", label: "Interviewed" },
                ]}
              />
            </div>

            {groups.length === 0 ? (
              <p className="mt-10 text-sm text-ink-500">Nothing here with these filters.</p>
            ) : (
              groups.map((group) => (
                <section key={group.id} className="mt-10">
                  <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink-100">
                    {group.id === "live" ? <Users className="h-4 w-4 text-ink-400" /> : null}
                    {group.title}
                    <span className="rounded-md border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-ink-300">
                      {group.items.length}
                    </span>
                  </h2>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.items.map((item, i) => (
                      <InterviewCard key={item.id} item={item} index={i} />
                    ))}
                  </div>
                </section>
              ))
            )}
          </>
        )}
      </div>
    </main>
  );
}