"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
import { formatDuration, panelVerdict, type InterviewSummary } from "@/lib/interview";

export type InterviewGroup = "live" | "upcoming" | "past";

export function groupOf(item: InterviewSummary): InterviewGroup {
  if (item.status === "running" || item.status === "paused") return "live";
  return item.status === "scheduled" ? "upcoming" : "past";
}

// The badge on the right: what this interview is, or what came of it.
function Status({ item }: { item: InterviewSummary }) {
  const group = groupOf(item);
  const verdict = panelVerdict(item.verdicts);
  if (group === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-success-line bg-success-soft px-1.5 py-0.5 text-[11px] font-medium text-success">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-strong opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success-strong" />
        </span>
        Live
      </span>
    );
  }
  if (group === "upcoming") return <span className="rounded-md border border-ink-800 bg-ink-950 px-1.5 py-0.5 text-[11px] font-medium text-ink-400">Upcoming</span>;
  if (verdict) {
    const good = verdict.score >= 3;
    return (
      <span
        className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${
          good ? "border-success-line bg-success-soft text-success" : "border-danger-line bg-danger-soft text-danger"
        }`}
      >
        {item.role === "interviewer" ? verdict.label : "Report shared"}
      </span>
    );
  }
  return (
    <span className="rounded-md border border-ink-800 bg-ink-950 px-1.5 py-0.5 text-[11px] font-medium text-ink-500">
      {item.role === "interviewer" ? "Needs scorecard" : "Awaiting feedback"}
    </span>
  );
}

// An interview in a list: when, what, who, and where it stands. Live ones
// open the room; the rest open the interview's page.
export function InterviewRow({ item }: { item: InterviewSummary }) {
  const group = groupOf(item);
  const href = group === "live" ? `/room/${item.roomId}` : `/interviews/${item.id}`;
  const iso = group === "upcoming" ? item.scheduledFor : group === "past" ? item.endedAt : null;
  const date = iso ? new Date(iso) : null;
  const who =
    item.mode === "solo"
      ? "Mock interview"
      : item.role === "candidate"
        ? `With ${item.interviewers[0]?.name ?? "your interviewer"}`
        : item.candidate
          ? `Candidate: ${item.candidate.name}`
          : "No candidate yet";

  return (
    <Link href={href} className="group flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-ink-950 sm:px-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-ink-800 bg-ink-950 text-center leading-none group-hover:bg-ink-900">
        {group === "live" ? (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-strong opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success-strong" />
          </span>
        ) : date ? (
          <span>
            <span className="block text-[9px] font-semibold uppercase tracking-wider text-ink-500">
              {date.toLocaleDateString(undefined, { month: "short" })}
            </span>
            <span className="block text-sm font-semibold tabular-nums text-ink-100">{date.getDate()}</span>
          </span>
        ) : (
          <span className="text-[10px] font-medium text-ink-500">TBD</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink-100">
          {item.title}
          {item.position && <span className="font-normal text-ink-500"> · {item.position}</span>}
        </span>
        <span className="block truncate text-xs text-ink-500">
          {who} · {item.questionCount} question{item.questionCount === 1 ? "" : "s"} · {formatDuration(item.durationMs)}
          {group === "upcoming" && date && ` · ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
        </span>
      </span>
      {item.mode === "live" && (
        <span className="hidden shrink-0 -space-x-1.5 sm:flex">
          {[...item.interviewers.slice(0, 2), ...(item.candidate ? [item.candidate] : [])].map((person, i) => (
            <AvatarIcon key={`${person.userId}-${i}`} avatarId={person.avatarId} className="h-6 w-6 rounded-full ring-2 ring-ink-900" />
          ))}
        </span>
      )}
      <Status item={item} />
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-600 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-400" />
    </Link>
  );
}