"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_EDITOR_THEME, isEditorTheme } from "@/lib/editorTheme";

const STORAGE_KEY = "codeshare:editor-theme";

// The editor theme is a personal, per-device preference, so it lives in
// localStorage rather than on the server, and never affects anyone else.
export function useEditorTheme() {
  const [themeId, setThemeIdState] = useState(DEFAULT_EDITOR_THEME);

  // Read the saved choice after mount (localStorage doesn't exist during
  // server rendering). The editor only mounts once the room has loaded, so
  // this runs well before it, with no flash of the wrong theme.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && isEditorTheme(saved)) setThemeIdState(saved);
    } catch {
      // Storage can be unavailable (private mode, blocked cookies). Fall back to the default.
    }
  }, []);

  const setThemeId = useCallback((id: string) => {
    if (!isEditorTheme(id)) return;
    setThemeIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Not being able to save the preference is harmless.
    }
  }, []);

  return [themeId, setThemeId] as const;
}