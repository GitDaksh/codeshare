"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { ArrowRight, CalendarClock, ClipboardCheck, Plus, ShieldCheck, Timer } from "lucide-react";
import { useApi } from "@/lib/api";
import { PageContainer, PageHeader } from "@/components/PageHeader";
import { Segmented } from "@/components/Segmented";
import { InterviewRow, groupOf, type InterviewGroup } from "@/components/interview/InterviewRow";
import { ui } from "@/lib/ui";
import type { InterviewSummary } from "@/lib/interview";

type StatusFilter = "all" | InterviewGroup;
type RoleFilter = "all" | "interviewer" | "candidate";

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
      (item) => (role === "all" || (item.mode === "live" && item.role === role)) && (status === "all" || groupOf(item) === status)
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
    <PageContainer>
      <PageHeader
        title="Interviews"
        description="Plan and run technical interviews: a lobby, timed questions, hints, shared notes and live tests. Everyone scores, and the report keeps it all."
        actions={
          signedOut ? (
            <Link href="/sign-in?redirect_url=%2Finterviews" className={ui.primary}>
              Sign in to get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link href="/interviews/new?mode=solo" className={ui.secondary}>
                <Timer className="h-4 w-4" />
                Mock interview
              </Link>
              <Link href="/interviews/new" className={ui.primary}>
                <Plus className="h-4 w-4" />
                New interview
              </Link>
            </>
          )
        }
      />

      {/* ---------- How it works (signed out, or nothing yet) ---------- */}
      {(signedOut || empty) && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {FEATURES.map((feature, i) => (
              <div key={feature.title} className={`${ui.card} p-5`}>
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-ink-800 bg-ink-950">
                    <feature.icon className="h-4 w-4 text-ink-300" />
                  </span>
                  <span className="text-xs font-medium text-ink-500">Step {i + 1}</span>
                </div>
                <p className="mt-4 font-semibold text-ink-100">{feature.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{feature.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-ink-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Monitoring is always visible to the candidate: they&apos;re told what&apos;s recorded before it starts.
          </p>
        </>
      )}

      {/* ---------- Yours ---------- */}
      {!signedOut && items === null && (
        <div className={`${ui.card} divide-y divide-ink-800 overflow-hidden`}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3.5 px-5 py-3">
              <span className="h-10 w-10 animate-pulse rounded-lg bg-ink-800" />
              <span className="flex-1 space-y-1.5">
                <span className="block h-3 w-48 animate-pulse rounded bg-ink-800" />
                <span className="block h-2.5 w-32 animate-pulse rounded bg-ink-800" />
              </span>
            </div>
          ))}
        </div>
      )}

      {items && items.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {stats.map((stat) => (
              <div key={stat.label} className={`${ui.card} px-4 py-3`}>
                <p className="text-xs font-medium text-ink-500">{stat.label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-ink-100">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-2">
            <Segmented
              id="interviews-status"
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
              id="interviews-role"
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
            <div className="mt-6 rounded-xl border border-dashed border-ink-700 bg-ink-950 px-6 py-10 text-center">
              <p className="text-sm text-ink-400">Nothing here with these filters.</p>
              <button
                type="button"
                onClick={() => {
                  setStatus("all");
                  setRole("all");
                }}
                className={`${ui.secondarySm} mt-3`}
              >
                Clear filters
              </button>
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.id} className="mt-8">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-100">
                  {group.title}
                  <span className="rounded bg-ink-800 px-1 text-[10px] tabular-nums text-ink-500">{group.items.length}</span>
                </h2>
                <div className={`${ui.card} divide-y divide-ink-800 overflow-hidden`}>
                  {group.items.map((item) => (
                    <InterviewRow key={item.id} item={item} />
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}
    </PageContainer>
  );
}