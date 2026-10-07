"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, ArrowRight, Check, FileQuestion, FlaskConical, Loader2, Play, Timer, Users } from "lucide-react";
import { useApi } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { PageContainer, PageHeader } from "@/components/PageHeader";
import { Segmented } from "@/components/Segmented";
import { ui } from "@/lib/ui";
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

// How long a solo mock interview lasts, by difficulty.
const MOCK_MINUTES: Record<string, number> = { Easy: 20, Medium: 35, Hard: 45 };

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
  const [mocking, setMocking] = useState(false);

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

  // A solo mock interview: a room for this problem, with the clock running.
  async function handleMockInterview() {
    if (!problem || creating || mocking) return;

    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(`/practice/${problem.slug}`)}`);
      return;
    }

    setMocking(true);
    try {
      const room = await api.post<Room>("/api/rooms", {
        name: problem.title,
        language,
        code: getProblemStarterCode(problem, language) ?? "",
        problemSlug: problem.slug,
      });
      const minutes = MOCK_MINUTES[problem.difficulty] ?? 35;
      await api.post("/api/interviews", {
        roomId: room.data._id,
        mode: "solo",
        title: problem.title,
        questions: [{ problemSlug: problem.slug, minutes, starter: getProblemStarterCode(problem, language) ?? "" }],
        durationMin: minutes,
      });
      router.push(`/room/${room.data._id}`);
    } catch {
      toast("Couldn't start the mock interview. Please try again.", "error");
      setMocking(false);
    }
  }

  if (!problem) {
    return (
      <PageContainer>
        <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl border border-ink-800 bg-ink-950">
            <FileQuestion className="h-5 w-5 text-ink-400" />
          </div>
          <p className="font-semibold text-ink-100">Problem not found</p>
          <p className="max-w-xs text-sm text-ink-500">The link might be mistyped, or the problem was renamed.</p>
          <Link href="/practice" className={`${ui.secondary} mt-2`}>
            Browse problems
          </Link>
        </div>
      </PageContainer>
    );
  }

  const { previous, next } = getAdjacentProblems(problem.slug);
  const mockMinutes = MOCK_MINUTES[problem.difficulty] ?? 35;

  return (
    <PageContainer>
      <PageHeader back={{ href: "/practice", label: "All problems" }} title={problem.title} description={problem.summary}>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <DifficultyBadge difficulty={problem.difficulty} />
          {problem.topics.map((topic) => (
            <span key={topic} className={ui.badge}>
              {topic}
            </span>
          ))}
          {solved && (
            <span className="inline-flex items-center gap-1 rounded-md border border-success-line bg-success-soft px-1.5 py-0.5 text-[11px] font-medium text-success">
              <Check className="h-3 w-3" strokeWidth={3} />
              Solved
            </span>
          )}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
        {/* ---------- Solve it (first on phones, a sticky side card on desktop) ---------- */}
        <aside className="order-first lg:order-none lg:col-start-2 lg:row-start-1">
          <div className={`${ui.card} p-5 lg:sticky lg:top-8`}>
            <p className={ui.sectionTitle}>Solve it</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-500">
              An editor with starter code and {problem.tests.length} tests that run in your browser.
            </p>

            <p className="mb-2 mt-4 text-xs font-medium text-ink-500">Language</p>
            <Segmented
              id="problem-language"
              fill
              value={language}
              onChange={handlePickLanguage}
              options={TESTABLE_LANGUAGES.map((value) => ({ value, label: languageLabel(value) }))}
            />

            <button type="button" onClick={handleStart} disabled={!isLoaded || creating} className={`${ui.primary} mt-4 h-10 w-full`}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {creating ? "Opening room…" : isLoaded && !isSignedIn ? "Sign in to start" : "Start solving"}
            </button>
            <button
              type="button"
              onClick={handleMockInterview}
              disabled={!isLoaded || creating || mocking}
              title="A timed mock interview: hints, live tests, and a report at the end"
              className={`${ui.secondary} mt-2 w-full`}
            >
              {mocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Timer className="h-4 w-4" />}
              {mocking ? "Starting…" : `Mock interview · ${mockMinutes} min`}
            </button>

            <ul className="mt-4 space-y-2 text-sm text-ink-500">
              <li className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 shrink-0 text-ink-400" />
                Tests run instantly in your browser
              </li>
              <li className="flex items-center gap-2">
                <Users className="h-4 w-4 shrink-0 text-ink-400" />
                Invite a friend with the room link
              </li>
            </ul>

            {rooms.length > 0 && (
              <div className="mt-5 border-t border-ink-800 pt-4">
                <p className="text-xs font-medium text-ink-500">Continue where you left off</p>
                <ul className="mt-2 space-y-0.5">
                  {rooms.slice(0, 5).map((r) => (
                    <li key={r._id}>
                      <Link
                        href={`/room/${r._id}`}
                        className="group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-ink-950"
                      >
                        <span className="w-9 shrink-0 rounded-md border border-ink-800 bg-ink-950 py-px text-center font-[family-name:var(--font-mono)] text-[10px] font-semibold text-ink-400">
                          {LANGUAGE_SHORT[r.language] ?? r.language.toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-ink-100">{r.name}</span>
                        <span className="shrink-0 text-xs text-ink-500">{timeAgo(r.updatedAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>

        {/* ---------- The problem ---------- */}
        <article className="min-w-0 lg:col-start-1 lg:row-start-1">
          <ProblemStatement problem={problem} />

          <nav aria-label="More problems" className="mt-12 grid grid-cols-1 gap-3 border-t border-ink-800 pt-6 sm:grid-cols-2">
            {previous ? (
              <Link href={`/practice/${previous.slug}`} className={`${ui.cardHover} group p-4`}>
                <span className="text-xs text-ink-500">Previous</span>
                <span className="mt-1 flex items-center gap-1.5 text-sm font-medium text-ink-100">
                  <ArrowLeft className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:-translate-x-0.5" />
                  <span className="truncate">{previous.title}</span>
                </span>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {next && (
              <Link href={`/practice/${next.slug}`} className={`${ui.cardHover} group p-4 sm:text-right`}>
                <span className="text-xs text-ink-500">Next</span>
                <span className="mt-1 flex items-center gap-1.5 text-sm font-medium text-ink-100 sm:justify-end">
                  <span className="truncate">{next.title}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            )}
          </nav>
        </article>
      </div>
    </PageContainer>
  );
}