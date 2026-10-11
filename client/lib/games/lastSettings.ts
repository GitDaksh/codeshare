"use client";

import { readJson, useStoredJson, writeJson } from "@/lib/games/storage";
import type { GameId, Settings } from "@/lib/games/types";

// The settings you last picked for each game, remembered on this device.
const key = (game: GameId) => `codeshare:games:settings:${game}`;
const NONE: Record<string, unknown> = {};

export function loadSettings(game: GameId): Record<string, unknown> {
  const value = readJson<Record<string, unknown>>(key(game), NONE);
  return value && typeof value === "object" ? value : NONE;
}

export function saveSettings(game: GameId, settings: Settings) {
  writeJson(key(game), settings);
}

export function useSavedSettings(game: GameId): [Record<string, unknown>, (settings: Settings) => void] {
  const [value, set] = useStoredJson<Record<string, unknown>>(key(game), NONE);
  return [value && typeof value === "object" ? value : NONE, set as (settings: Settings) => void];
}
