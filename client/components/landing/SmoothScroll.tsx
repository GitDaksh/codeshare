"use client";

import { useEffect } from "react";
import Lenis from "lenis";

let active: Lenis | null = null;

// Scrolls the page to y smoothly, through Lenis while it's running so the two
// never fight over the scroll position.
export function scrollToY(y: number) {
  if (active) {
    active.scrollTo(y, { duration: 1.2 });
    return;
  }
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
}

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
    active = lenis;

    return () => {
      lenis.destroy();
      if (active === lenis) active = null;
    };
  }, []);

  return null;
}