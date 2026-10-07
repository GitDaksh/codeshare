"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

type Option<T extends string> = { value: T; label: ReactNode; count?: number };

// One look for every set of tabs and toggles: a quiet track with the chosen
// option raised on a white chip.
export function Segmented<T extends string>({
  id,
  value,
  options,
  onChange,
  size = "md",
  fill = false,
  className = "",
}: {
  // Unique per page (it names the sliding chip's animation).
  id: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  // Stretch across the full width, options sharing it equally.
  fill?: boolean;
  className?: string;
}) {
  return (
    <div role="tablist" className={`${fill ? "flex w-full" : "inline-flex"} rounded-lg border border-ink-800 bg-ink-950 p-0.5 ${className}`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`relative flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors ${fill ? "flex-1" : ""} ${
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm"
            } ${active ? "text-ink-100" : "text-ink-500 hover:text-ink-100"}`}
          >
            {active && (
              <motion.span
                layoutId={`segmented-${id}`}
                className="absolute inset-0 rounded-md bg-ink-900 shadow-xs ring-1 ring-ink-800"
                transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
              />
            )}
            <span className="relative">{option.label}</span>
            {option.count !== undefined && (
              <span className="relative rounded bg-ink-800 px-1 text-[10px] tabular-nums text-ink-500">{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}