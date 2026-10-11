"use client";

import { readJson, useStoredJson, writeJson } from "@/lib/games/storage";

// Today's Keyword: one word a day for everyone (picked from the date), and
// whether you've played it yet (remembered on this device).

export function dailyKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type DailyResult = { solved: boolean; guesses: number; rows?: string[] };

const storeKey = (day: string) => `codeshare:games:keyword:${day}`;

function valid(value: unknown): value is DailyResult {
  return !!value && typeof value === "object" && typeof (value as DailyResult).solved === "boolean";
}

export function readDaily(day: string): DailyResult | null {
  const value = readJson<unknown>(storeKey(day), null);
  return valid(value) ? value : null;
}

export function writeDaily(day: string, result: DailyResult) {
  writeJson(storeKey(day), result);
}

export function useDaily(day: string): DailyResult | null {
  const [value] = useStoredJson<unknown>(storeKey(day), null);
  return valid(value) ? value : null;
}
