"use client";

import { useEscape } from "@/lib/useEscape";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Dices, Loader2, PenLine, Search, User, Users, X } from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { ui } from "@/lib/ui";
import { DIFFICULTIES, PROBLEMS, isTestableLanguage, type Difficulty } from "@/lib/problems";
import type { RoomPerson } from "@/types/room";

export type InterviewSetupChoice = {
  mode: "live" | "solo";
  candidateId?: string;
  problemSlug?: string;
  customTitle?: string;
  customPrompt?: string;
  durationMin: number;
  cleanStart: boolean;
};

type InterviewSetupProps = {
  open: boolean;
  onClose: () => void;
  me: string | null;
  language: string;
  people: RoomPerson[];
  onlineIds: Set<string>;
  // The room's "can edit" link, to bring a candidate in.
  editLink: string | null;
  onStart: (choice: InterviewSetupChoice) => Promise<void>;
};

const LENGTHS = [15, 30, 45, 60];

// The same segmented look as every other toggle in the app.
const SEGMENT =
  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors";
const SEGMENT_ON = "bg-ink-900 text-ink-100 shadow-xs ring-1 ring-ink-800";
const SEGMENT_OFF = "text-ink-500 hover:text-ink-100";
const CHIP_ON = "border-ink-100 bg-ink-100 text-ink-950";
const CHIP_OFF = "border-ink-800 bg-ink-900 text-ink-400 hover:border-ink-700 hover:text-ink-100";

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">{children}</p>;
}

// Choosing who, what and how long, in one screen.
function SetupCard({ onClose, me, language, people, onlineIds, editLink, onStart }: Omit<InterviewSetupProps, "open">) {
  const others = people.filter((person) => person.userId !== me);
  const [mode, setMode] = useState<"live" | "solo">(others.length ? "live" : "solo");
  const [candidateId, setCandidateId] = useState<string | null>(
    () => others.find((person) => onlineIds.has(person.userId))?.userId ?? others[0]?.userId ?? null
  );
  const [source, setSource] = useState<"problem" | "custom">("problem");
  const [difficulty, setDifficulty] = useState<Difficulty | "Any">("Any");
  const [query, setQuery] = useState("");
  const [problemSlug, setProblemSlug] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [durationMin, setDurationMin] = useState(45);
  const [cleanStart, setCleanStart] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return PROBLEMS.filter(
      (problem) =>
        (difficulty === "Any" || problem.difficulty === difficulty) &&
        (!needle ||
          problem.title.toLowerCase().includes(needle) ||
          problem.topics.some((topic) => topic.toLowerCase().includes(needle)))
    );
  }, [difficulty, query]);

  const chosen = PROBLEMS.find((problem) => problem.slug === problemSlug) ?? null;
  const ready =
    (mode === "solo" || !!candidateId) &&
    (source === "problem" ? !!problemSlug : customTitle.trim().length > 0 && customPrompt.trim().length > 0);

  function surprise() {
    if (!filtered.length) return;
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    setProblemSlug(pick.slug);
    document.getElementById(`setup-problem-${pick.slug}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  async function start() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onStart({
        mode,
        ...(mode === "live" && candidateId ? { candidateId } : {}),
        ...(source === "problem" && problemSlug
          ? { problemSlug }
          : { customTitle: customTitle.trim(), customPrompt: customPrompt.trim() }),
        durationMin,
        cleanStart,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the interview.");
      setBusy(false);
    }
  }

  return (
    <motion.div
      role="dialog"
      aria-label="Start an interview"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => e.stopPropagation()}
      className="flex max-h-[92dvh] w-full flex-col rounded-t-xl border border-ink-800 bg-ink-900 shadow-raised sm:max-w-xl sm:rounded-xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-ink-800 px-5 pb-4 pt-5">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink-100">Start an interview</h2>
          <p className="mt-0.5 text-xs text-ink-400">
            A timed mock interview: hints, notes, live test results, and a report at the end.
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {/* Who */}
        <section>
          <Label>Who</Label>
          <div className="mb-3 flex rounded-lg border border-ink-800 bg-ink-950 p-0.5">
            <button
              type="button"
              onClick={() => setMode("live")}
              className={`${SEGMENT} ${mode === "live" ? SEGMENT_ON : SEGMENT_OFF}`}
            >
              <Users className="h-3.5 w-3.5" />
              Interview someone
            </button>
            <button
              type="button"
              onClick={() => setMode("solo")}
              className={`${SEGMENT} ${mode === "solo" ? SEGMENT_ON : SEGMENT_OFF}`}
            >
              <User className="h-3.5 w-3.5" />
              Practice by myself
            </button>
          </div>
          {mode === "live" &&
            (others.length ? (
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {others.map((person) => {
                  const selected = person.userId === candidateId;
                  const online = onlineIds.has(person.userId);
                  return (
                    <button
                      key={person.userId}
                      type="button"
                      onClick={() => setCandidateId(person.userId)}
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                        selected ? "border-ink-100 bg-ink-800 ring-1 ring-ink-100" : "border-ink-800 bg-ink-900 hover:border-ink-600"
                      }`}
                    >
                      <span className="relative shrink-0">
                        <AvatarIcon avatarId={person.avatarId ?? "codeshare"} className="h-7 w-7 rounded-full" />
                        {online && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-900 bg-success-strong" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-100">{person.username ?? "Someone"}</span>
                        <span className="text-[11px] text-ink-500">
                          {online ? "Online" : "Offline"}
                          {person.role === "viewer" ? " · will be able to edit" : ""}
                        </span>
                      </span>
                      {selected && <Check className="h-4 w-4 shrink-0 text-ink-100" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-ink-700 p-4 text-center">
                <p className="text-sm text-ink-200">Nobody else is in this room yet.</p>
                <p className="mt-1 text-xs text-ink-500">Send your candidate the edit link, then pick them here.</p>
                {editLink && (
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(editLink);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1600);
                    }}
                    className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink-100 px-3.5 text-xs font-semibold text-ink-950 transition-colors hover:bg-ink-200"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy edit link"}
                  </button>
                )}
              </div>
            ))}
          {mode === "solo" && (
            <p className="text-xs leading-relaxed text-ink-400">
              You&apos;re the candidate. Hints are yours to take, the clock keeps you honest, and you&apos;ll review
              yourself at the end.
            </p>
          )}
        </section>

        {/* What */}
        <section>
          <Label>Question</Label>
          <div className="mb-3 flex rounded-lg border border-ink-800 bg-ink-950 p-0.5">
            <button
              type="button"
              onClick={() => setSource("problem")}
              className={`${SEGMENT} ${source === "problem" ? SEGMENT_ON : SEGMENT_OFF}`}
            >
              Practice problem
            </button>
            <button
              type="button"
              onClick={() => setSource("custom")}
              className={`${SEGMENT} ${source === "custom" ? SEGMENT_ON : SEGMENT_OFF}`}
            >
              <PenLine className="h-3.5 w-3.5" />
              My own question
            </button>
          </div>

          {source === "problem" ? (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {(["Any", ...DIFFICULTIES] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level)}
                    className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      difficulty === level ? CHIP_ON : CHIP_OFF
                    }`}
                  >
                    {level}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={surprise}
                  className="ml-auto flex items-center gap-1 rounded-md border border-ink-700 bg-ink-900 px-2.5 py-1 text-[11px] font-medium text-ink-200 shadow-xs transition-colors hover:border-ink-600 hover:text-ink-100"
                >
                  <Dices className="h-3.5 w-3.5" />
                  Surprise me
                </button>
              </div>
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search problems or topics"
                  className="h-8 w-full rounded-lg border border-ink-700 bg-ink-900 pl-8 pr-3 text-xs text-ink-100 shadow-xs placeholder:text-ink-500 focus:border-ink-500 focus:outline-none"
                />
              </div>
              <div className="max-h-52 overflow-y-auto rounded-lg border border-ink-800 bg-ink-900">
                {filtered.length === 0 && <p className="p-4 text-center text-xs text-ink-500">No problems match.</p>}
                {filtered.map((problem) => {
                  const selected = problem.slug === problemSlug;
                  return (
                    <button
                      key={problem.slug}
                      id={`setup-problem-${problem.slug}`}
                      type="button"
                      onClick={() => setProblemSlug(problem.slug)}
                      className={`flex w-full items-center gap-3 border-b border-ink-800/70 px-3 py-2 text-left last:border-b-0 transition-colors ${
                        selected ? "bg-ink-800" : "hover:bg-ink-800/50"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink-100">{problem.title}</span>
                        <span className="block truncate text-[11px] text-ink-500">{problem.topics.join(" · ")}</span>
                      </span>
                      <DifficultyBadge difficulty={problem.difficulty} />
                      {selected && <Check className="h-4 w-4 shrink-0 text-ink-100" />}
                    </button>
                  );
                })}
              </div>
              {chosen && !isTestableLanguage(language) && (
                <p className="mt-2 text-[11px] text-ink-400">
                  Tests run in JavaScript, TypeScript and Python. Switch the room&apos;s language to use them.
                </p>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value.slice(0, 120))}
                placeholder="Title, like “Design an LRU cache”"
                className={ui.input}
              />
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value.slice(0, 5000))}
                rows={5}
                placeholder="The question. Your candidate sees it when the countdown ends. You can write hints for it during the interview."
                className={ui.textarea}
              />
            </div>
          )}
        </section>

        {/* How long */}
        <section>
          <Label>Length</Label>
          <div className="flex gap-1.5">
            {LENGTHS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => setDurationMin(minutes)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium tabular-nums transition-colors ${
                  durationMin === minutes
                    ? "border-ink-100 bg-ink-100 text-ink-950"
                    : "border-ink-800 bg-ink-900 text-ink-300 hover:border-ink-600"
                }`}
              >
                {minutes} min
              </button>
            ))}
          </div>
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-xs text-ink-300">
            <input
              type="checkbox"
              checked={cleanStart}
              onChange={(e) => setCleanStart(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-ink-100"
            />
            <span>
              Start from a clean editor
              <span className="block text-ink-500">
                {source === "problem" ? "Replaces the code with the problem's starter code." : "Clears the editor."}
              </span>
            </span>
          </label>
        </section>
      </div>

      <div className="flex items-center gap-3 border-t border-ink-800 px-5 py-4">
        <p className="min-w-0 flex-1 text-[11px] text-ink-500">
          {error ?? "Everyone in the room sees a 3-2-1 countdown, then the question."}
        </p>
        <button
          type="button"
          onClick={start}
          disabled={!ready || busy}
          className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-ink-100 px-5 text-sm font-semibold text-ink-950 transition-all hover:bg-ink-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Start interview
        </button>
      </div>
    </motion.div>
  );
}

export function InterviewSetup({ open, ...props }: InterviewSetupProps) {
  useEscape(open, props.onClose);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:px-4"
          onClick={props.onClose}
        >
          <SetupCard {...props} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}