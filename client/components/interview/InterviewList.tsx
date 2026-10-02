"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useApi } from "@/lib/api";
import { AvatarIcon } from "@/components/AvatarIcon";
import { getProblem } from "@/lib/problems";
import { INTERVIEW_VERDICTS, type InterviewSummary } from "@/lib/interview";

function when(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
      <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink-100">
        Interviews
        <span className="rounded-md border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-ink-300">
          {items.length}
        </span>
      </h2>
      <div className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {items.map((item) => {
          const title = item.customTitle ?? (item.problemSlug ? getProblem(item.problemSlug)?.title : null) ?? "Interview";
          const live = item.status !== "ended";
          const verdict = INTERVIEW_VERDICTS.find((option) => option.id === item.verdict)?.label;
          const who =
            item.mode === "solo"
              ? "Mock interview"
              : item.role === "interviewer"
                ? `You interviewed ${item.candidate.name}`
                : `Interviewed by ${item.interviewer.name}`;
          const other = item.role === "interviewer" ? item.candidate : item.interviewer;
          return (
            <Link
              key={item.id}
              href={live ? `/room/${item.roomId}` : `/interviews/${item.id}`}
              className="group flex w-64 shrink-0 snap-start flex-col rounded-xl border border-ink-700 bg-ink-900 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:border-ink-500"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="truncate text-sm font-semibold text-ink-100">{title}</span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-500 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink-100" />
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-400">
                {item.mode === "live" && <AvatarIcon avatarId={other.avatarId} className="h-4 w-4 rounded-full" />}
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
                  {live ? "In progress" : (verdict ?? "Awaiting feedback")}
                </span>
                <span className="truncate text-ink-500">{when(item.startedAt)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}