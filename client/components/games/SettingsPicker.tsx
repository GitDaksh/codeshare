"use client";

import { Segmented } from "@/components/Segmented";
import type { SettingDef } from "@/lib/games/registry";
import type { Settings } from "@/lib/games/types";

// A game's settings, one row of choices each.
export function SettingsPicker({
  id,
  defs,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  defs: SettingDef[];
  value: Settings;
  onChange: (next: Settings) => void;
  disabled?: boolean;
}) {
  if (defs.length === 0) return null;
  return (
    <div className="space-y-4">
      {defs.map((def) => (
        <div key={def.key}>
          <p className="mb-1.5 text-xs font-medium text-ink-500">{def.label}</p>
          <div className={disabled ? "pointer-events-none opacity-60" : ""} aria-disabled={disabled || undefined}>
            <Segmented
              id={`${id}-${def.key}`}
              size="sm"
              fill
              value={String(value[def.key] ?? def.options[0].value)}
              options={def.options.map((o) => ({ value: String(o.value), label: o.label }))}
              onChange={(picked) => {
                const option = def.options.find((o) => String(o.value) === picked);
                if (option) onChange({ ...value, [def.key]: option.value });
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
