"use client";

import { useState } from "react";
import { Shuffle, Sparkles } from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
import { AVATAR_STYLES, generateSeedBatch, type AvatarStyleFilter } from "@/lib/avatars";

type AvatarPickerProps = {
  value: string;
  onChange: (seed: string) => void;
  batchSize?: number;
};

export function AvatarPicker({ value, onChange, batchSize = 23 }: AvatarPickerProps) {
  const [style, setStyle] = useState<AvatarStyleFilter>("all");
  // Current avatar stays first; selecting inside the grid never reorders it.
  const [seeds, setSeeds] = useState<string[]>(() => [value, ...generateSeedBatch(batchSize, "all")]);

  function refresh(nextStyle: AvatarStyleFilter) {
    setSeeds([value, ...generateSeedBatch(batchSize, nextStyle)]);
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
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {AVATAR_STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => handleStyleChange(s.id)}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors ${
              style === s.id
                ? "border-ink-100 bg-ink-100 text-ink-950"
                : "border-ink-700 text-ink-400 hover:border-ink-500 hover:text-ink-100"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-6 gap-2.5">
        {seeds.map((seed) => (
          <button
            key={seed}
            type="button"
            onClick={() => onChange(seed)}
            aria-label="Select avatar"
            aria-pressed={seed === value}
            className={`aspect-square rounded-full transition-transform hover:scale-105 ${
              seed === value ? "ring-2 ring-ink-100 ring-offset-2 ring-offset-ink-950" : ""
            }`}
          >
            <AvatarIcon avatarId={seed} className="h-full w-full rounded-full" />
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-4">
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