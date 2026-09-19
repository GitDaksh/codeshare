"use client";

import { useState } from "react";
import { Shuffle } from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
import { generateSeedBatch } from "@/lib/avatars";

type AvatarPickerProps = {
  value: string;
  onChange: (seed: string) => void;
  batchSize?: number;
};

export function AvatarPicker({ value, onChange, batchSize = 17 }: AvatarPickerProps) {
  const [seeds, setSeeds] = useState<string[]>(() => [value, ...generateSeedBatch(batchSize)]);

  function handleShuffle() {
    setSeeds([value, ...generateSeedBatch(batchSize)]);
  }

  return (
    <div>
      <div className="grid grid-cols-6 gap-2.5">
        {seeds.map((seed) => (
          <button
            key={seed}
            onClick={() => onChange(seed)}
            aria-label={`Select avatar ${seed}`}
            aria-pressed={seed === value}
            className={`rounded-full transition-transform hover:scale-105 ${
              seed === value ? "ring-2 ring-ink-100 ring-offset-2 ring-offset-ink-950" : ""
            }`}
          >
            <AvatarIcon avatarId={seed} className="h-full w-full rounded-full" />
          </button>
        ))}
      </div>
      <button
        onClick={handleShuffle}
        className="mt-3 flex items-center gap-1.5 text-xs text-ink-500 transition-colors hover:text-ink-100"
      >
        <Shuffle className="h-3.5 w-3.5" />
        Shuffle more options
      </button>
    </div>
  );
}