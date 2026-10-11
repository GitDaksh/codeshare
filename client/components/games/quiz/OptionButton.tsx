"use client";

import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import { Pickers } from "@/components/games/quiz/QuizFrame";
import type { Player } from "@/lib/games/types";

export type OptionState = "idle" | "mine" | "right" | "wrong" | "faded";

// One answer choice: a colored marker, the choice itself, and after the
// round, whether it was right and who picked it.
export function OptionButton({
  marker,
  color,
  children,
  state,
  disabled,
  pickers,
  onClick,
}: {
  marker: ReactNode;
  color: string;
  children: ReactNode;
  state: OptionState;
  disabled: boolean;
  pickers?: Player[];
  onClick: () => void;
}) {
  const ring =
    state === "right"
      ? "border-success-line bg-success-soft"
      : state === "wrong"
        ? "border-danger-line bg-danger-soft"
        : state === "mine"
          ? "border-ink-500 bg-ink-800"
          : "border-ink-800 bg-ink-900/90 enabled:hover:-translate-y-0.5 enabled:hover:border-ink-600 enabled:hover:shadow-card";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group flex min-h-14 w-full items-center gap-3 rounded-xl border p-2.5 text-left shadow-xs transition-[transform,border-color,background-color,box-shadow,opacity] duration-200 disabled:cursor-default ${ring} ${state === "faded" ? "opacity-45" : ""}`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white shadow-xs" style={{ background: color }}>
        {marker}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      <Pickers players={pickers} />
      {state === "right" && <Check className="h-5 w-5 shrink-0 text-success" />}
      {state === "wrong" && <X className="h-5 w-5 shrink-0 text-danger" />}
      {state === "mine" && <span className="shrink-0 text-xs font-medium text-ink-400">Locked in</span>}
    </button>
  );
}

export function optionState(choice: number, mine: number | null, correct: number, revealed: boolean): OptionState {
  if (!revealed) return mine === choice ? "mine" : mine === null ? "idle" : "faded";
  if (choice === correct) return "right";
  if (choice === mine) return "wrong";
  return "faded";
}
