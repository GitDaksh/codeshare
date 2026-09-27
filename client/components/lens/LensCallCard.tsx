"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Play, ScanEye } from "lucide-react";
import { helperTip, type LensCallable } from "@/lib/lensCall";

const SECONDARY =
  "inline-flex h-8 items-center rounded-lg border border-ink-700 px-3 text-xs font-medium text-ink-300 transition-colors hover:border-ink-500 hover:text-ink-100";

function listLabels(callables: LensCallable[]): string {
  const labels = callables.slice(0, 3).map((callable) => callable.label);
  if (callables.length > 3) labels.push(`${callables.length - 3} more`);
  return labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

// Shown when a recording would only show definitions: nothing called the
// code. Offers one call to add at the end, for this run only.
export function LensCallCard({
  language,
  callables,
  defaultCall,
  busy = false,
  error = null,
  onSubmit,
  onShowAnyway,
  onCancel,
  testLabel,
  onUseTest,
}: {
  language: string;
  callables: LensCallable[];
  defaultCall: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (call: string) => void;
  onShowAnyway: () => void;
  onCancel: () => void;
  // Practice rooms can run a test instead.
  testLabel?: string;
  onUseTest?: () => void;
}) {
  const [call, setCall] = useState(defaultCall);
  const inputRef = useRef<HTMLInputElement>(null);

  // Puts the cursor inside the parentheses, ready to type the arguments.
  const focusCall = (text: string) => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const at = text.endsWith(")") ? text.length - 1 : text.length;
    input.setSelectionRange(at, at);
  };

  useEffect(() => {
    focusCall(defaultCall);
  }, [defaultCall]);

  const choose = (template: string) => {
    setCall(template);
    requestAnimationFrame(() => focusCall(template));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (call.trim() && !busy) onSubmit(call.trim());
  };

  const onKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === "Escape") onCancel();
  };

  const count = callables.length;
  const summary = count
    ? `Your code defines ${listLabels(callables)}, but nothing calls ${count === 1 ? "it" : "them"}.`
    : "Your code only defines things; nothing uses them yet.";

  return (
    <div
      className="w-full max-w-lg rounded-2xl border border-ink-700 bg-ink-900 p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]"
      onKeyDown={onKeyDown}
      role="dialog"
      aria-label="Nothing ran yet"
    >
      <div className="flex items-center gap-2 text-ink-100">
        <ScanEye className="h-4 w-4" aria-hidden="true" />
        <h2 className="text-sm font-semibold">Nothing ran yet</h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink-400">
        {summary} Lens shows code while it runs, so give it a call to make.
      </p>

      <form onSubmit={submit} className="mt-4 flex gap-2">
        <input
          ref={inputRef}
          value={call}
          onChange={(event) => setCall(event.target.value)}
          placeholder="solve([1, 2, 3])"
          aria-label="Call to visualize"
          spellCheck={false}
          autoComplete="off"
          className="h-9 min-w-0 flex-1 rounded-lg border border-ink-700 bg-ink-950 px-3 font-mono text-sm text-ink-100 outline-none transition-colors placeholder:text-ink-600 focus:border-ink-500"
        />
        <button
          type="submit"
          disabled={busy || !call.trim()}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-ink-100 px-3 text-sm font-semibold text-ink-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Play className="h-3.5 w-3.5" aria-hidden="true" />
          Visualize
        </button>
      </form>

      {error && (
        <p className="mt-2 whitespace-pre-wrap break-words border-l-2 border-red-500/70 pl-2 font-mono text-xs text-red-300">
          {error}
        </p>
      )}

      {count > 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-ink-500">Try:</span>
          {callables.slice(0, 8).map((callable) => (
            <button
              key={callable.label}
              type="button"
              onClick={() => choose(callable.template)}
              className="max-w-full truncate rounded-full border border-ink-700 px-2 py-0.5 font-mono text-[11px] text-ink-300 transition-colors hover:border-ink-500 hover:text-ink-100"
            >
              {callable.label}
            </button>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-ink-500">Tip: {helperTip(language)}</p>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-ink-800 pt-3">
        {onUseTest && testLabel && (
          <button type="button" onClick={onUseTest} className={SECONDARY}>
            Visualize {testLabel} instead
          </button>
        )}
        <button type="button" onClick={onShowAnyway} className={SECONDARY}>
          Show the recording anyway
        </button>
        <button type="button" onClick={onCancel} className={SECONDARY}>
          Back to code
        </button>
      </div>
    </div>
  );
}