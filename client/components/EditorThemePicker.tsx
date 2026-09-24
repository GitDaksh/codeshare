"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { EDITOR_THEMES } from "@/lib/editorTheme";

type EditorThemePickerProps = {
  value: string;
  onChange: (id: string) => void;
};

function Swatches({ colors, size = "sm" }: { colors: string[]; size?: "sm" | "md" }) {
  const dot = size === "sm" ? "h-1.5 w-1.5" : "h-2.5 w-2.5";
  return (
    <span className="flex items-center gap-0.5">
      {colors.map((color) => (
        <span key={color} className={`${dot} rounded-full`} style={{ backgroundColor: color }} />
      ))}
    </span>
  );
}

export function EditorThemePicker({ value, onChange }: EditorThemePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = EDITOR_THEMES.find((theme) => theme.id === value) ?? EDITOR_THEMES[0];

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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Editor theme"
        className={`flex items-center gap-1.5 rounded px-1 transition-colors hover:bg-ink-900 hover:text-ink-100 ${
          open ? "bg-ink-900 text-ink-100" : ""
        }`}
      >
        <Swatches colors={current.swatches} />
        <span className="hidden sm:inline">{current.label}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            style={{ transformOrigin: "bottom right" }}
            className="absolute bottom-full right-0 z-40 mb-2 w-60 overflow-hidden rounded-xl border border-ink-800 bg-ink-900/95 p-1 shadow-2xl shadow-black/60 backdrop-blur-xl"
          >
            <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-600">
              Editor theme
            </p>
            {EDITOR_THEMES.map((theme) => {
              const selected = theme.id === value;
              return (
                <button
                  key={theme.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(theme.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-ink-800 ${
                    selected ? "bg-ink-800/60" : ""
                  }`}
                >
                  <Swatches colors={theme.swatches} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-ink-100">{theme.label}</span>
                    <span className="block truncate text-[10px] text-ink-500">{theme.description}</span>
                  </span>
                  {selected && <Check className="h-3.5 w-3.5 shrink-0 text-ink-100" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}