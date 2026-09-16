"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { LANGUAGES } from "@/lib/languages";

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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1 text-xs text-ink-300 transition-colors hover:border-ink-500"
      >
        {current?.label ?? "Language"}
        <ChevronDown className="h-3 w-3 text-ink-500" />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-20 mt-1.5 w-36 overflow-hidden rounded-md border border-ink-700 bg-ink-900 py-1 shadow-xl"
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              role="option"
              aria-selected={lang.value === value}
              onClick={() => {
                onChange(lang.value);
                setOpen(false);
              }}
              className={`block w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-ink-800 ${
                lang.value === value ? "text-ink-100" : "text-ink-400"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}