"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Play, X, Loader2 } from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
import { LANGUAGES } from "@/lib/languages";
import { isRunnable, type RunState } from "@/lib/execution";

type RunPanelProps = {
  open: boolean;
  onClose: () => void;
  onRun: () => void;
  onClear: () => void;
  runState: RunState;
  language: string;
};

function languageLabel(value: string | null): string {
  return LANGUAGES.find((l) => l.value === value)?.label ?? value ?? "";
}

export function RunPanel({ open, onClose, onRun, onClear, runState, language }: RunPanelProps) {
  const canRun = isRunnable(language);
  const { status, result, runner } = runState;
  const selfRunning = status === "running" && !!runner?.isSelf;

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 220, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="flex shrink-0 flex-col overflow-hidden border-t border-ink-800 bg-ink-950"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-ink-800 px-3 py-1.5 sm:gap-3">
            <div className="flex min-w-0 items-center gap-2 text-xs">
              <span
                className={`font-medium uppercase tracking-wide text-ink-500 ${runner ? "hidden sm:inline" : ""}`}
              >
                Output
              </span>
              {runner && (
                <span className="flex min-w-0 items-center gap-1.5 text-ink-500">
                  <span className="hidden text-ink-700 sm:inline">·</span>
                  <AvatarIcon avatarId={runner.avatarId} className="h-4 w-4 shrink-0 rounded-full" />
                  <span className="truncate text-ink-300">{runner.isSelf ? "You" : runner.name}</span>
                  <span className="shrink-0">{status === "running" ? "running" : "ran"}</span>
                  <span className="hidden shrink-0 sm:inline">{languageLabel(runState.language)}</span>
                  {status === "done" && result && (
                    <span className="shrink-0 text-ink-600">{Math.round(result.durationMs)}ms</span>
                  )}
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {status === "done" && (
                <button
                  onClick={onClear}
                  className="rounded-md px-2 py-1 text-xs text-ink-500 transition-colors hover:text-ink-100"
                >
                  Clear
                </button>
              )}
              <button
                onClick={onRun}
                disabled={!canRun || selfRunning}
                className="flex items-center gap-1.5 rounded-md bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {selfRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                Run
              </button>
              <button
                onClick={onClose}
                aria-label="Close output panel"
                className="rounded-md p-1.5 text-ink-500 transition-colors hover:text-ink-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 font-[family-name:var(--font-mono)] text-xs">
            {status === "running" ? (
              <p className="flex flex-wrap items-center gap-2 text-ink-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Running…
                {runState.language === "python" && runner?.isSelf && (
                  <span className="text-ink-600">(the first Python run downloads the runtime, which takes a few seconds)</span>
                )}
              </p>
            ) : status === "done" && result ? (
              <>
                {result.output && <pre className="whitespace-pre-wrap break-words text-ink-300">{result.output}</pre>}
                {result.error && <pre className="whitespace-pre-wrap break-words text-red-400">{result.error}</pre>}
                {!result.output && !result.error && <p className="text-ink-600">Ran with no output.</p>}
              </>
            ) : !canRun ? (
              <p className="text-ink-600">
                Running {languageLabel(language)} isn&apos;t supported yet. JavaScript, TypeScript, and Python only,
                for now.
              </p>
            ) : (
              <p className="text-ink-600">
                <span className="hidden sm:inline">
                  Press <kbd className="rounded border border-ink-700 px-1 text-ink-400">⌘↵</kbd> /{" "}
                  <kbd className="rounded border border-ink-700 px-1 text-ink-400">Ctrl+↵</kbd> or{" "}
                </span>
                Tap Run to execute. Output is shared with everyone in the room.
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}