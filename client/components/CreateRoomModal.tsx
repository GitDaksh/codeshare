"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Code2, Loader2, Plus, X } from "lucide-react";
import { LANGUAGES, getStarterCode } from "@/lib/languages";
import { isRunnable } from "@/lib/execution";

type CreateRoomModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, language: string) => Promise<void>;
  defaultLanguage?: string;
};

const MAX_NAME_LENGTH = 60;
const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98];

const SHORT_LABELS: Record<string, string> = {
  javascript: "JS",
  typescript: "TS",
  python: "PY",
  cpp: "C++",
  java: "JAVA",
};

const NAME_IDEAS = ["Interview prep", "Pair programming", "DSA practice", "Hackathon", "Study group"];

function languageLabel(value: string): string {
  return LANGUAGES.find((l) => l.value === value)?.label ?? value;
}

export function CreateRoomModal({
  open,
  onClose,
  onCreate,
  defaultLanguage = "javascript",
}: CreateRoomModalProps) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState(defaultLanguage);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Each time the dialog opens with an empty name, start from the user's
  // favorite language (the prop may also arrive after the first render).
  useEffect(() => {
    if (open && !name) setLanguage(defaultLanguage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultLanguage]);

  // Escape closes the dialog.
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;

    setSubmitting(true);
    try {
      await onCreate(name.trim(), language);
      setName("");
      setLanguage(defaultLanguage);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  function applyIdea(idea: string) {
    setName(idea);
    inputRef.current?.focus();
  }

  const runnable = isRunnable(language);
  const trimmedName = name.trim();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          // Bottom sheet on phones (sits above the keyboard); centered dialog on larger screens.
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:px-4"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-room-title"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-ink-700 bg-ink-900 shadow-2xl shadow-black/70 sm:max-w-lg sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit}>
              {/* ---------- Header ---------- */}
              <div className="flex items-start justify-between gap-4 border-b border-ink-800 px-5 pb-4 pt-5 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ink-700 bg-ink-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <Code2 className="h-4.5 w-4.5 text-ink-100" />
                  </div>
                  <div>
                    <h2
                      id="create-room-title"
                      className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-ink-100"
                    >
                      New room
                    </h2>
                    <p className="text-xs text-ink-400">A live coding space. Share the link to invite others.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-6 px-5 py-5 sm:px-6">
                {/* ---------- Name ---------- */}
                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <label htmlFor="create-room-name" className="text-xs font-medium text-ink-300">
                      Room name
                    </label>
                    <span className="text-[11px] tabular-nums text-ink-500">
                      {name.length}/{MAX_NAME_LENGTH}
                    </span>
                  </div>
                  <input
                    id="create-room-name"
                    ref={inputRef}
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))}
                    placeholder="e.g. Interview prep"
                    enterKeyHint="done"
                    autoComplete="off"
                    className="h-12 w-full rounded-xl border border-ink-700 bg-black/40 px-4 text-sm text-ink-100 placeholder:text-ink-600 transition-colors focus:border-ink-500 focus:outline-none"
                  />
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {NAME_IDEAS.map((idea) => (
                      <button
                        key={idea}
                        type="button"
                        onClick={() => applyIdea(idea)}
                        className={`h-7 rounded-full border px-2.5 text-[11px] transition-colors ${
                          name === idea
                            ? "border-ink-300 bg-ink-800 text-ink-100"
                            : "border-ink-700 text-ink-400 hover:border-ink-500 hover:text-ink-100"
                        }`}
                      >
                        {idea}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ---------- Language ---------- */}
                <div>
                  <span className="mb-2 block text-xs font-medium text-ink-300">Language</span>
                  <div role="radiogroup" aria-label="Language" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {LANGUAGES.map((lang) => {
                      const selected = language === lang.value;
                      return (
                        <button
                          key={lang.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setLanguage(lang.value)}
                          className={`relative flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition-all duration-200 ${
                            selected
                              ? "border-ink-100 bg-ink-800 shadow-[0_0_24px_-10px_rgba(255,255,255,0.5)]"
                              : "border-ink-700 bg-ink-950/60 hover:border-ink-500"
                          }`}
                        >
                          <span
                            className={`font-[family-name:var(--font-mono)] text-xs font-bold ${
                              selected ? "text-ink-100" : "text-ink-400"
                            }`}
                          >
                            {SHORT_LABELS[lang.value] ?? "</>"}
                          </span>
                          <span className={`text-[11px] ${selected ? "text-ink-100" : "text-ink-400"}`}>
                            {lang.label}
                          </span>
                          {selected && (
                            <motion.span
                              layoutId="create-room-language-check"
                              transition={{ type: "spring", stiffness: 500, damping: 35 }}
                              className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink-100"
                            >
                              <Check className="h-2.5 w-2.5 text-ink-950" strokeWidth={3} />
                            </motion.span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2.5 text-[11px] text-ink-400">
                    {runnable ? (
                      <>
                        Runs right in the browser. Press{" "}
                        <kbd className="rounded border border-ink-700 bg-ink-950 px-1 font-[family-name:var(--font-mono)] text-ink-300">
                          ⌘↵
                        </kbd>{" "}
                        in the room.
                      </>
                    ) : (
                      <>Edit and share live. Running {languageLabel(language)} isn&apos;t supported yet.</>
                    )}
                  </p>
                </div>

                {/* ---------- Live preview ---------- */}
                <div>
                  <span className="mb-2 block text-xs font-medium text-ink-300">Preview</span>
                  <div className="overflow-hidden rounded-xl border border-ink-700 bg-ink-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-3.5 py-2.5">
                      <span
                        className={`truncate text-sm font-semibold ${trimmedName ? "text-ink-100" : "text-ink-600"}`}
                      >
                        {trimmedName || "Untitled room"}
                      </span>
                      <span className="shrink-0 rounded-md border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium text-ink-300">
                        {languageLabel(language)}
                      </span>
                    </div>
                    <div className="flex gap-3 bg-black/40 px-3.5 py-2.5 font-[family-name:var(--font-mono)] text-[11px] leading-5">
                      <span className="shrink-0 text-ink-600">1</span>
                      <span className="truncate text-ink-400">{getStarterCode(language)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ---------- Footer ---------- */}
              <div className="flex items-center justify-between gap-3 border-t border-ink-800 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-4">
                <span className="hidden items-center gap-3 text-[11px] text-ink-500 sm:flex">
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-ink-700 bg-ink-950 px-1 font-[family-name:var(--font-mono)] text-ink-300">
                      ↵
                    </kbd>
                    create
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-ink-700 bg-ink-950 px-1 font-[family-name:var(--font-mono)] text-ink-300">
                      esc
                    </kbd>
                    close
                  </span>
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-10 rounded-full px-4 text-sm text-ink-300 transition-colors hover:text-ink-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!trimmedName || submitting}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink-100 px-5 text-sm font-semibold text-ink-950 shadow-[0_0_24px_-8px_rgba(255,255,255,0.55)] transition-all hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-ink-400 disabled:shadow-none"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {submitting ? "Creating…" : "Create room"}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}