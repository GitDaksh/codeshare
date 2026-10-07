"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export type MenuEntry =
  | {
      kind?: "item";
      id: string;
      label: string;
      icon: LucideIcon;
      onSelect: () => void;
      disabled?: boolean;
      // A keyboard shortcut shown on the right.
      hint?: string;
    }
  | { kind: "separator"; id: string };

// A button that opens a list of labeled actions. Closes on a click outside,
// on Escape, and after choosing.
export function Menu({
  label,
  icon,
  entries,
  align = "end",
  triggerClassName,
}: {
  label: string;
  icon: ReactNode;
  entries: MenuEntry[];
  align?: "start" | "end";
  triggerClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Separators only between groups that both have items.
  const visible = entries.filter((entry, i) => {
    if (entry.kind !== "separator") return true;
    const before = entries.slice(0, i).some((e) => e.kind !== "separator");
    const next = entries[i + 1];
    return before && !!next && next.kind !== "separator";
  });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {icon}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            style={{ transformOrigin: align === "end" ? "top right" : "top left" }}
            className={`absolute top-full z-40 mt-2 w-60 rounded-xl border border-ink-800 bg-ink-900 p-1.5 shadow-raised ${
              align === "end" ? "right-0" : "left-0"
            }`}
          >
            {visible.map((entry) => {
              if (entry.kind === "separator") return <div key={entry.id} className="my-1 h-px bg-ink-800" />;
              const Icon = entry.icon;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="menuitem"
                  disabled={entry.disabled}
                  onClick={() => {
                    setOpen(false);
                    entry.onSelect();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100 disabled:pointer-events-none disabled:opacity-40"
                >
                  <Icon className="h-4 w-4 shrink-0 text-ink-500" />
                  <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                  {entry.hint && (
                    <kbd className="shrink-0 font-[family-name:var(--font-mono)] text-[10px] text-ink-500">{entry.hint}</kbd>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}