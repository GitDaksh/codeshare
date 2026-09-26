"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, ArrowRight, Check, FileQuestion, FlaskConical, Loader2, Play, Users } from "lucide-react";
import { useApi } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { ProblemStatement } from "@/components/ProblemStatement";
import {
  TESTABLE_LANGUAGES,
  getAdjacentProblems,
  getProblem,
  getProblemStarterCode,
  isTestableLanguage,
} from "@/lib/problems";
import { LANGUAGES } from "@/lib/languages";
import type { Profile } from "@/types/profile";
import type { Room } from "@/types/room";

const LANGUAGE_SHORT: Record<string, string> = {
  javascript: "JS",
  typescript: "TS",
  python: "PY",
  cpp: "C++",
  java: "JAVA",
};

function languageLabel(value: string): string {
  return LANGUAGES.find((l) => l.value === value)?.label ?? value;
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function PracticeProblemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const problem = getProblem(slug);
  const api = useApi();
  const router = useRouter();
  const { toast } = useToast();
  const { isLoaded, isSignedIn } = useAuth();

  const [language, setLanguage] = useState<string>("javascript");
  const languageTouchedRef = useRef(false);
  const [solved, setSolved] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    document.title = problem ? `${problem.title} — Practice — CodeShare` : "Problem not found — CodeShare";
  }, [problem]);

  // Signed in: solved state, favorite language, and rooms already started.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !problem) return;
    let cancelled = false;

    api
      .get<Profile>("/api/profile")
      .then((res) => {
        if (cancelled) return;
        setSolved((res.data.solvedProblems ?? []).some((s) => s.slug === problem.slug));
        const favorite = res.data.favoriteLanguage;
        if (!languageTouchedRef.current && isTestableLanguage(favorite)) setLanguage(favorite);
      })
      .catch(() => {});

    api
      .get<Room[]>("/api/rooms", { params: { problem: problem.slug } })
      .then((res) => {
        if (!cancelled) setRooms(res.data.filter((r) => r.problemSlug === problem.slug));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [api, isLoaded, isSignedIn, problem]);

  function handlePickLanguage(value: string) {
    languageTouchedRef.current = true;
    setLanguage(value);
  }

  async function handleStart() {
    if (!problem || creating) return;

    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(`/practice/${problem.slug}`)}`);
      return;
    }

    setCreating(true);
    try {
      const res = await api.post<Room>("/api/rooms", {
        name: problem.title,
        language,
        code: getProblemStarterCode(problem, language) ?? "",
        problemSlug: problem.slug,
      });
      router.push(`/room/${res.data._id}`);
    } catch {
      toast("Couldn't start the problem. Please try again.", "error");
      setCreating(false);
    }
  }

  if (!problem) {
    return (
      <main className="flex min-h-[calc(100dvh-56px)] flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-ink-700 bg-ink-900">
          <FileQuestion className="h-5 w-5 text-ink-300" />
        </div>
        <p className="font-semibold text-ink-100">Problem not found</p>
        <p className="max-w-xs text-sm text-ink-400">The link might be mistyped, or the problem was renamed.</p>
        <Link
          href="/practice"
          className="mt-2 inline-flex h-9 items-center rounded-full border border-ink-700 bg-ink-900 px-4 text-sm text-ink-100 transition-colors hover:border-ink-500"
        >
          Browse problems
        </Link>
      </main>
    );
  }

  const { previous, next } = getAdjacentProblems(problem.slug);

  return (
    <main className="relative min-h-[calc(100dvh-56px)] overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-8 sm:pt-10">
        <Link
          href="/practice"
          className="group inline-flex items-center gap-1.5 text-xs text-ink-400 transition-colors hover:text-ink-100"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          All problems
        </Link>

        {/* ---------- Title ---------- */}
        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-2">
            <DifficultyBadge difficulty={problem.difficulty} size="md" />
            {problem.topics.map((topic) => (
              <span key={topic} className="rounded-full border border-ink-700 px-2.5 py-1 text-xs text-ink-400">
                {topic}
              </span>
            ))}
            {solved && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-950">
                <Check className="h-3 w-3" strokeWidth={3} />
                Solved
              </span>
            )}
          </div>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink-100 sm:text-4xl">
            {problem.title}
          </h1>
          <p className="mt-2 text-sm text-ink-400 sm:text-base">{problem.summary}</p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
          {/* ---------- Start card (first on phones, sticky sidebar on desktop) ---------- */}
          <aside className="order-first lg:order-none lg:col-start-2 lg:row-start-1">
            <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5 lg:sticky lg:top-24">
              <p className="text-sm font-semibold text-ink-100">Solve it in a room</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-400">
                Opens an editor with starter code, this problem, and {problem.tests.length} tests. Share the link to
                solve it together.
              </p>

              <p className="mt-4 text-[11px] font-medium uppercase tracking-wider text-ink-500">Language</p>
              <div role="radiogroup" aria-label="Language" className="mt-2 grid grid-cols-3 gap-1.5">
                {TESTABLE_LANGUAGES.map((value) => {
                  const active = language === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => handlePickLanguage(value)}
                      title={languageLabel(value)}
                      className={`h-9 rounded-lg border text-xs font-medium transition-colors ${
                        active
                          ? "border-ink-100 bg-ink-100 text-ink-950"
                          : "border-ink-700 bg-ink-950/40 text-ink-300 hover:border-ink-500 hover:text-ink-100"
                      }`}
                    >
                      {languageLabel(value)}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleStart}
                disabled={!isLoaded || creating}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink-100 text-sm font-semibold text-ink-950 shadow-[0_0_24px_-10px_rgba(255,255,255,0.6)] transition-all hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {creating ? "Opening room…" : isLoaded && !isSignedIn ? "Sign in to start" : "Start solving"}
              </button>

              <ul className="mt-4 space-y-2 text-xs text-ink-400">
                <li className="flex items-center gap-2">
                  <FlaskConical className="h-3.5 w-3.5 shrink-0 text-ink-500" />
                  Tests run instantly in your browser
                </li>
                <li className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 shrink-0 text-ink-500" />
                  Invite a friend with the room link
                </li>
              </ul>

              {rooms.length > 0 && (
                <div className="mt-5 border-t border-ink-800 pt-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-ink-500">Continue where you left off</p>
                  <ul className="mt-2 space-y-0.5">
                    {rooms.slice(0, 5).map((r) => (
                      <li key={r._id}>
                        <Link
                          href={`/room/${r._id}`}
                          className="group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-ink-800/60"
                        >
                          <span className="w-9 shrink-0 rounded border border-ink-700 bg-ink-800 py-px text-center font-[family-name:var(--font-mono)] text-[10px] text-ink-300">
                            {LANGUAGE_SHORT[r.language] ?? r.language.toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-ink-100">{r.name}</span>
                          <span className="shrink-0 text-[11px] text-ink-500">{timeAgo(r.updatedAt)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </aside>

          {/* ---------- Statement ---------- */}
          <article className="min-w-0 lg:col-start-1 lg:row-start-1">
            <ProblemStatement problem={problem} />

            <nav aria-label="More problems" className="mt-12 grid gap-3 border-t border-ink-800 pt-6 sm:grid-cols-2">
              {previous ? (
                <Link
                  href={`/practice/${previous.slug}`}
                  className="group rounded-xl border border-ink-800 p-4 transition-colors hover:border-ink-600"
                >
                  <span className="text-[11px] text-ink-500">Previous</span>
                  <span className="mt-1 flex items-center gap-1.5 text-sm font-medium text-ink-100">
                    <ArrowLeft className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:-translate-x-0.5" />
                    <span className="truncate">{previous.title}</span>
                  </span>
                </Link>
              ) : (
                <span className="hidden sm:block" />
              )}
              {next && (
                <Link
                  href={`/practice/${next.slug}`}
                  className="group rounded-xl border border-ink-800 p-4 transition-colors hover:border-ink-600 sm:text-right"
                >
                  <span className="text-[11px] text-ink-500">Next</span>
                  <span className="mt-1 flex items-center gap-1.5 text-sm font-medium text-ink-100 sm:justify-end">
                    <span className="truncate">{next.title}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              )}
            </nav>
          </article>
        </div>
      </div>
    </main>
  );
}