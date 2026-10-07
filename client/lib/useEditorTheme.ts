"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_EDITOR_THEME, DEFAULT_LIGHT_EDITOR_THEME, isEditorTheme } from "@/lib/editorTheme";
import { useTheme } from "@/lib/theme";

const STORAGE_KEY = "codeshare:editor-theme";
const EVENT = "codeshare:editor-theme";

function readChoice(): string | null {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved && isEditorTheme(saved) ? saved : null;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies).
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

// The editor theme: the one you picked, or (until you pick one, or after you
// choose "Match the app") the one that matches the app's theme. A personal,
// per-device preference, so it lives in localStorage and never affects
// anyone else. Returns [theme, setTheme, automatic]; setTheme(null) goes
// back to matching the app.
export function useEditorTheme() {
  const { theme } = useTheme();
  const chosen = useSyncExternalStore(subscribe, readChoice, () => null);
  const themeId = chosen ?? (theme === "light" ? DEFAULT_LIGHT_EDITOR_THEME : DEFAULT_EDITOR_THEME);

  const setThemeId = useCallback((id: string | null) => {
    if (id !== null && !isEditorTheme(id)) return;
    try {
      if (id === null) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Not being able to save the preference is harmless.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [themeId, setThemeId, chosen === null] as const;
}