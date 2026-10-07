"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme, type ThemeChoice } from "@/lib/theme";

const OPTIONS: { value: ThemeChoice; label: string; icon: LucideIcon }[] = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
];

// Dark, light, or whatever the device uses: for menus.
export function ThemeSwitcher() {
  const { choice, choose } = useTheme();
  return (
    <div className="px-2.5 py-2">
      <p className="mb-1.5 text-xs font-medium text-ink-500">Theme</p>
      <div role="radiogroup" aria-label="Theme" className="flex rounded-lg border border-ink-800 bg-ink-950 p-0.5">
        {OPTIONS.map((option) => {
          const active = choice === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(option.value)}
              className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-xs font-medium transition-colors ${
                active ? "bg-ink-900 text-ink-100 shadow-xs ring-1 ring-ink-800" : "text-ink-500 hover:text-ink-100"
              }`}
            >
              <option.icon className="h-3.5 w-3.5" />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// One click between dark and light: for the public navbar.
export function ThemeToggleButton({ className }: { className: string }) {
  const { theme, choose } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" onClick={() => choose(next)} aria-label={`Switch to the ${next} theme`} title={`Switch to the ${next} theme`} className={className}>
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}