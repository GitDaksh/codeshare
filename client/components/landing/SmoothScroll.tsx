"use client";

import { useEffect } from "react";
import Lenis from "lenis";

// Buttery wheel scrolling for the landing page only. Destroyed on unmount, so
// the dashboard, room page, Monaco and chat keep fully native scrolling.
// Lenis leaves touch scrolling native by default, so phones are unaffected.
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.1,
      anchors: { offset: -80 },
    });

    return () => lenis.destroy();
  }, []);

  return null;
}