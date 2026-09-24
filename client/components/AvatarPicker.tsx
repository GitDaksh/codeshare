"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Shuffle, Sparkles } from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
import { AVATAR_STYLES, generateSeedBatch, type AvatarStyleFilter } from "@/lib/avatars";

type AvatarPickerProps = {
  value: string;
  onChange: (seed: string) => void;
  batchSize?: number;
};

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98];

export function AvatarPicker({ value, onChange, batchSize = 23 }: AvatarPickerProps) {
  const [style, setStyle] = useState<AvatarStyleFilter>("all");
  // Current avatar stays first; selecting inside the grid never reorders it.
  const [seeds, setSeeds] = useState<string[]>(() => [value, ...generateSeedBatch(batchSize, "all")]);
  // Bumped on every shuffle so the new batch animates in as a fresh wave.
  const [batchKey, setBatchKey] = useState(0);

  function refresh(nextStyle: AvatarStyleFilter) {
    setSeeds([value, ...generateSeedBatch(batchSize, nextStyle)]);
    setBatchKey((k) => k + 1);
  }

  function handleStyleChange(next: AvatarStyleFilter) {
    setStyle(next);
    refresh(next);
  }

  function handleSurprise() {
    const pool = seeds.filter((s) => s !== value);
    if (pool.length === 0) return;
    onChange(pool[Math.floor(Math.random() * pool.length)]);
  }

  return (
    <div>
      {/* Style filters, each with a live sample of that style */}
      <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {AVATAR_STYLES.map((s) => {
          const active = style === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => handleStyleChange(s.id)}
              aria-pressed={active}
              className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border text-xs transition-colors ${
                s.id === "all" ? "px-3" : "pl-1 pr-3"
              } ${
                active
                  ? "border-ink-100 bg-ink-100 text-ink-950"
                  : "border-ink-800 text-ink-400 hover:border-ink-600 hover:text-ink-100"
              }`}
            >
              {s.id !== "all" && <AvatarIcon avatarId={`v2-${s.id}-preview`} className="h-6 w-6 rounded-full" />}
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-6 gap-2.5">
        {seeds.map((seed, i) => {
          const selected = seed === value;
          return (
            <motion.button
              key={`${batchKey}-${seed}`}
              type="button"
              onClick={() => onChange(seed)}
              aria-label="Select avatar"
              aria-pressed={selected}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, delay: Math.min(i, 24) * 0.012, ease: EASE }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              className="relative aspect-square rounded-full"
            >
              {selected && (
                <motion.span
                  layoutId="avatar-picker-selected"
                  className="absolute -inset-1 rounded-full border-2 border-ink-100"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <AvatarIcon avatarId={seed} className="h-full w-full rounded-full" />
            </motion.button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={() => refresh(style)}
          className="flex items-center gap-1.5 text-xs text-ink-500 transition-colors hover:text-ink-100"
        >
          <Shuffle className="h-3.5 w-3.5" />
          Shuffle
        </button>
        <button
          type="button"
          onClick={handleSurprise}
          className="flex items-center gap-1.5 text-xs text-ink-500 transition-colors hover:text-ink-100"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Surprise me
        </button>
      </div>
    </div>
  );
}