"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Play, X, Loader2, Terminal } from "lucide-react";
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
          transition={{ duration: 0.22, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="flex shrink-0 flex-col overflow-hidden border-t border-ink-800 bg-ink-950"
        >
          <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-ink-800 px-3">
            <div className="flex min-w-0 items-center gap-2 text-xs">
              <span className={`flex items-center gap-1.5 font-semibold text-ink-100 ${runner ? "hidden sm:flex" : ""}`}>
                <Terminal className="h-3.5 w-3.5 text-ink-400" />
                Output
              </span>
              {runner && (
                <span className="flex min-w-0 items-center gap-1.5 rounded-full border border-ink-700 bg-ink-900 py-0.5 pl-0.5 pr-2 text-[11px] text-ink-400">
                  <AvatarIcon avatarId={runner.avatarId} className="h-4 w-4 shrink-0 rounded-full" />
                  <span className="truncate font-medium text-ink-100">{runner.isSelf ? "You" : runner.name}</span>
                  <span className="shrink-0">{status === "running" ? "running" : "ran"}</span>
                  <span className="hidden shrink-0 sm:inline">{languageLabel(runState.language)}</span>
                  {status === "done" && result && (
                    <span className="shrink-0 tabular-nums text-ink-500">· {Math.round(result.durationMs)}ms</span>
                  )}
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {status === "done" && (
                <button
                  onClick={onClear}
                  className="h-7 rounded-lg px-2 text-xs text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100"
                >
                  Clear
                </button>
              )}
              <button
                onClick={onRun}
                disabled={!canRun || selfRunning}
                className="flex h-7 items-center gap-1.5 rounded-lg bg-ink-100 px-2.5 text-xs font-semibold text-ink-950 transition-all hover:bg-white active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {selfRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                Run
              </button>
              <button
                onClick={onClose}
                aria-label="Close output panel"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 font-[family-name:var(--font-mono)] text-xs leading-5">
            {status === "running" ? (
              <p className="flex flex-wrap items-center gap-2 text-ink-300">
                <Loader2 className="h-3 w-3 animate-spin" />
                Running…
                {runState.language === "python" && runner?.isSelf && (
                  <span className="text-ink-500">(the first Python run downloads the runtime, which takes a few seconds)</span>
                )}
              </p>
            ) : status === "done" && result ? (
              <div className="space-y-2">
                {result.output && <pre className="whitespace-pre-wrap break-words text-ink-100">{result.output}</pre>}
                {result.error && (
                  <pre className="whitespace-pre-wrap break-words border-l-2 border-red-500/70 pl-3 text-red-300">
                    {result.error}
                  </pre>
                )}
                {!result.output && !result.error && <p className="text-ink-400">Ran with no output.</p>}
              </div>
            ) : !canRun ? (
              <p className="text-ink-400">
                Running {languageLabel(language)} isn&apos;t supported yet. JavaScript, TypeScript, and Python only,
                for now.
              </p>
            ) : (
              <p className="text-ink-400">
                <span className="hidden sm:inline">
                  Press <kbd className="rounded border border-ink-700 bg-ink-900 px-1 text-ink-300">⌘↵</kbd> or{" "}
                </span>
                Run to execute. Output is shared with everyone in the room.
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}