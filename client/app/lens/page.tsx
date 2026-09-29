"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowRight, Loader2, Play, ScanEye, Search } from "lucide-react";
import { LensCallCard } from "@/components/lens/LensCallCard";
import { LensPlayer } from "@/components/lens/LensPlayer";
import { useToast } from "@/components/ToastProvider";
import { useApi } from "@/lib/api";
import { defineEditorThemes } from "@/lib/editorTheme";
import { traceCode } from "@/lib/execution";
import { LENS_MAX_STEPS, type LensTrace } from "@/lib/lens";
import {
  buildCallProgram,
  defaultCallable,
  findCallables,
  isIdleTrace,
  lensErrorHint,
  type LensCallable,
} from "@/lib/lensCall";
import {
  LENS_CATEGORIES,
  LENS_CONCEPTS,
  categoryLabel,
  findConcept,
  type LensCategoryId,
  type LensConcept,
  type LensLanguage,
} from "@/lib/lensLibrary";
import { useEditorTheme } from "@/lib/useEditorTheme";
import type { Room } from "@/types/room";

const LANGUAGES: { id: LensLanguage; label: string }[] = [
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
];

// One click away, above the editor.
const POPULAR = ["binary-search", "merge-sort", "linked-list", "tree", "islands", "lcs"];

const FIRST_CONCEPT = findConcept("linked-list") ?? LENS_CONCEPTS[0];

function cx(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

function handleEditorWillMount(monaco: Monaco) {
  defineEditorThemes(monaco);
}

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function ConceptCard({ concept, selected, onOpen }: { concept: LensConcept; selected: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={selected}
      className={cx(
        "group flex h-full flex-col rounded-xl border p-4 text-left transition-colors",
        selected
          ? "border-ink-300 bg-ink-900"
          : "border-ink-800 bg-ink-950 hover:border-ink-600 hover:bg-ink-900/60",
      )}
    >
      <span className="text-sm font-semibold text-ink-100">{concept.title}</span>
      <span className="mt-1.5 text-xs leading-relaxed text-ink-400">{concept.summary}</span>
      <span className="mt-auto flex items-center justify-between gap-2 pt-3">
        <span className="font-mono text-[10px] text-ink-500">{concept.complexity}</span>
        <span
          className={cx(
            "inline-flex items-center gap-1 text-[11px] font-medium transition-colors",
            selected ? "text-ink-100" : "text-ink-500 group-hover:text-ink-100",
          )}
        >
          <Play className="h-3 w-3" aria-hidden="true" />
          {selected ? "Showing" : "Watch"}
        </span>
      </span>
    </button>
  );
}

function ConceptGrid({
  items,
  selectedId,
  onOpen,
}: {
  items: LensConcept[];
  selectedId: string;
  onOpen: (concept: LensConcept) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <ConceptCard key={item.id} concept={item} selected={item.id === selectedId} onOpen={() => onOpen(item)} />
      ))}
    </div>
  );
}

export default function LensPage() {
  const [themeId] = useEditorTheme();
  const router = useRouter();
  const api = useApi();
  const { toast } = useToast();
  const { isLoaded, isSignedIn } = useAuth();

  const [language, setLanguage] = useState<LensLanguage>("python");
  const [conceptId, setConceptId] = useState(FIRST_CONCEPT.id);
  const [code, setCode] = useState(FIRST_CONCEPT.code.python);
  const [mode, setMode] = useState<"edit" | "play" | "idle">("edit");
  const [running, setRunning] = useState(false);
  const [pythonReady, setPythonReady] = useState(false);
  const [trace, setTrace] = useState<LensTrace | null>(null);
  const [tracedCode, setTracedCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  // A friendlier explanation for some errors (input(), packages, …).
  const [hint, setHint] = useState<string | null>(null);
  // Nothing ran (the code only defines functions): the call box.
  const [idle, setIdle] = useState<{ trace: LensTrace; callables: LensCallable[]; defaultCall: string } | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<LensCategoryId | "all">("all");
  const [creating, setCreating] = useState(false);
  // Every new recording gets a fresh player that starts at step 1 (switching
  // language while watching records again without leaving the player).
  const [runId, setRunId] = useState(0);
  const busyRef = useRef(false);
  const playgroundRef = useRef<HTMLDivElement>(null);
  const libraryRef = useRef<HTMLElement>(null);

  const concept = findConcept(conceptId) ?? FIRST_CONCEPT;
  const edited = code !== concept.code[language];

  useEffect(() => {
    document.title = "Lens — CodeShare";
  }, []);

  // Records a run of the given code and opens the player.
  const record = useCallback(async (lang: LensLanguage, source: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setRunning(true);
    setError(null);
    setHint(null);
    const result = await traceCode(lang, source);
    busyRef.current = false;
    setRunning(false);
    if (lang === "python") setPythonReady(true);

    if (!result.ok) {
      setError(result.error);
      setMode("edit");
      return;
    }
    if (result.trace.steps.length === 0) {
      const problem = result.trace.error;
      setError(
        problem
          ? `${problem.message}${problem.line ? ` (line ${problem.line})` : ""}`
          : "There's nothing to show yet. Write some code first.",
      );
      setHint(problem ? lensErrorHint(problem.message, lang) : null);
      setMode("edit");
      return;
    }
    if (isIdleTrace(result.trace)) {
      const callables = findCallables(result.trace, source, lang);
      setIdle({ trace: result.trace, callables, defaultCall: defaultCallable(callables)?.template ?? "" });
      setCallError(null);
      setTracedCode(source);
      setMode("idle");
      return;
    }
    setHint(result.trace.error ? lensErrorHint(result.trace.error.message, lang) : null);
    setTrace(result.trace);
    setTracedCode(source);
    setRunId((n) => n + 1);
    setMode("play");
  }, []);

  const visualize = useCallback(() => record(language, code), [record, language, code]);

  // The call box: the code plus one call at the end, for this run only.
  const visualizeCall = async (call: string) => {
    if (busyRef.current) return;
    const program = buildCallProgram(code, language, call);
    busyRef.current = true;
    setRunning(true);
    setCallError(null);
    const result = await traceCode(language, program.code, { setup: program.setup });
    busyRef.current = false;
    setRunning(false);
    if (language === "python") setPythonReady(true);

    if (!result.ok) {
      setCallError(result.error);
      return;
    }
    if (result.trace.steps.length === 0) {
      const problem = result.trace.error;
      setCallError(problem ? `${problem.message}${problem.line ? ` (line ${problem.line})` : ""}` : "Nothing ran.");
      return;
    }
    setHint(result.trace.error ? lensErrorHint(result.trace.error.message, language) : null);
    setTrace(result.trace);
    setTracedCode(program.code);
    setRunId((n) => n + 1);
    setIdle(null);
    setMode("play");
  };

  // The editor's keyboard shortcut always calls the latest version.
  const visualizeRef = useRef(visualize);
  useEffect(() => {
    visualizeRef.current = visualize;
  }, [visualize]);

  const handleMount: OnMount = (editor, monaco) => {
    // Bracket colors are drawn by the text model, which ignores the editor's
    // bracketPairColorization option, so turn them off on the model itself.
    editor.getModel()?.updateOptions({
      bracketColorizationOptions: { enabled: false, independentColorPoolPerBracketType: false },
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      void visualizeRef.current();
    });
  };

  // Opens a concept in the playground, and (from a card) starts watching it.
  const openConcept = (next: LensConcept, watch: boolean) => {
    if (busyRef.current) return;
    const source = next.code[language];
    setConceptId(next.id);
    setCode(source);
    setError(null);
    setHint(null);
    setIdle(null);
    setMode("edit");
    playgroundRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    if (watch) void record(language, source);
  };

  // Switching language keeps the same concept (and keeps watching it).
  const pickLanguage = (next: LensLanguage) => {
    if (next === language || busyRef.current) return;
    const source = concept.code[next];
    setLanguage(next);
    setCode(source);
    setError(null);
    setHint(null);
    setIdle(null);
    if (mode === "play") {
      void record(next, source);
    } else {
      setMode("edit");
    }
  };

  // Opens the playground's code in a new room, where Lens is one click away.
  async function tryInRoom() {
    // Until Clerk has loaded, we don't know yet whether you're signed in.
    if (creating || !isLoaded) return;
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent("/lens")}`);
      return;
    }
    setCreating(true);
    try {
      const res = await api.post<Room>("/api/rooms", { name: concept.title, language, code });
      router.push(`/room/${res.data._id}`);
    } catch (err) {
      // The server's reason (for example, the room limit), if it sent one.
      const reason = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast(reason || "Couldn't open a room. Please try again.", "error");
      setCreating(false);
    }
  }

  const words = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      LENS_CONCEPTS.filter(
        (item) =>
          (category === "all" || item.category === category) &&
          (!words || `${item.title} ${item.summary} ${categoryLabel(item.category)}`.toLowerCase().includes(words)),
      ),
    [category, words],
  );
  const grouped = category === "all" && !words;
  const counts = useMemo(() => {
    const byCategory = new Map<LensCategoryId, number>();
    for (const item of LENS_CONCEPTS) byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1);
    return byCategory;
  }, []);

  return (
    <main className="relative min-h-[calc(100dvh-56px)] overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-10 sm:pt-14">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-400">Lens</p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink-100 sm:text-4xl">
            Watch your code run
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-400 sm:text-base">
            Step through Python, JavaScript or TypeScript one line at a time and see every variable, array, table,
            linked list and tree drawn as it changes, with markers for every index and arrows for every pointer.
          </p>
        </div>

        {/* ---------- Lens in rooms ---------- */}
        <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-ink-800 bg-ink-900/60 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ink-700 bg-ink-800">
              <ScanEye className="h-4 w-4 text-ink-100" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-100">Lens is built into every room</p>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-400">
                Write any code in a room and click Visualize. Everyone in the room watches it run together, step by
                step, and anyone can take over.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              onClick={() => void tryInRoom()}
              disabled={creating}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-ink-100 px-4 text-sm font-semibold text-ink-950 transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-70"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {creating ? "Opening room…" : isLoaded && !isSignedIn ? "Sign in to try it" : "Try it in a room"}
              {!creating && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => libraryRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" })}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-ink-700 px-4 text-sm font-medium text-ink-100 transition-colors hover:border-ink-500"
            >
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
              Browse all {LENS_CONCEPTS.length} concepts
            </button>
          </div>
        </div>

        {/* ---------- Popular ---------- */}
        <div className="mt-8 flex flex-wrap items-center gap-2" role="group" aria-label="Popular concepts">
          <span className="mr-1 text-xs text-ink-500">Popular</span>
          {POPULAR.map((id) => findConcept(id))
            .filter((item): item is LensConcept => !!item)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openConcept(item, true)}
                aria-pressed={conceptId === item.id}
                className={
                  conceptId === item.id
                    ? "rounded-full border border-ink-300 bg-ink-100 px-3 py-1 text-xs font-medium text-ink-950"
                    : "rounded-full border border-ink-800 px-3 py-1 text-xs font-medium text-ink-400 transition-colors hover:border-ink-600 hover:text-ink-100"
                }
              >
                {item.title}
              </button>
            ))}
        </div>

        {/* ---------- Playground ---------- */}
        <div ref={playgroundRef} className="mt-7 scroll-mt-20">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-500">
                {categoryLabel(concept.category)}
                <span className="mx-1.5 text-ink-700">·</span>
                <span className="font-mono normal-case tracking-normal">{concept.complexity}</span>
              </p>
              <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-ink-100">
                {concept.title}
                {edited && <span className="ml-2 align-middle text-xs font-normal text-ink-500">edited</span>}
              </h2>
              <p className="mt-0.5 max-w-2xl text-sm text-ink-400">{concept.summary}</p>
            </div>
            <div className="flex rounded-lg border border-ink-800 p-0.5" role="group" aria-label="Language">
              {LANGUAGES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => pickLanguage(option.id)}
                  aria-pressed={language === option.id}
                  className={
                    language === option.id
                      ? "rounded-md bg-ink-800 px-2.5 py-1 text-xs font-medium text-ink-100"
                      : "rounded-md px-2.5 py-1 text-xs font-medium text-ink-500 transition-colors hover:text-ink-300"
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {mode === "play" && trace ? (
              <LensPlayer key={runId} code={tracedCode} trace={trace} onEdit={() => setMode("edit")} />
            ) : mode === "idle" && idle ? (
              <div className="grid min-h-[480px] grid-cols-1 place-items-center rounded-2xl border border-ink-800 bg-ink-950 p-4">
                <LensCallCard
                  key={idle.defaultCall}
                  language={language}
                  callables={idle.callables}
                  defaultCall={idle.defaultCall}
                  busy={running}
                  error={callError}
                  onSubmit={(call) => void visualizeCall(call)}
                  onShowAnyway={() => {
                    setTrace(idle.trace);
                    setTracedCode(code);
                    setRunId((n) => n + 1);
                    setIdle(null);
                    setMode("play");
                  }}
                  onCancel={() => {
                    setIdle(null);
                    setMode("edit");
                  }}
                />
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-950">
                <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-4 py-2.5">
                  <p className="hidden text-xs text-ink-500 sm:block">
                    Change anything you like, then press Visualize
                    <span className="ml-1.5 font-mono text-ink-600">⌘↵</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => void visualize()}
                    disabled={running}
                    title="Visualize (⌘ or Ctrl + Enter)"
                    className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-ink-100 px-4 text-sm font-semibold text-ink-950 transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-70"
                  >
                    {running ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Play className="h-4 w-4" aria-hidden="true" />
                    )}
                    {running ? (language === "python" && !pythonReady ? "Loading Python…" : "Recording…") : "Visualize"}
                  </button>
                </div>
                <div className="h-[440px]">
                  <Editor
                    height="100%"
                    language={language}
                    theme={themeId}
                    value={code}
                    onChange={(value) => setCode(value ?? "")}
                    beforeMount={handleEditorWillMount}
                    onMount={handleMount}
                    options={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 14,
                      lineHeight: 22,
                      fontLigatures: true,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      padding: { top: 16, bottom: 16 },
                      automaticLayout: true,
                      tabSize: language === "python" ? 4 : 2,
                      renderLineHighlight: "line",
                      // Same as the room editor: no colored brackets (the app is strictly monochrome).
                      bracketPairColorization: { enabled: false },
                      guides: { indentation: true, highlightActiveIndentation: true, bracketPairs: false },
                      smoothScrolling: true,
                      cursorSmoothCaretAnimation: "on",
                      cursorBlinking: "smooth",
                      scrollbar: {
                        verticalScrollbarSize: 10,
                        horizontalScrollbarSize: 10,
                        useShadows: false,
                      },
                      overviewRulerBorder: false,
                      overviewRulerLanes: 0,
                      hideCursorInOverviewRuler: true,
                      stickyScroll: { enabled: false },
                      fixedOverflowWidgets: true,
                    }}
                  />
                </div>
                {error && (
                  <div className="border-t border-ink-800 px-4 py-3">
                    <pre className="whitespace-pre-wrap break-words border-l-2 border-red-500/70 pl-3 font-mono text-xs text-red-300">
                      {error}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </motion.div>

          {hint && (mode === "play" || error) && <p className="mt-3 text-xs text-ink-400">Tip: {hint}</p>}

          <p className="mt-3 text-xs text-ink-600">
            Lens records up to {LENS_MAX_STEPS.toLocaleString()} steps.
            {language === "python" && " The first Python run downloads Python, which takes a few seconds."}
          </p>
        </div>

        {/* ---------- Library ---------- */}
        <section ref={libraryRef} id="library" aria-label="Concept library" className="mt-16 scroll-mt-20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-ink-100">
                Concept library
              </h2>
              <p className="mt-1 text-sm text-ink-400">
                {LENS_CONCEPTS.length} classic algorithms and data structures, each ready to watch in Python, JavaScript
                or TypeScript.
              </p>
            </div>
            <label className="relative block sm:w-72">
              <span className="sr-only">Search concepts</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search: heap, recursion, grid…"
                className="h-9 w-full rounded-lg border border-ink-800 bg-ink-950 pl-9 pr-3 text-sm text-ink-100 placeholder:text-ink-600 focus:border-ink-500 focus:outline-none"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Categories">
            {[{ id: "all" as const, label: "All" }, ...LENS_CATEGORIES].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setCategory(option.id)}
                aria-pressed={category === option.id}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  category === option.id
                    ? "border-ink-300 bg-ink-100 text-ink-950"
                    : "border-ink-800 text-ink-400 hover:border-ink-600 hover:text-ink-100",
                )}
              >
                {option.label}
                <span className="tabular-nums text-ink-600">
                  {option.id === "all" ? LENS_CONCEPTS.length : (counts.get(option.id) ?? 0)}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-6">
            {grouped ? (
              <div className="flex flex-col gap-10">
                {LENS_CATEGORIES.map((section) => {
                  const items = LENS_CONCEPTS.filter((item) => item.category === section.id);
                  if (items.length === 0) return null;
                  return (
                    <div key={section.id}>
                      <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-ink-500">
                        {section.label}
                      </h3>
                      <ConceptGrid items={items} selectedId={conceptId} onOpen={(item) => openConcept(item, true)} />
                    </div>
                  );
                })}
              </div>
            ) : matches.length > 0 ? (
              <ConceptGrid items={matches} selectedId={conceptId} onOpen={(item) => openConcept(item, true)} />
            ) : (
              <div className="rounded-2xl border border-dashed border-ink-800 px-6 py-12 text-center">
                <p className="text-sm text-ink-300">No concepts match &ldquo;{query.trim()}&rdquo;.</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setCategory("all");
                  }}
                  className="mt-3 text-sm text-ink-100 underline underline-offset-4 transition-colors hover:text-ink-300"
                >
                  Show all concepts
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}