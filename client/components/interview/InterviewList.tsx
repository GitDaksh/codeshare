"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/api";
import { InterviewRow, groupOf } from "@/components/interview/InterviewRow";
import { ui } from "@/lib/ui";
import type { InterviewSummary } from "@/lib/interview";

// The dashboard's interviews: live and upcoming first, then the latest past
// ones. Shows nothing until you've had one.
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

  const order = { live: 0, upcoming: 1, past: 2 } as const;
  const shown = [...items].sort((a, b) => order[groupOf(a)] - order[groupOf(b)]).slice(0, 5);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
          Interviews
          <span className="rounded bg-ink-800 px-1 text-[10px] tabular-nums text-ink-500">{items.length}</span>
        </h2>
        <Link href="/interviews" className="text-sm font-medium text-ink-500 transition-colors hover:text-ink-100">
          See all
        </Link>
      </div>
      <div className={`${ui.card} divide-y divide-ink-800 overflow-hidden`}>
        {shown.map((item) => (
          <InterviewRow key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}