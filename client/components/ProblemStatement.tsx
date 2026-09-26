"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
import { exampleTests, formatArgs, type Problem } from "@/lib/problems";
import { formatValue } from "@/lib/judge";

// Supports `inline code` and **bold** inside problem text.
export function renderRichText(text: string): ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return (
        <code
          key={i}
          className="rounded border border-ink-700 bg-ink-800 px-1 py-0.5 font-[family-name:var(--font-mono)] text-[0.85em] text-ink-100"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-ink-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

type ProblemStatementProps = {
  problem: Problem;
  compact?: boolean;
};

export function ProblemStatement({ problem, compact = false }: ProblemStatementProps) {
  const [showHint, setShowHint] = useState(false);
  const examples = exampleTests(problem);

  return (
    <div className={`space-y-7 leading-relaxed text-ink-300 ${compact ? "text-[13px]" : "text-[15px]"}`}>
      <div className="space-y-3">
        {problem.description.map((paragraph, i) => (
          <p key={i}>{renderRichText(paragraph)}</p>
        ))}
      </div>

      <section>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Examples</h3>
        <div className="space-y-3">
          {examples.map((example, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-ink-700 bg-ink-950/60">
              <div className="border-b border-ink-800 px-3.5 py-2 text-[11px] font-medium text-ink-400">
                Example {i + 1}
              </div>
              <dl className="space-y-1.5 px-3.5 py-3 font-[family-name:var(--font-mono)] text-[12px] leading-5">
                <div className="flex gap-3">
                  <dt className="w-14 shrink-0 text-ink-500">Input</dt>
                  <dd className="min-w-0 break-words text-ink-100">{formatArgs(problem, example.args)}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-14 shrink-0 text-ink-500">Output</dt>
                  <dd className="min-w-0 break-words text-ink-100">{formatValue(example.expected)}</dd>
                </div>
                {example.explanation && (
                  <div className="flex gap-3">
                    <dt className="w-14 shrink-0 text-ink-500">Why</dt>
                    <dd className="min-w-0 font-sans text-[12px] text-ink-300">{example.explanation}</dd>
                  </div>
                )}
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Constraints</h3>
        <ul className="space-y-1.5">
          {problem.constraints.map((constraint, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-ink-500" />
              <span>{renderRichText(constraint)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <button
          type="button"
          onClick={() => setShowHint((s) => !s)}
          aria-expanded={showHint}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800 px-3 py-1.5 text-xs font-medium text-ink-100 transition-colors hover:border-ink-500"
        >
          <Lightbulb className="h-3.5 w-3.5" />
          {showHint ? "Hide hint" : "Show a hint"}
        </button>
        <AnimatePresence initial={false}>
          {showHint && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <p className="mt-3 rounded-xl border border-dashed border-ink-700 bg-ink-950/50 px-3.5 py-3 text-ink-300">
                {renderRichText(problem.hint)}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}