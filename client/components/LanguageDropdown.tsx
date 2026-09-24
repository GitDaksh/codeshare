"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { LANGUAGES } from "@/lib/languages";

const SHORT_LABELS: Record<string, string> = {
  javascript: "JS",
  typescript: "TS",
  python: "PY",
  cpp: "C++",
  java: "JAVA",
};

type LanguageDropdownProps = {
  value: string;
  onChange: (value: string) => void;
};

export function LanguageDropdown({ value, onChange }: LanguageDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Language: ${current?.label ?? "Choose language"}`}
        className={`flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
          open
            ? "border-ink-500 bg-ink-800 text-ink-100"
            : "border-ink-700 bg-ink-900 text-ink-100 hover:border-ink-500"
        }`}
      >
        <span className="rounded border border-ink-700 bg-ink-950 px-1 font-[family-name:var(--font-mono)] text-[9px] font-semibold leading-4 text-ink-300">
          {SHORT_LABELS[value] ?? "</>"}
        </span>
        <span className="hidden sm:inline">{current?.label ?? "Language"}</span>
        <ChevronDown className={`h-3 w-3 text-ink-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-full z-30 mt-1.5 w-48 overflow-hidden rounded-xl border border-ink-700 bg-ink-900/95 p-1 shadow-2xl shadow-black/60 backdrop-blur-xl"
          >
            {LANGUAGES.map((lang) => {
              const selected = lang.value === value;
              return (
                <button
                  key={lang.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(lang.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-ink-800 hover:text-ink-100 ${
                    selected ? "bg-ink-800 text-ink-100" : "text-ink-300"
                  }`}
                >
                  <span className="w-8 shrink-0 font-[family-name:var(--font-mono)] text-[9px] font-semibold text-ink-500">
                    {SHORT_LABELS[lang.value]}
                  </span>
                  <span className="flex-1 font-medium">{lang.label}</span>
                  {selected && <Check className="h-3.5 w-3.5 text-ink-100" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}