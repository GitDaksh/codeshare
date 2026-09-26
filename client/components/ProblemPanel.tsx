"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  FlaskConical,
  Loader2,
  XCircle,
} from "lucide-react";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { ProblemStatement } from "@/components/ProblemStatement";
import { formatArgs, isTestableLanguage, type Problem } from "@/lib/problems";
import { formatValue } from "@/lib/judge";
import type { TestCaseResult, TestRunReport } from "@/lib/execution";

type ProblemPanelProps = {
  problem: Problem;
  language: string;
  report: TestRunReport | null;
  running: boolean;
  solved: boolean;
  onRunTests: () => void;
};

type View = "description" | "tests";

function StatusIcon({ status }: { status: TestCaseResult["status"] }) {
  if (status === "passed") return <CheckCircle2 className="h-4 w-4 shrink-0 text-ink-100" />;
  if (status === "failed") return <XCircle className="h-4 w-4 shrink-0 text-red-400" />;
  if (status === "error") return <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />;
  return <Circle className="h-4 w-4 shrink-0 text-ink-600" />;
}

function DetailRow({ label, value, tone = "normal" }: { label: string; value: string; tone?: "normal" | "error" }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wider text-ink-500">{label}</p>
      <pre
        className={`max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border px-2.5 py-2 font-[family-name:var(--font-mono)] text-[11px] leading-5 ${
          tone === "error" ? "border-red-500/30 bg-red-500/5 text-red-300" : "border-ink-800 bg-ink-950 text-ink-100"
        }`}
      >
        {value}
      </pre>
    </div>
  );
}

export function ProblemPanel({ problem, language, report, running, solved, onRunTests }: ProblemPanelProps) {
  // Reopen on the results if tests already ran (e.g. after visiting Chat).
  const [view, setView] = useState<View>(() => (report ? "tests" : "description"));
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const testable = isTestableLanguage(language);
  const total = problem.tests.length;

  // Show results as soon as a run starts.
  useEffect(() => {
    if (running) setView("tests");
  }, [running]);

  // After each run, open the first test that didn't pass.
  useEffect(() => {
    if (!report) return;
    const firstProblem = report.results.find((r) => r.status === "failed" || r.status === "error");
    setOpenIndex(firstProblem ? firstProblem.index : null);
  }, [report]);

  const allPassed = !!report && report.outcome === "completed" && report.passed === report.total;
  const results: TestCaseResult[] =
    report?.results ??
    problem.tests.map((_, index) => ({ index, status: "not-run" as const, actual: null, error: null, ms: null }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ---------- Header ---------- */}
      <div className="border-b border-ink-800 px-4 pb-3 pt-3 md:pt-1">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-ink-100">
            {problem.title}
          </h2>
          {solved && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-950">
              <Check className="h-3 w-3" strokeWidth={3} />
              Solved
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <DifficultyBadge difficulty={problem.difficulty} />
          {problem.topics.map((topic) => (
            <span
              key={topic}
              className="rounded-full border border-ink-700 px-2 py-0.5 text-[11px] text-ink-400"
            >
              {topic}
            </span>
          ))}
        </div>

        <div className="mt-3 flex rounded-lg border border-ink-800 bg-ink-950/60 p-1">
          {(["description", "tests"] as const).map((tab) => {
            const active = view === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setView(tab)}
                className="relative flex-1 rounded-md px-3 py-1.5 text-xs font-medium"
              >
                {active && (
                  <motion.span
                    layoutId="problem-panel-pill"
                    className="absolute inset-0 rounded-md bg-ink-800 ring-1 ring-ink-700"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                  />
                )}
                <span
                  className={`relative inline-flex items-center gap-1.5 transition-colors ${
                    active ? "text-ink-100" : "text-ink-400 hover:text-ink-100"
                  }`}
                >
                  {tab === "description" ? "Problem" : "Tests"}
                  {tab === "tests" && (
                    <span className="rounded border border-ink-700 bg-ink-900 px-1 text-[10px] tabular-nums text-ink-300">
                      {report ? `${report.passed}/${report.total}` : total}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------- Body ---------- */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {view === "description" ? (
          <>
            <ProblemStatement problem={problem} compact />
            <Link
              href={`/practice/${problem.slug}`}
              className="group mt-6 inline-flex items-center gap-1 text-xs text-ink-400 transition-colors hover:text-ink-100"
            >
              Open the full problem page
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            {running ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-ink-700 bg-ink-950/60 px-3.5 py-3 text-sm text-ink-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                Running {total} tests…
              </div>
            ) : report ? (
              report.outcome !== "completed" ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-3.5 py-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-red-300">
                    <AlertTriangle className="h-4 w-4" />
                    {report.outcome === "timeout" ? "Tests stopped" : "Couldn't run the tests"}
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap break-words font-[family-name:var(--font-mono)] text-[11px] leading-5 text-red-300/90">
                    {report.message}
                  </p>
                </div>
              ) : (
                <div
                  className={`rounded-xl border px-3.5 py-3 ${
                    allPassed ? "border-ink-500 bg-ink-100/[0.06]" : "border-ink-700 bg-ink-950/60"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink-100">
                      {allPassed ? "All tests passed" : `${report.passed} of ${report.total} passed`}
                    </p>
                    <span className="text-[11px] tabular-nums text-ink-500">{Math.round(report.durationMs)} ms</span>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink-800">
                    <motion.div
                      className="h-full rounded-full bg-ink-100"
                      initial={{ width: 0 }}
                      animate={{ width: `${(report.passed / Math.max(report.total, 1)) * 100}%` }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  {allPassed && (
                    <p className="mt-2 text-xs text-ink-400">
                      {solved ? "Nice work. This problem is marked as solved." : "Nice work."}
                    </p>
                  )}
                </div>
              )
            ) : (
              <p className="rounded-xl border border-dashed border-ink-700 px-3.5 py-3 text-xs leading-relaxed text-ink-400">
                Run the tests to check your solution against {total} cases. Your function name must match the starter
                code.
              </p>
            )}

            {/* Per-test results */}
            <ul className="space-y-1.5">
              {results.map((result) => {
                const test = problem.tests[result.index];
                const open = openIndex === result.index;
                return (
                  <li key={result.index} className="overflow-hidden rounded-lg border border-ink-800 bg-ink-950/40">
                    <button
                      type="button"
                      onClick={() => setOpenIndex(open ? null : result.index)}
                      aria-expanded={open}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-ink-800/50"
                    >
                      <StatusIcon status={running ? "not-run" : result.status} />
                      <span className="font-medium text-ink-100">Test {result.index + 1}</span>
                      {test.example && (
                        <span className="rounded border border-ink-700 px-1 text-[10px] text-ink-400">Example</span>
                      )}
                      <span className="ml-auto flex items-center gap-2 text-[11px] tabular-nums text-ink-500">
                        {!running && result.ms !== null && `${result.ms < 1 ? "<1" : Math.round(result.ms)} ms`}
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2.5 border-t border-ink-800 px-3 py-3">
                            <DetailRow label="Input" value={formatArgs(problem, test.args)} />
                            <DetailRow label="Expected" value={formatValue(test.expected)} />
                            {!running && result.status === "error" && result.error && (
                              <DetailRow label="Error" value={result.error} tone="error" />
                            )}
                            {!running && (result.status === "passed" || result.status === "failed") && (
                              <DetailRow
                                label="Your output"
                                value={result.actual ?? "nothing"}
                                tone={result.status === "failed" ? "error" : "normal"}
                              />
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>

            {!running && report?.logs && (
              <div>
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-500">Console output</p>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-ink-800 bg-ink-950 px-2.5 py-2 font-[family-name:var(--font-mono)] text-[11px] leading-5 text-ink-300">
                  {report.logs}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---------- Footer ---------- */}
      <div className="border-t border-ink-800 p-3">
        {testable ? (
          <button
            type="button"
            onClick={onRunTests}
            disabled={running}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-ink-100 text-sm font-semibold text-ink-950 shadow-[0_0_24px_-10px_rgba(255,255,255,0.6)] transition-all hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            {running ? "Running tests…" : "Run tests"}
          </button>
        ) : (
          <p className="rounded-lg border border-dashed border-ink-700 px-3 py-2.5 text-center text-xs leading-relaxed text-ink-400">
            Tests run in JavaScript, TypeScript, and Python. Switch the room&apos;s language to test your solution.
          </p>
        )}
      </div>
    </div>
  );
}