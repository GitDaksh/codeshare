"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play, X, Loader2 } from "lucide-react";
import { runJavaScript, runTypeScript, runPython, type ExecutionResult } from "@/lib/execution";

type RunPanelProps = {
  getCode: () => string;
  language: string;
  open: boolean;
  onClose: () => void;
};

const RUNNABLE_LANGUAGES = new Set(["javascript", "typescript", "python"]);

export function RunPanel({ getCode, language, open, onClose }: RunPanelProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);

  const canRun = RUNNABLE_LANGUAGES.has(language);

  async function handleRun() {
    setRunning(true);
    setResult(null);

    const code = getCode();
    let res: ExecutionResult;

    if (language === "javascript") {
      res = await runJavaScript(code);
    } else if (language === "typescript") {
      res = await runTypeScript(code);
    } else if (language === "python") {
      res = await runPython(code);
    } else {
      res = { output: "", error: "This language can't be run yet.", durationMs: 0 };
    }

    setResult(res);
    setRunning(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 192, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="flex flex-col overflow-hidden border-t border-ink-800 bg-ink-950"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-ink-800 px-3 py-1.5">
            <div className="flex items-center gap-2">
              <button
                onClick={handleRun}
                disabled={!canRun || running}
                className="flex items-center gap-1.5 rounded-md bg-ink-100 px-3 py-1 text-xs font-medium text-ink-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                {running ? "Running…" : "Run"}
              </button>
              {result && <span className="text-xs text-ink-500">{Math.round(result.durationMs)}ms</span>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close output panel"
              className="rounded-md p-1 text-ink-500 transition-colors hover:text-ink-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 font-[family-name:var(--font-mono)] text-xs">
            {!canRun ? (
              <p className="text-ink-600">
                Running code isn&apos;t supported for this language yet — JavaScript, TypeScript, and
                Python only, for now.
              </p>
            ) : running ? (
              <p className="text-ink-600">Running…</p>
            ) : result ? (
              <>
                {result.output && <pre className="whitespace-pre-wrap text-ink-300">{result.output}</pre>}
                {result.error && <pre className="whitespace-pre-wrap text-red-400">{result.error}</pre>}
                {!result.output && !result.error && <p className="text-ink-600">Ran with no output.</p>}
              </>
            ) : (
              <p className="text-ink-600">Click Run to execute this code.</p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}