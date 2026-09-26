"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Circle, Search, SearchX, X } from "lucide-react";
import { useApi } from "@/lib/api";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { DIFFICULTIES, PROBLEMS, TOPICS, type Difficulty } from "@/lib/problems";
import type { Profile } from "@/types/profile";

type DifficultyFilter = "All" | Difficulty;
type StatusFilter = "all" | "todo" | "solved";

const DIFFICULTY_OPTIONS: { value: DifficultyFilter; label: string }[] = [
  { value: "All", label: "All" },
  ...DIFFICULTIES.map((d) => ({ value: d, label: d })),
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "todo", label: "To do" },
  { value: "solved", label: "Solved" },
];

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  layoutId,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  layoutId: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex shrink-0 rounded-xl border border-ink-700 bg-ink-900 p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className="relative flex-1 rounded-lg px-3 py-1.5 text-xs font-medium sm:flex-none"
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg bg-ink-800 ring-1 ring-ink-700"
                transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
              />
            )}
            <span className={`relative transition-colors ${active ? "text-ink-100" : "text-ink-400 hover:text-ink-100"}`}>
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function PracticePage() {
  const api = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const [solved, setSolved] = useState<Set<string>>(() => new Set());
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("All");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [topic, setTopic] = useState<string | null>(null);

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

  const stats = DIFFICULTIES.map((d) => {
    const inLevel = PROBLEMS.filter((p) => p.difficulty === d);
    return { difficulty: d, total: inLevel.length, solved: inLevel.filter((p) => solved.has(p.slug)).length };
  });
  const solvedCount = PROBLEMS.filter((p) => solved.has(p.slug)).length;
  const hasFilters = query !== "" || difficulty !== "All" || status !== "all" || topic !== null;

  function clearFilters() {
    setQuery("");
    setDifficulty("All");
    setStatus("all");
    setTopic(null);
  }

  return (
    <main className="relative min-h-[calc(100dvh-56px)] overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-10 sm:pt-14">
        {/* ---------- Header + progress ---------- */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-400">Practice</p>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink-100 sm:text-4xl">
              Sharpen your problem-solving
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-400 sm:text-base">
              Classic interview problems with instant tests in JavaScript, TypeScript, and Python. Solve on your own,
              or share the room link and work through it together.
            </p>
          </div>

          {!isLoaded ? (
            <div className="h-[168px] animate-pulse rounded-2xl border border-ink-800 bg-ink-900" />
          ) : isSignedIn ? (
            <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wider text-ink-400">Your progress</p>
                {progressLoaded && (
                  <p className="text-xs tabular-nums text-ink-500">
                    {Math.round((solvedCount / PROBLEMS.length) * 100)}%
                  </p>
                )}
              </div>
              {progressLoaded ? (
                <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums text-ink-100">
                  {solvedCount}
                  <span className="text-lg text-ink-500"> / {PROBLEMS.length}</span>
                </p>
              ) : (
                <div className="mt-2 h-9 w-24 animate-pulse rounded-lg bg-ink-800" />
              )}
              <div className="mt-4 space-y-2.5">
                {stats.map((s) => (
                  <div key={s.difficulty} className="flex items-center gap-3 text-xs">
                    <span className="w-14 shrink-0 text-ink-400">{s.difficulty}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-800">
                      <motion.div
                        className="h-full rounded-full bg-ink-100"
                        initial={{ width: 0 }}
                        animate={{ width: progressLoaded ? `${(s.solved / Math.max(s.total, 1)) * 100}%` : 0 }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-right tabular-nums text-ink-300">
                      {progressLoaded ? s.solved : "–"}/{s.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-900/60 p-5">
              <p className="text-sm font-medium text-ink-100">Track your progress</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-400">
                Sign in to save the problems you solve and open rooms to solve them with a friend.
              </p>
              <Link
                href="/sign-in?redirect_url=/practice"
                className="group mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-ink-100 px-4 text-sm font-semibold text-ink-950 transition-colors hover:bg-white"
              >
                Sign in
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          )}
        </div>

        {/* ---------- Filters ---------- */}
        <div className="mt-10 flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search problems</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search problems or topics"
              className="h-10 w-full rounded-xl border border-ink-700 bg-ink-900 pl-9 pr-9 text-sm text-ink-100 outline-none transition-colors placeholder:text-ink-500 focus:border-ink-500"
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
          <div className="flex flex-col gap-3 sm:flex-row">
            <Segmented
              label="Difficulty"
              options={DIFFICULTY_OPTIONS}
              value={difficulty}
              onChange={setDifficulty}
              layoutId="practice-difficulty-pill"
            />
            {isSignedIn && (
              <Segmented
                label="Status"
                options={STATUS_OPTIONS}
                value={status}
                onChange={setStatus}
                layoutId="practice-status-pill"
              />
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {[null, ...TOPICS].map((t) => {
            const active = topic === t;
            return (
              <button
                key={t ?? "all"}
                type="button"
                onClick={() => setTopic(active && t !== null ? null : t)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  active
                    ? "border-ink-100 bg-ink-100 font-medium text-ink-950"
                    : "border-ink-700 text-ink-400 hover:border-ink-500 hover:text-ink-100"
                }`}
              >
                {t ?? "All topics"}
              </button>
            );
          })}
        </div>

        {/* ---------- List ---------- */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800">
                <SearchX className="h-5 w-5 text-ink-300" />
              </div>
              <p className="mt-1 text-sm font-medium text-ink-100">No problems match those filters</p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-1 text-xs text-ink-400 underline-offset-4 transition-colors hover:text-ink-100 hover:underline"
              >
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
                      className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-ink-800/50 sm:gap-4 sm:px-5"
                    >
                      {isSolved ? (
                        <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-ink-100" aria-label="Solved" />
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
                          <span key={t} className="rounded-full border border-ink-800 px-2 py-0.5 text-[11px] text-ink-400">
                            {t}
                          </span>
                        ))}
                      </span>
                      <DifficultyBadge difficulty={p.difficulty} />
                      <ArrowRight className="hidden h-4 w-4 shrink-0 text-ink-600 transition-all group-hover:translate-x-0.5 group-hover:text-ink-100 sm:block" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-ink-500">
          {hasFilters ? `${filtered.length} of ${PROBLEMS.length} problems` : `${PROBLEMS.length} problems`}
        </p>
      </div>
    </main>
  );
}