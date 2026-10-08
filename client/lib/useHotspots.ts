"use client";

import { useCallback, useRef, useState } from "react";
import { isLensLanguage, profileCode } from "@/lib/execution";
import type { HotspotsResult } from "@/lib/hotspots";
import type { Problem } from "@/lib/problems";

export type HotspotsState = {
  // Python, JavaScript and TypeScript (the languages that run in the browser).
  supported: boolean;
  open: boolean;
  running: boolean;
  result: HotspotsResult | null;
  // Why the run couldn't happen at all (the code's own errors are in result).
  error: string | null;
  // The code changed since this run, so the heat may no longer match it.
  stale: boolean;
  run: () => Promise<void>;
  close: () => void;
  // Call on every edit (yours or a teammate's).
  notifyChange: () => void;
};

type Shown = {
  key: string;
  code: string;
  running: boolean;
  result: HotspotsResult | null;
  error: string | null;
};

// Hotspots for the room's code: runs it with every line counted (see
// hotspots.ts) and keeps the result while it still applies. Each run belongs
// to the language and problem it ran with, so switching either closes it.
export function useHotspots({
  language,
  getCode,
  problem,
}: {
  language: string;
  getCode: () => string;
  problem: Problem | null;
}): HotspotsState {
  const [shown, setShown] = useState<Shown | null>(null);
  const [stale, setStale] = useState(false);
  const runRef = useRef(0);
  const codeRef = useRef<string | null>(null);
  const supported = isLensLanguage(language);
  const key = `${language}:${problem?.slug ?? ""}`;

  const run = useCallback(async () => {
    if (!supported) return;
    const id = ++runRef.current;
    const code = getCode();
    setShown((previous) => ({
      key,
      code,
      running: true,
      // Keep showing the last heat while the new one is counted.
      result: previous?.key === key ? previous.result : null,
      error: null,
    }));
    setStale(false);
    const outcome = await profileCode(language, code, problem);
    // A newer run (or closing) took over meanwhile.
    if (id !== runRef.current) return;
    codeRef.current = code;
    setShown({
      key,
      code,
      running: false,
      result: outcome.ok ? outcome.result : null,
      error: outcome.ok ? null : outcome.error,
    });
    setStale(getCode() !== code);
  }, [supported, getCode, key, language, problem]);

  const close = useCallback(() => {
    runRef.current++;
    codeRef.current = null;
    setShown(null);
    setStale(false);
  }, []);

  const notifyChange = useCallback(() => {
    const ran = codeRef.current;
    if (ran === null) return;
    setStale(getCode() !== ran);
  }, [getCode]);

  const current = shown && shown.key === key ? shown : null;
  return {
    supported,
    open: !!current,
    running: !!current?.running,
    result: current?.result ?? null,
    error: current?.error ?? null,
    stale: !!current && !current.running && stale,
    run,
    close,
    notifyChange,
  };
}