"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MeterResult } from "@/lib/complexity";
import { isLensLanguage, measureComplexity } from "@/lib/execution";
import type { Problem } from "@/lib/problems";

// Measures the room's code a moment after it stops changing (see
// complexity.ts). Python waits for a first click: measuring downloads the
// Python runtime, which shouldn't happen just because a room was opened.

const QUIET_MS = 1500;

export function useComplexity({
  language,
  getCode,
  problem,
  auto,
}: {
  language: string;
  getCode: () => string;
  problem: Problem | null;
  // Measure by itself as the code changes (desktop); otherwise on a click.
  auto: boolean;
}) {
  const [measured, setMeasured] = useState<{ language: string; result: MeterResult } | null>(null);
  const [measuring, setMeasuring] = useState(false);
  // The code changed after the result was measured.
  const [stale, setStale] = useState(false);
  const [pythonAllowed, setPythonAllowed] = useState(false);

  const supported = isLensLanguage(language);
  const live = supported && auto && (language !== "python" || pythonAllowed);

  const busyRef = useRef(false);
  const againRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const liveRef = useRef(live);
  const latestRef = useRef({ language, getCode, problem });
  const measureRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    liveRef.current = live;
    latestRef.current = { language, getCode, problem };
  });

  const measure = useCallback(async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Already measuring: measure again once this one is done.
    if (busyRef.current) {
      againRef.current = true;
      return;
    }
    const { language: lang, getCode: read, problem: prob } = latestRef.current;
    if (!isLensLanguage(lang)) return;
    busyRef.current = true;
    setMeasuring(true);
    setStale(false);
    try {
      const result = await measureComplexity(lang, read(), prob);
      setMeasured({ language: lang, result });
    } catch {
      setMeasured({ language: lang, result: { status: "error", message: "Lens couldn't measure this code." } });
    } finally {
      busyRef.current = false;
      setMeasuring(false);
      if (againRef.current) {
        againRef.current = false;
        void measureRef.current();
      }
    }
  }, []);

  useEffect(() => {
    measureRef.current = measure;
  }, [measure]);

  const schedule = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void measureRef.current();
    }, QUIET_MS);
  }, []);

  // Called whenever the code changes (typing here, or someone else's edit).
  const notifyChange = useCallback(() => {
    setStale(true);
    if (!liveRef.current) return;
    if (busyRef.current) againRef.current = true;
    else schedule();
  }, [schedule]);

  // A click: also allows Python to measure by itself from now on.
  const start = useCallback(() => {
    setPythonAllowed(true);
    void measureRef.current();
  }, []);

  // Measure when the room opens, and again when the language changes.
  useEffect(() => {
    if (live) schedule();
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [live, language, schedule]);

  return {
    supported,
    live,
    measuring,
    stale,
    result: measured && measured.language === language ? measured.result : null,
    start,
    notifyChange,
  };
}

export type ComplexityState = ReturnType<typeof useComplexity>;