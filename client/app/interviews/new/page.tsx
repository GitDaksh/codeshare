"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Dices,
  Loader2,
  Minus,
  PenLine,
  Plus,
  Search,
  ShieldCheck,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useApi } from "@/lib/api";
import { AvatarIcon } from "@/components/AvatarIcon";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { getStarterCode, LANGUAGES } from "@/lib/languages";
import {
  DIFFICULTIES,
  PROBLEMS,
  getProblem,
  getProblemStarterCode,
  isTestableLanguage,
  type Difficulty,
  type Problem,
} from "@/lib/problems";
import { INTERVIEW_LEVELS, formatDuration, type InterviewSettings, type InterviewState } from "@/lib/interview";
import type { Profile } from "@/types/profile";

type Person = { userId: string; username: string; avatarId: string };

type DraftQuestion =
  | { key: string; kind: "problem"; slug: string; minutes: number }
  | { key: string; kind: "custom"; title: string; prompt: string; hints: string[]; answer: string; minutes: number };

const MAX_QUESTIONS = 8;
const MAX_INTERVIEWERS = 3;
const DEFAULT_MINUTES: Record<Difficulty, number> = { Easy: 15, Medium: 25, Hard: 35 };

const TEMPLATES: { id: string; label: string; detail: string; mode: "live" | "solo"; picks: [Difficulty, number][] }[] = [
  { id: "phone", label: "Phone screen", detail: "1 easy · 30 min", mode: "live", picks: [["Easy", 30]] },
  { id: "technical", label: "Technical round", detail: "Easy + medium · 50 min", mode: "live", picks: [["Easy", 20], ["Medium", 30]] },
  { id: "onsite", label: "Onsite loop", detail: "2 medium + hard · 95 min", mode: "live", picks: [["Medium", 30], ["Medium", 30], ["Hard", 35]] },
  { id: "mock", label: "Mock interview", detail: "Just you · 2 questions · 45 min", mode: "solo", picks: [["Easy", 15], ["Medium", 30]] },
];

const SETTINGS: { key: keyof InterviewSettings; label: string; detail: string }[] = [
  { key: "hints", label: "Hints", detail: "Interviewers can reveal hints: a three-step ladder for library problems, or your own." },
  { key: "runTests", label: "Candidate can run the tests", detail: "Library problems come with tests that run in the candidate's browser." },
  { key: "lens", label: "Lens", detail: "The candidate can watch their code run step by step. Off by default: it can make things easier." },
  { key: "meter", label: "Big-O meter", detail: "Measures the candidate's time complexity as they code (you always see it)." },
  {
    key: "monitoring",
    label: "Monitoring",
    detail:
      "Records tab switches (and time away), pastes, large insertions, a second tab and dropped connections. The candidate is told before it starts. Never their screen or camera.",
  },
];

const newKey = () => Math.random().toString(36).slice(2, 10);

// The code a question starts with: the problem's starter, or a comment with
// the title (plus a skeleton for languages that need one).
function starterFor(title: string, language: string, problem: Problem | null): string {
  const fromProblem = problem ? getProblemStarterCode(problem, language) : null;
  if (fromProblem) return fromProblem;
  const header = `${language === "python" ? "#" : "//"} ${title}\n`;
  return language === "cpp" || language === "java" ? `${header}${getStarterCode(language)}` : `${header}\n`;
}

const FIELD =
  "h-10 w-full rounded-xl border border-ink-700 bg-ink-950/60 px-3 text-sm text-ink-100 placeholder:text-ink-500 transition-colors focus:border-ink-500 focus:outline-none";
const LABEL = "mb-1.5 block text-xs font-medium text-ink-300";
const CARD = "rounded-2xl border border-ink-800 bg-ink-900 p-5";

function SectionTitle({ number, title, detail }: { number: number; title: string; detail?: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-ink-700 text-[11px] font-semibold text-ink-300">
        {number}
      </span>
      <div>
        <h2 className="font-semibold text-ink-100">{title}</h2>
        {detail && <p className="mt-0.5 text-xs text-ink-500">{detail}</p>}
      </div>
    </div>
  );
}

// Finds people by username.
function PersonPicker({ placeholder, exclude, onPick }: { placeholder: string; exclude: string[]; onPick: (person: Person) => void }) {
  const api = useApi();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function search(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    const q = value.trim().replace(/^@/, "");
    if (q.length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(() => {
      api
        .get<Person[]>("/api/profile/search", { params: { q } })
        .then((res) => setResults(res.data.filter((person) => !exclude.includes(person.userId))))
        .catch(() => setResults([]));
    }, 250);
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
      <input value={query} onChange={(e) => search(e.target.value)} placeholder={placeholder} className={`${FIELD} pl-9`} />
      {results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-2xl">
          {results.map((person) => (
            <li key={person.userId}>
              <button
                type="button"
                onClick={() => {
                  onPick(person);
                  setQuery("");
                  setResults([]);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink-100 transition-colors hover:bg-ink-800"
              >
                <AvatarIcon avatarId={person.avatarId} className="h-6 w-6 rounded-full" />@{person.username}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PersonChip({ person, onRemove }: { person: Person; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-800 py-0.5 pl-0.5 pr-1 text-xs text-ink-100">
      <AvatarIcon avatarId={person.avatarId} className="h-5 w-5 rounded-full" />@{person.username}
      <button type="button" onClick={onRemove} aria-label={`Remove @${person.username}`} className="rounded-full p-0.5 text-ink-400 hover:text-ink-100">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function Builder() {
  const api = useApi();
  const router = useRouter();
  const startSolo = useSearchParams().get("mode") === "solo";

  const [mode, setMode] = useState<"live" | "solo">(startSolo ? "solo" : "live");
  const [title, setTitle] = useState(startSolo ? "Mock interview" : "");
  const [position, setPosition] = useState("");
  const [level, setLevel] = useState<string>("");
  const [language, setLanguage] = useState("javascript");
  const languageTouched = useRef(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [candidate, setCandidate] = useState<Person | null>(null);
  const [interviewers, setInterviewers] = useState<Person[]>([]);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [settings, setSettings] = useState<InterviewSettings>({ hints: true, runTests: true, lens: false, meter: true, monitoring: true });
  const [panel, setPanel] = useState<"library" | "custom" | null>(null);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "Any">("Any");
  const [custom, setCustom] = useState({ title: "", prompt: "", hints: [""], answer: "", minutes: 20 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "New interview — CodeShare";
    api
      .get<Profile>("/api/profile")
      .then((res) => {
        if (!languageTouched.current && isTestableLanguage(res.data.favoriteLanguage)) setLanguage(res.data.favoriteLanguage);
      })
      .catch(() => {});
  }, [api]);

  const solo = mode === "solo";
  const chosen = new Set(questions.flatMap((q) => (q.kind === "problem" ? [q.slug] : [])));
  const totalMinutes = questions.reduce((sum, q) => sum + q.minutes, 0);
  const library = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return PROBLEMS.filter(
      (problem) =>
        (difficulty === "Any" || problem.difficulty === difficulty) &&
        (!needle || problem.title.toLowerCase().includes(needle) || problem.topics.some((t) => t.toLowerCase().includes(needle)))
    );
  }, [difficulty, query]);

  const missing = [
    ...(title.trim() ? [] : ["a title"]),
    ...(questions.length ? [] : ["at least one question"]),
    ...(totalMinutes > 300 ? ["a total under 5 hours"] : []),
  ];

  function applyTemplate(template: (typeof TEMPLATES)[number]) {
    const picked = new Set<string>();
    const next: DraftQuestion[] = template.picks.flatMap(([level, minutes]) => {
      const pool = PROBLEMS.filter((problem) => problem.difficulty === level && !picked.has(problem.slug));
      const problem = pool[Math.floor(Math.random() * pool.length)];
      if (!problem) return [];
      picked.add(problem.slug);
      return [{ key: newKey(), kind: "problem" as const, slug: problem.slug, minutes }];
    });
    setMode(template.mode);
    setQuestions(next);
    setTitle(template.label);
    setPanel(null);
  }

  function addProblem(problem: Problem) {
    if (questions.length >= MAX_QUESTIONS || chosen.has(problem.slug)) return;
    setQuestions((prev) => [...prev, { key: newKey(), kind: "problem", slug: problem.slug, minutes: DEFAULT_MINUTES[problem.difficulty] }]);
  }

  function surprise() {
    const pool = library.filter((problem) => !chosen.has(problem.slug));
    if (pool.length) addProblem(pool[Math.floor(Math.random() * pool.length)]);
  }

  function addCustom() {
    if (!custom.title.trim() || !custom.prompt.trim() || questions.length >= MAX_QUESTIONS) return;
    setQuestions((prev) => [
      ...prev,
      {
        key: newKey(),
        kind: "custom",
        title: custom.title.trim(),
        prompt: custom.prompt.trim(),
        hints: custom.hints.map((hint) => hint.trim()).filter(Boolean),
        answer: custom.answer.trim(),
        minutes: custom.minutes,
      },
    ]);
    setCustom({ title: "", prompt: "", hints: [""], answer: "", minutes: 20 });
    setPanel(null);
  }

  function move(index: number, by: number) {
    setQuestions((prev) => {
      const next = [...prev];
      const target = index + by;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function setMinutes(index: number, minutes: number) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, minutes: Math.min(120, Math.max(5, minutes)) } : q)));
  }

  async function create() {
    if (missing.length || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<InterviewState>("/api/interviews", {
        mode,
        title: title.trim(),
        position: position.trim() || undefined,
        level: level || undefined,
        language,
        scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
        questions: questions.map((q) => {
          if (q.kind === "problem") {
            const problem = getProblem(q.slug);
            return { problemSlug: q.slug, minutes: q.minutes, starter: starterFor(problem?.title ?? "", language, problem ?? null) };
          }
          return {
            title: q.title,
            prompt: q.prompt,
            hints: q.hints,
            answer: q.answer || undefined,
            minutes: q.minutes,
            starter: starterFor(q.title, language, null),
          };
        }),
        settings,
        candidateUsername: solo ? undefined : candidate?.username,
        interviewerUsernames: solo ? undefined : interviewers.map((person) => person.username),
      });
      router.push(`/interviews/${res.data.id}?created=1`);
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Couldn't create the interview.");
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-[calc(100dvh-56px)] overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
      />
      <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-8 sm:pt-10">
        <Link href="/interviews" className="group inline-flex items-center gap-1.5 text-xs text-ink-400 transition-colors hover:text-ink-100">
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          Interviews
        </Link>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink-100 sm:text-4xl">
          New interview
        </h1>
        <p className="mt-2 text-sm text-ink-400">Start from a template, or build it yourself. You can preview everything on the right.</p>

        {/* ---------- Templates ---------- */}
        <div className="mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => applyTemplate(template)}
              className="group rounded-2xl border border-ink-800 bg-ink-900 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-ink-600"
            >
              <p className="text-sm font-semibold text-ink-100">{template.label}</p>
              <p className="mt-1 text-[11px] text-ink-500">{template.detail}</p>
            </button>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
          <div className="space-y-6">
            {/* ---------- 1. Basics ---------- */}
            <section className={CARD}>
              <SectionTitle number={1} title="Basics" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={LABEL} htmlFor="interview-title">Title</label>
                  <input
                    id="interview-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, 120))}
                    placeholder="Frontend Engineer · Round 1"
                    className={FIELD}
                  />
                </div>
                <div>
                  <label className={LABEL} htmlFor="interview-position">Position <span className="text-ink-600">(optional)</span></label>
                  <input
                    id="interview-position"
                    value={position}
                    onChange={(e) => setPosition(e.target.value.slice(0, 80))}
                    placeholder="Frontend Engineer"
                    className={FIELD}
                  />
                </div>
                <div>
                  <label className={LABEL} htmlFor="interview-language">Language</label>
                  <select
                    id="interview-language"
                    value={language}
                    onChange={(e) => {
                      languageTouched.current = true;
                      setLanguage(e.target.value);
                    }}
                    className={FIELD}
                  >
                    {LANGUAGES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <p className={LABEL}>Level <span className="text-ink-600">(optional)</span></p>
                  <div className="flex flex-wrap gap-1.5">
                    {["", ...INTERVIEW_LEVELS].map((option) => (
                      <button
                        key={option || "none"}
                        type="button"
                        onClick={() => setLevel(option)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          level === option ? "border-ink-100 bg-ink-100 text-ink-950" : "border-ink-700 text-ink-300 hover:border-ink-500"
                        }`}
                      >
                        {option || "Any"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL} htmlFor="interview-when">When <span className="text-ink-600">(optional)</span></label>
                  <div className="flex gap-2">
                    <input
                      id="interview-when"
                      type="datetime-local"
                      value={scheduledFor}
                      onChange={(e) => setScheduledFor(e.target.value)}
                      className={`${FIELD} [color-scheme:dark]`}
                    />
                    {scheduledFor && (
                      <button type="button" onClick={() => setScheduledFor("")} className="shrink-0 rounded-xl border border-ink-700 px-3 text-xs text-ink-300 hover:border-ink-500">
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] text-ink-500">It shows on everyone&apos;s Interviews page. You start it from the lobby either way.</p>
                </div>
              </div>
              {!isTestableLanguage(language) && (
                <p className="mt-4 rounded-xl border border-ink-800 bg-ink-950/60 px-3 py-2 text-xs text-ink-400">
                  Tests, Lens and the Big-O meter work in JavaScript, TypeScript and Python. In {LANGUAGES.find((l) => l.value === language)?.label},
                  it&apos;s just the editor and you.
                </p>
              )}
            </section>

            {/* ---------- 2. People ---------- */}
            <section className={CARD}>
              <SectionTitle number={2} title="People" detail="Anyone you don't add here can join later with an invite link." />
              <div className="mb-4 flex rounded-lg border border-ink-800 bg-ink-950/60 p-1">
                {(["live", "solo"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMode(option)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      mode === option ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:text-ink-100"
                    }`}
                  >
                    {option === "live" ? <Users className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                    {option === "live" ? "Interview someone" : "Just me (mock interview)"}
                  </button>
                ))}
              </div>
              {solo ? (
                <p className="text-sm leading-relaxed text-ink-400">
                  You&apos;re the candidate. Take hints when you need them, the clock keeps you honest, and you review
                  yourself at the end.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <p className={LABEL}>Candidate</p>
                    {candidate ? (
                      <PersonChip person={candidate} onRemove={() => setCandidate(null)} />
                    ) : (
                      <>
                        <PersonPicker
                          placeholder="Search by username"
                          exclude={interviewers.map((p) => p.userId)}
                          onPick={setCandidate}
                        />
                        <p className="mt-1.5 text-[11px] text-ink-500">Or leave it empty and send the candidate link.</p>
                      </>
                    )}
                  </div>
                  <div>
                    <p className={LABEL}>Other interviewers <span className="text-ink-600">(you&apos;re one already)</span></p>
                    {interviewers.length < MAX_INTERVIEWERS && (
                      <PersonPicker
                        placeholder="Add someone to the panel"
                        exclude={[...interviewers.map((p) => p.userId), ...(candidate ? [candidate.userId] : [])]}
                        onPick={(person) => setInterviewers((prev) => [...prev, person])}
                      />
                    )}
                    {interviewers.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {interviewers.map((person) => (
                          <PersonChip
                            key={person.userId}
                            person={person}
                            onRemove={() => setInterviewers((prev) => prev.filter((p) => p.userId !== person.userId))}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* ---------- 3. Questions ---------- */}
            <section className={CARD}>
              <SectionTitle
                number={3}
                title="Questions"
                detail={`${questions.length}/${MAX_QUESTIONS} · ${formatDuration(totalMinutes * 60000)} in total. They're asked in this order.`}
              />
              {questions.length === 0 && (
                <p className="mb-4 rounded-xl border border-dashed border-ink-700 px-4 py-6 text-center text-sm text-ink-500">
                  No questions yet. Pick a template above, or add them below.
                </p>
              )}
              <ol className="space-y-2">
                <AnimatePresence initial={false}>
                  {questions.map((q, index) => {
                    const problem = q.kind === "problem" ? getProblem(q.slug) : null;
                    return (
                      <motion.li
                        key={q.key}
                        layout
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -12 }}
                        className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-800 bg-ink-950/40 px-3 py-2.5"
                      >
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-ink-700 text-[11px] font-semibold text-ink-300">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-ink-100">{q.kind === "problem" ? problem?.title : q.title}</p>
                          <p className="truncate text-[11px] text-ink-500">
                            {problem ? problem.topics.join(" · ") : `Your question${q.kind === "custom" && q.hints.length ? ` · ${q.hints.length} hints` : ""}`}
                          </p>
                        </div>
                        {problem && <DifficultyBadge difficulty={problem.difficulty} />}
                        <div className="flex items-center rounded-lg border border-ink-800">
                          <button type="button" onClick={() => setMinutes(index, q.minutes - 5)} aria-label="5 minutes less" className="px-1.5 py-1 text-ink-400 hover:text-ink-100">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-12 text-center font-[family-name:var(--font-mono)] text-xs tabular-nums text-ink-100">{q.minutes}m</span>
                          <button type="button" onClick={() => setMinutes(index, q.minutes + 5)} aria-label="5 minutes more" className="px-1.5 py-1 text-ink-400 hover:text-ink-100">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex items-center">
                          <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up" className="rounded-md p-1 text-ink-400 hover:text-ink-100 disabled:opacity-30">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => move(index, 1)} disabled={index === questions.length - 1} aria-label="Move down" className="rounded-md p-1 text-ink-400 hover:text-ink-100 disabled:opacity-30">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuestions((prev) => prev.filter((item) => item.key !== q.key))}
                            aria-label="Remove"
                            className="rounded-md p-1 text-ink-400 hover:text-ink-100"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ol>

              {questions.length < MAX_QUESTIONS && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPanel(panel === "library" ? null : "library")}
                    className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
                      panel === "library" ? "border-ink-100 bg-ink-100 text-ink-950" : "border-ink-700 text-ink-200 hover:border-ink-500"
                    }`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add from the library
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanel(panel === "custom" ? null : "custom")}
                    className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
                      panel === "custom" ? "border-ink-100 bg-ink-100 text-ink-950" : "border-ink-700 text-ink-200 hover:border-ink-500"
                    }`}
                  >
                    <PenLine className="h-3.5 w-3.5" />
                    Write your own
                  </button>
                </div>
              )}

              {panel === "library" && (
                <div className="mt-3 rounded-xl border border-ink-800 bg-ink-950/40 p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(["Any", ...DIFFICULTIES] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setDifficulty(option)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          difficulty === option ? "border-ink-100 bg-ink-100 text-ink-950" : "border-ink-700 text-ink-300 hover:border-ink-500"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={surprise}
                      className="ml-auto flex items-center gap-1 rounded-full border border-ink-700 px-2.5 py-1 text-[11px] font-medium text-ink-200 transition-colors hover:border-ink-500"
                    >
                      <Dices className="h-3.5 w-3.5" />
                      Surprise me
                    </button>
                  </div>
                  <div className="relative mt-2">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search problems or topics"
                      className="h-8 w-full rounded-lg border border-ink-800 bg-ink-950/60 pl-8 pr-3 text-xs text-ink-100 placeholder:text-ink-500 focus:border-ink-600 focus:outline-none"
                    />
                  </div>
                  <ul className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-ink-800">
                    {library.length === 0 && <li className="p-4 text-center text-xs text-ink-500">No problems match.</li>}
                    {library.map((problem) => {
                      const added = chosen.has(problem.slug);
                      return (
                        <li key={problem.slug}>
                          <button
                            type="button"
                            onClick={() => addProblem(problem)}
                            disabled={added}
                            className="flex w-full items-center gap-3 border-b border-ink-800/70 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-ink-800/50 disabled:cursor-default disabled:hover:bg-transparent"
                          >
                            <span className="min-w-0 flex-1">
                              <span className={`block truncate text-sm ${added ? "text-ink-500" : "text-ink-100"}`}>{problem.title}</span>
                              <span className="block truncate text-[11px] text-ink-500">{problem.topics.join(" · ")}</span>
                            </span>
                            <DifficultyBadge difficulty={problem.difficulty} />
                            {added ? <Check className="h-4 w-4 shrink-0 text-ink-300" /> : <Plus className="h-4 w-4 shrink-0 text-ink-500" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {panel === "custom" && (
                <div className="mt-3 space-y-3 rounded-xl border border-ink-800 bg-ink-950/40 p-3">
                  <input
                    value={custom.title}
                    onChange={(e) => setCustom((c) => ({ ...c, title: e.target.value.slice(0, 120) }))}
                    placeholder="Title, like “Design a rate limiter”"
                    className={FIELD}
                  />
                  <textarea
                    value={custom.prompt}
                    onChange={(e) => setCustom((c) => ({ ...c, prompt: e.target.value.slice(0, 5000) }))}
                    rows={4}
                    placeholder="The question, as the candidate will see it."
                    className="w-full resize-none rounded-xl border border-ink-700 bg-ink-950/60 px-3 py-2 text-sm leading-relaxed text-ink-100 placeholder:text-ink-500 focus:border-ink-500 focus:outline-none"
                  />
                  <div className="space-y-1.5">
                    <p className="text-xs text-ink-400">Hints, in the order you&apos;d give them (optional)</p>
                    {custom.hints.map((hint, i) => (
                      <div key={i} className="flex gap-1.5">
                        <input
                          value={hint}
                          onChange={(e) => setCustom((c) => ({ ...c, hints: c.hints.map((h, j) => (j === i ? e.target.value.slice(0, 500) : h)) }))}
                          placeholder={`Hint ${i + 1}`}
                          className="h-9 min-w-0 flex-1 rounded-lg border border-ink-800 bg-ink-950/60 px-3 text-xs text-ink-100 placeholder:text-ink-500 focus:border-ink-600 focus:outline-none"
                        />
                        {custom.hints.length > 1 && (
                          <button type="button" onClick={() => setCustom((c) => ({ ...c, hints: c.hints.filter((_, j) => j !== i) }))} aria-label="Remove hint" className="px-1 text-ink-500 hover:text-ink-100">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {custom.hints.length < 5 && (
                      <button type="button" onClick={() => setCustom((c) => ({ ...c, hints: [...c.hints, ""] }))} className="text-[11px] text-ink-400 hover:text-ink-100">
                        + Another hint
                      </button>
                    )}
                  </div>
                  <textarea
                    value={custom.answer}
                    onChange={(e) => setCustom((c) => ({ ...c, answer: e.target.value.slice(0, 2000) }))}
                    rows={2}
                    placeholder="Answer key: the approach you're looking for (only interviewers see it; optional)"
                    className="w-full resize-none rounded-xl border border-ink-700 bg-ink-950/60 px-3 py-2 text-xs leading-relaxed text-ink-100 placeholder:text-ink-500 focus:border-ink-500 focus:outline-none"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center rounded-lg border border-ink-800">
                      <button type="button" onClick={() => setCustom((c) => ({ ...c, minutes: Math.max(5, c.minutes - 5) }))} aria-label="5 minutes less" className="px-2 py-1.5 text-ink-400 hover:text-ink-100">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-14 text-center font-[family-name:var(--font-mono)] text-xs tabular-nums text-ink-100">{custom.minutes} min</span>
                      <button type="button" onClick={() => setCustom((c) => ({ ...c, minutes: Math.min(120, c.minutes + 5) }))} aria-label="5 minutes more" className="px-2 py-1.5 text-ink-400 hover:text-ink-100">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setPanel(null)} className="h-9 rounded-xl border border-ink-700 px-3 text-xs text-ink-300 hover:border-ink-500">
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={addCustom}
                        disabled={!custom.title.trim() || !custom.prompt.trim()}
                        className="h-9 rounded-xl bg-ink-100 px-4 text-xs font-semibold text-ink-950 transition-colors hover:bg-white disabled:opacity-40"
                      >
                        Add question
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* ---------- 4. Settings ---------- */}
            <section className={CARD}>
              <SectionTitle number={4} title="Settings" detail="Interviewers always have every tool; these are for the candidate." />
              <ul className="divide-y divide-ink-800">
                {SETTINGS.filter((setting) => !(solo && setting.key === "monitoring")).map((setting) => {
                  const on = settings[setting.key];
                  return (
                    <li key={setting.key} className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-ink-100">
                          {setting.key === "monitoring" && <ShieldCheck className="h-4 w-4 text-ink-300" />}
                          {setting.label}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{setting.detail}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={setting.label}
                        onClick={() => setSettings((prev) => ({ ...prev, [setting.key]: !prev[setting.key] }))}
                        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors ${on ? "border-ink-100 bg-ink-100" : "border-ink-700 bg-ink-800"}`}
                      >
                        <motion.span
                          layout
                          transition={{ type: "spring", bounce: 0.25, duration: 0.3 }}
                          className={`absolute top-0.5 h-4 w-4 rounded-full ${on ? "right-0.5 bg-ink-950" : "left-0.5 bg-ink-400"}`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          {/* ---------- The summary ---------- */}
          <aside>
            <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5 lg:sticky lg:top-24">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">{solo ? "Mock interview" : "Interview"}</p>
              <p className="mt-1.5 truncate font-[family-name:var(--font-display)] text-lg font-semibold text-ink-100">
                {title.trim() || "Untitled interview"}
              </p>
              <p className="mt-0.5 truncate text-xs text-ink-500">
                {[position.trim(), level, LANGUAGES.find((l) => l.value === language)?.label].filter(Boolean).join(" · ")}
              </p>

              <div className="mt-5 space-y-1.5">
                {questions.length === 0 ? (
                  <p className="text-xs text-ink-500">No questions yet.</p>
                ) : (
                  questions.map((q, i) => (
                    <div key={q.key} className="flex items-center gap-2 text-xs">
                      <span className="w-4 shrink-0 text-ink-500">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-ink-200">{q.kind === "problem" ? getProblem(q.slug)?.title : q.title}</span>
                      <span className="shrink-0 font-[family-name:var(--font-mono)] tabular-nums text-ink-500">{q.minutes}m</span>
                    </div>
                  ))
                )}
                {questions.length > 0 && (
                  <div className="flex items-center justify-between border-t border-ink-800 pt-2 text-xs">
                    <span className="text-ink-400">Total</span>
                    <span className="font-[family-name:var(--font-mono)] tabular-nums text-ink-100">{formatDuration(totalMinutes * 60000)}</span>
                  </div>
                )}
              </div>

              {!solo && (
                <div className="mt-5 space-y-1.5 text-xs">
                  <p className="flex items-center gap-1.5 text-ink-300">
                    <Users className="h-3.5 w-3.5 text-ink-500" />
                    You{interviewers.length ? ` + ${interviewers.map((p) => `@${p.username}`).join(", ")}` : ""}
                  </p>
                  <p className="flex items-center gap-1.5 text-ink-300">
                    <UserPlus className="h-3.5 w-3.5 text-ink-500" />
                    {candidate ? `@${candidate.username}` : "Candidate joins with a link"}
                  </p>
                </div>
              )}
              <p className="mt-1.5 text-xs text-ink-400">
                {scheduledFor
                  ? new Date(scheduledFor).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                  : "Not scheduled: start whenever you're ready"}
              </p>

              {(error || missing.length > 0) && (
                <p className="mt-5 text-xs text-ink-400">{error ?? `Still needed: ${missing.join(", ")}.`}</p>
              )}
              <button
                type="button"
                onClick={create}
                disabled={missing.length > 0 || busy}
                className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink-100 text-sm font-semibold text-ink-950 shadow-[0_0_24px_-10px_rgba(255,255,255,0.6)] transition-all hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Create interview
              </button>
              {!solo && (
                <p className="mt-2.5 text-center text-[11px] text-ink-500">You&apos;ll get candidate, interviewer and observer links.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function NewInterviewPage() {
  return (
    <Suspense fallback={null}>
      <Builder />
    </Suspense>
  );
}