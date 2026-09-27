"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Check, ChevronDown, FlaskConical, X } from "lucide-react";
import { choiceLabel, type LensChoice } from "@/lib/lensPractice";
import type { RoomLensPractice } from "@/lib/useRoomLens";

const ACTION =
  "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-ink-700 px-2 text-xs font-medium text-ink-300 transition-colors hover:border-ink-500 hover:text-ink-100";
const ITEM =
  "flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-ink-800 focus-visible:bg-ink-800 focus-visible:outline-none";

function StatusMark({ status }: { status: string | null }) {
  if (status === "passed") return <Check className="h-3 w-3 shrink-0 text-ink-400" aria-label="passed" />;
  if (status === "failed" || status === "error") {
    return <X className="h-3 w-3 shrink-0 text-red-400" aria-label="failed" />;
  }
  return null;
}

// Practice rooms: what Lens runs (one of the tests, your own input, or just
// your code), shown in the Lens header. Picking something re-records it for
// everyone in the room.
export function LensTestPicker({
  practice,
  title,
  truncated,
}: {
  practice: RoomLensPractice;
  title: string;
  truncated: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "custom">("menu");
  const [texts, setTexts] = useState<string[]>([]);
  const [errors, setErrors] = useState<(string | null)[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const current = choiceLabel(title);
  const currentStatus = current.index !== null ? (practice.tests[current.index]?.status ?? null) : null;

  // Close on a click anywhere else.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // On phones the picker can sit near the left edge of the screen, so the
  // menu (which opens leftwards) is nudged back on screen if it would overflow.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!open || !menu) return;
    menu.style.transform = "";
    const { left, right } = menu.getBoundingClientRect();
    const margin = 8;
    const shift =
      left < margin ? margin - left : right > window.innerWidth - margin ? window.innerWidth - margin - right : 0;
    if (shift) menu.style.transform = `translateX(${shift}px)`;
  }, [open, view]);

  const show = (next: "menu" | "custom") => {
    setView(next);
    setTexts(practice.customTexts);
    setErrors([]);
    setOpen(true);
  };

  const pick = (choice: LensChoice) => {
    setOpen(false);
    practice.choose(choice);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problems = practice.submitCustom(texts);
    if (problems) setErrors(problems);
    else setOpen(false);
  };

  // Keys typed in here mustn't step the player behind it.
  const onKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === "Escape") setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative flex shrink-0 items-center gap-1.5" onKeyDown={onKeyDown}>
      {truncated && (
        <button
          type="button"
          onClick={() => show("custom")}
          className={`${ACTION} hidden sm:inline-flex`}
          title="This run reached Lens's 1,000-step limit"
        >
          Try a smaller input
        </button>
      )}
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : show("menu"))}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Choose what Lens runs"
        className={ACTION}
      >
        <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="max-w-[9rem] truncate">{current.label}</span>
        <StatusMark status={currentStatus} />
        <ChevronDown className="h-3 w-3 text-ink-500" aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full z-30 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-ink-700 bg-ink-900 p-1.5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.9)]"
        >
          {view === "menu" ? (
            <div role="menu" aria-label="What Lens runs">
              <p className="px-2 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wider text-ink-500">Visualize</p>
              <div className="max-h-56 overflow-y-auto">
                {practice.tests.map((test) => (
                  <button
                    key={test.index}
                    type="button"
                    role="menuitem"
                    onClick={() => pick({ kind: "test", index: test.index })}
                    className={`${ITEM} ${current.index === test.index ? "bg-ink-800/60 text-ink-100" : "text-ink-300"}`}
                  >
                    <span>Test {test.index + 1}</span>
                    <StatusMark status={test.status} />
                  </button>
                ))}
              </div>
              <div className="my-1 h-px bg-ink-800" />
              <button type="button" role="menuitem" onClick={() => show("custom")} className={`${ITEM} text-ink-300`}>
                Custom input…
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => pick({ kind: "code" })}
                className={`${ITEM} text-ink-300`}
              >
                Just my code
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-2.5 p-1.5" aria-label="Custom input">
              <p className="text-xs font-medium text-ink-100">Custom input</p>
              {practice.params.map((param, index) => (
                <label key={param.name} className="block">
                  <span className="font-mono text-[11px] text-ink-400">{param.name}</span>
                  <input
                    value={texts[index] ?? ""}
                    onChange={(event) =>
                      setTexts((prev) => prev.map((text, i) => (i === index ? event.target.value : text)))
                    }
                    autoFocus={index === 0}
                    spellCheck={false}
                    autoComplete="off"
                    aria-invalid={!!errors[index]}
                    className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-2 py-1.5 font-mono text-xs text-ink-100 outline-none transition-colors focus:border-ink-500"
                  />
                  {errors[index] && <span className="mt-1 block text-[11px] text-red-300">{errors[index]}</span>}
                </label>
              ))}
              <p className="text-[11px] leading-relaxed text-ink-500">
                Linked lists and trees are written as lists, just like the tests.
              </p>
              <div className="flex justify-end gap-1.5 pt-0.5">
                <button type="button" onClick={() => setView("menu")} className={ACTION}>
                  Back
                </button>
                <button
                  type="submit"
                  className="inline-flex h-7 items-center rounded-lg bg-ink-100 px-2.5 text-xs font-semibold text-ink-950 transition-colors hover:bg-white"
                >
                  Visualize
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}