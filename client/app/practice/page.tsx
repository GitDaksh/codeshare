"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, ChevronRight, Circle, Dices, Search, SearchX, X } from "lucide-react";
import { useApi } from "@/lib/api";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { PageContainer, PageHeader } from "@/components/PageHeader";
import { Segmented } from "@/components/Segmented";
import { DIFFICULTIES, PROBLEMS, TOPICS, type Difficulty } from "@/lib/problems";
import { ui } from "@/lib/ui";
import type { Profile } from "@/types/profile";

type DifficultyFilter = "All" | Difficulty;
type StatusFilter = "all" | "todo" | "solved";

const BAR: Record<Difficulty, string> = { Easy: "bg-success-strong", Medium: "bg-warning-strong", Hard: "bg-danger-strong" };

export default function PracticePage() {
  const api = useApi();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [solved, setSolved] = useState<Set<string>>(() => new Set());
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("All");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [topic, setTopic] = useState("");

  useEffect(() => {
    document.title = "Practice — CodeShare";
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    api
      .get<Profile>("/api/profile")
      .then((res) => {
        if (!cancelled) setSolved(new Set((res.data.solvedProblems ?? []).map((s) => s.slug)));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setProgressLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [api, isLoaded, isSignedIn]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PROBLEMS.filter((p) => {
      if (difficulty !== "All" && p.difficulty !== difficulty) return false;
      if (topic && !p.topics.includes(topic)) return false;
      if (status === "solved" && !solved.has(p.slug)) return false;
      if (status === "todo" && solved.has(p.slug)) return false;
      if (q && !p.title.toLowerCase().includes(q) && !p.topics.some((t) => t.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [query, difficulty, topic, status, solved]);

  const topicCounts = useMemo(
    () => new Map(TOPICS.map((t) => [t, PROBLEMS.filter((p) => p.topics.includes(t)).length])),
    []
  );

  const stats = DIFFICULTIES.map((d) => {
    const inLevel = PROBLEMS.filter((p) => p.difficulty === d);
    return { difficulty: d, total: inLevel.length, solved: inLevel.filter((p) => solved.has(p.slug)).length };
  });
  const solvedCount = PROBLEMS.filter((p) => solved.has(p.slug)).length;
  const hasFilters = query !== "" || difficulty !== "All" || status !== "all" || topic !== "";

  function clearFilters() {
    setQuery("");
    setDifficulty("All");
    setStatus("all");
    setTopic("");
  }

  // "Pick one for me": a random problem you haven't solved yet, from the
  // ones your filters show (or any, if they show none).
  function pickForMe() {
    const pool = filtered.filter((p) => !solved.has(p.slug));
    const fallback = PROBLEMS.filter((p) => !solved.has(p.slug));
    const choices = pool.length ? pool : fallback.length ? fallback : PROBLEMS;
    const pick = choices[Math.floor(Math.random() * choices.length)];
    router.push(`/practice/${pick.slug}`);
  }

  return (
    <PageContainer>
      <PageHeader
        title="Practice"
        description="100 classic interview problems with instant tests in JavaScript, TypeScript and Python. Solve one alone, or share the room with a friend."
        actions={
          <button type="button" onClick={pickForMe} className={ui.secondary}>
            <Dices className="h-4 w-4" />
            Pick one for me
          </button>
        }
      />

      {/* ---------- Progress ---------- */}
      {!isLoaded ? (
        <div className="h-[74px] animate-pulse rounded-xl border border-ink-800 bg-ink-950" />
      ) : isSignedIn ? (
        <div className={`${ui.card} grid grid-cols-2 gap-x-6 gap-y-4 p-4 sm:grid-cols-4 sm:p-5`}>
          <div>
            <p className="text-xs font-medium text-ink-500">Solved</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-ink-100">
              {progressLoaded ? solvedCount : "–"}
              <span className="text-sm font-normal text-ink-500"> / {PROBLEMS.length}</span>
            </p>
          </div>
          {stats.map((s) => (
            <div key={s.difficulty}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-medium text-ink-500">{s.difficulty}</span>
                <span className="tabular-nums text-ink-400">
                  {progressLoaded ? s.solved : "–"} / {s.total}
                </span>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink-800">
                <motion.div
                  className={`h-full rounded-full ${BAR[s.difficulty]}`}
                  initial={{ width: 0 }}
                  animate={{ width: progressLoaded ? `${(s.solved / Math.max(s.total, 1)) * 100}%` : 0 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`${ui.card} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5`}>
          <div>
            <p className="text-sm font-medium text-ink-100">Track your progress</p>
            <p className="mt-0.5 text-sm text-ink-500">Sign in to save the problems you solve and open rooms to solve them in.</p>
          </div>
          <Link href="/sign-in?redirect_url=/practice" className={ui.primary}>
            Sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* ---------- Filters ---------- */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] flex-1">
          <span className="sr-only">Search problems</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search problems or topics"
            className={`${ui.input} pl-9 pr-9`}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-500 transition-colors hover:text-ink-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
        <Segmented
          id="practice-difficulty"
          value={difficulty}
          onChange={setDifficulty}
          options={[{ value: "All" as DifficultyFilter, label: "All" }, ...DIFFICULTIES.map((d) => ({ value: d as DifficultyFilter, label: d }))]}
        />
        {isSignedIn && (
          <Segmented
            id="practice-status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "Any status" },
              { value: "todo", label: "To do" },
              { value: "solved", label: "Solved" },
            ]}
          />
        )}
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          aria-label="Topic"
          className="h-9 w-44 rounded-lg border border-ink-700 bg-ink-900 px-2.5 text-sm text-ink-100 shadow-xs transition-colors focus:border-ink-500 focus:outline-none"
        >
          <option value="">All topics</option>
          {TOPICS.map((t) => (
            <option key={t} value={t}>
              {t} ({topicCounts.get(t)})
            </option>
          ))}
        </select>
        {hasFilters && (
          <button type="button" onClick={clearFilters} className={ui.ghost}>
            <X className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>

      {/* ---------- List ---------- */}
      <div className={`${ui.card} mt-3 overflow-hidden`}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-ink-800 bg-ink-950">
              <SearchX className="h-5 w-5 text-ink-400" />
            </div>
            <p className="mt-1 text-sm font-medium text-ink-100">No problems match those filters</p>
            <button type="button" onClick={clearFilters} className={`${ui.secondarySm} mt-2`}>
              Clear filters
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-ink-800">
            {filtered.map((p) => {
              const isSolved = solved.has(p.slug);
              const number = PROBLEMS.indexOf(p) + 1;
              return (
                <li key={p.slug}>
                  <Link
                    href={`/practice/${p.slug}`}
                    className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-950 sm:gap-4 sm:px-5"
                  >
                    {isSolved ? (
                      <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-success" aria-label="Solved" />
                    ) : (
                      <Circle className="h-[18px] w-[18px] shrink-0 text-ink-700" aria-hidden="true" />
                    )}
                    <span className="hidden w-6 shrink-0 font-[family-name:var(--font-mono)] text-xs tabular-nums text-ink-500 sm:block">
                      {String(number).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-100">{p.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-ink-500">{p.summary}</span>
                    </span>
                    <span className="hidden shrink-0 items-center gap-1.5 lg:flex">
                      {p.topics.slice(0, 2).map((t) => (
                        <span key={t} className={ui.badge}>
                          {t}
                        </span>
                      ))}
                    </span>
                    <DifficultyBadge difficulty={p.difficulty} />
                    <ChevronRight className="hidden h-4 w-4 shrink-0 text-ink-600 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-400 sm:block" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-ink-500">
        {hasFilters ? `Showing ${filtered.length} of ${PROBLEMS.length} problems` : `${PROBLEMS.length} problems`}
      </p>
    </PageContainer>
  );
}