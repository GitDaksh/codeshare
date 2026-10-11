"use client";

import { useCallback, useSyncExternalStore } from "react";

// Small things the games remember on this device (last settings, today's
// Keyword, scores when signed out), read so the page renders the same on the
// server and in the browser, and updates everywhere when they change.

const EVENT = "codeshare:games:storage";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readJson<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

// Parsed values, one per distinct stored text, so the same text always gives
// the very same object (safe to use in React dependencies).
const parsed = new Map<string, unknown>();
function parse(raw: string): unknown {
  if (!parsed.has(raw)) {
    try {
      parsed.set(raw, JSON.parse(raw));
    } catch {
      parsed.set(raw, undefined);
    }
  }
  return parsed.get(raw);
}

// The stored value (or `fallback`, which is also what the server renders).
export function useStoredJson<T>(key: string, fallback: T): [T, (value: T) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null
  );
  const value = raw === null ? undefined : parse(raw);
  const set = useCallback((next: T) => writeJson(key, next), [key]);
  return [value === undefined ? fallback : (value as T), set];
}
