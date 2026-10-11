"use client";

import { useMemo, type ReactNode } from "react";
import { KIND_CLASS, tokenize, type CodeLanguage, type Token } from "@/lib/games/highlight";

// Highlighted code with line numbers, for the quiz games. Lines can be made
// clickable (Bug Hunt) and decorated (the bug, the fix).

function splitLines(tokens: Token[]): Token[][] {
  const lines: Token[][] = [[]];
  for (const token of tokens) {
    const parts = token.text.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ text: part, kind: token.kind });
    });
  }
  return lines;
}

export function CodeLine({ tokens }: { tokens: Token[] }) {
  return (
    <>
      {tokens.map((token, i) => (
        <span key={i} className={KIND_CLASS[token.kind]}>
          {token.text}
        </span>
      ))}
    </>
  );
}

export function useCodeLines(code: string, language: CodeLanguage) {
  return useMemo(() => splitLines(tokenize(code, language)), [code, language]);
}

export function CodeBlock({
  code,
  language,
  lineClass,
  onLine,
  after,
  className = "",
}: {
  code: string;
  language: CodeLanguage;
  // Extra classes for a line (by index), e.g. the selected or buggy line.
  lineClass?: (index: number) => string;
  // Makes lines clickable.
  onLine?: (index: number) => void;
  // Something to show under a line (Bug Hunt's fix).
  after?: (index: number) => ReactNode;
  className?: string;
}) {
  const lines = useCodeLines(code, language);
  return (
    <div className={`gs-code overflow-x-auto py-3 font-[family-name:var(--font-mono)] text-[13px] leading-6 sm:text-sm sm:leading-7 ${className}`}>
      {lines.map((tokens, i) => {
        const content = (
          <>
            <span className="w-9 shrink-0 select-none pr-3 text-right text-ink-600">{i + 1}</span>
            <span className="min-w-0 whitespace-pre pr-4">
              <CodeLine tokens={tokens} />
            </span>
          </>
        );
        return (
          <div key={i}>
            {onLine ? (
              <button
                type="button"
                onClick={() => onLine(i)}
                className={`flex w-full text-left transition-colors hover:bg-ink-800/70 ${lineClass?.(i) ?? ""}`}
              >
                {content}
              </button>
            ) : (
              <div className={`flex ${lineClass?.(i) ?? ""}`}>{content}</div>
            )}
            {after?.(i)}
          </div>
        );
      })}
    </div>
  );
}
