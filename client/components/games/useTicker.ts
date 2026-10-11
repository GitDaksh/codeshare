"use client";

import { useEffect, useState } from "react";

// Re-renders the component `perSecond` times a second while `active` (for
// clocks and anything else that changes with time rather than with moves).
export function useTicker(active: boolean, perSecond = 10): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000 / perSecond);
    return () => clearInterval(timer);
  }, [active, perSecond]);
  return tick;
}
