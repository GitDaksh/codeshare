"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useApi } from "@/lib/api";
import { AvatarIcon } from "@/components/AvatarIcon";
import { panelVerdict, type InterviewSummary } from "@/lib/interview";

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
}

// The dashboard's list of your interviews (as interviewer, candidate, or
// solo). Shows nothing until you've had one.
export function InterviewList() {
  const api = useApi();
  const [items, setItems] = useState<InterviewSummary[] | null>(null);

  useEffect(() => {
    api
      .get<InterviewSummary[]>("/api/interviews")
      .then((res) => setItems(res.data))
      .catch(() => setItems([]));
  }, [api]);

  if (!items?.length) return null;

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink-100">
          Interviews
          <span className="rounded-md border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-ink-300">
            {items.length}
          </span>
        </h2>
        <Link href="/interviews" className="text-xs text-ink-400 transition-colors hover:text-ink-100">
          See all
        </Link>
      </div>
      <div className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {items.slice(0, 12).map((item) => {
          const live = item.status === "running" || item.status === "paused";
          const verdict = panelVerdict(item.verdicts);
          const who =
            item.mode === "solo"
              ? "Mock interview"
              : item.role === "interviewer"
                ? item.candidate
                  ? `You interviewed ${item.candidate.name}`
                  : "Waiting for a candidate"
                : `Interviewed by ${item.interviewers[0]?.name ?? "someone"}`;
          const other = item.role === "interviewer" ? item.candidate : item.interviewers[0];
          return (
            <Link
              key={item.id}
              href={live ? `/room/${item.roomId}` : `/interviews/${item.id}`}
              className="group flex w-64 shrink-0 snap-start flex-col rounded-xl border border-ink-700 bg-ink-900 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:border-ink-500"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="truncate text-sm font-semibold text-ink-100">{item.title}</span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-500 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink-100" />
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-400">
                {item.mode === "live" && other && <AvatarIcon avatarId={other.avatarId} className="h-4 w-4 rounded-full" />}
                <span className="truncate">{who}</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span
                  className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                    live
                      ? "border-ink-100 bg-ink-100 text-ink-950"
                      : verdict
                        ? "border-ink-600 bg-ink-800 text-ink-100"
                        : "border-ink-700 text-ink-400"
                  }`}
                >
                  {live ? "Live now" : item.status === "scheduled" ? "Upcoming" : (verdict?.label ?? "Awaiting feedback")}
                </span>
                <span className="truncate text-ink-500">{when(item.scheduledFor ?? item.startedAt ?? item.createdAt)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}