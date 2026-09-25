"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";

// start:     bar appears at 0 width (one frame, so the next step can animate)
// loading:   bar creeps toward 85% while the next page loads
// finishing: bar shoots to 100% and fades out once the new page has rendered
type Phase = "idle" | "start" | "loading" | "finishing";

const SAFETY_TIMEOUT_MS = 10000;
const FINISH_DURATION_MS = 500;

const PHASE_STYLES: Record<Phase, CSSProperties> = {
  idle: { transform: "scaleX(0)", opacity: 0, transition: "none" },
  start: { transform: "scaleX(0)", opacity: 1, transition: "none" },
  loading: {
    transform: "scaleX(0.85)",
    opacity: 1,
    transition: "transform 8s cubic-bezier(0.1, 0.7, 0.2, 1)",
  },
  finishing: {
    transform: "scaleX(1)",
    opacity: 0,
    transition: "transform 200ms ease-out, opacity 250ms ease 200ms",
  },
};

// A thin loading bar across the top of the screen. It starts the moment an
// internal link is clicked, so every navigation gets instant feedback, and
// completes when the route actually changes. It only observes clicks; it
// never intercepts, prevents, or delays navigation.
export function NavigationProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");

  // Start on clicks that will navigate to a different page of this app.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!(e.target instanceof Element)) return;

      const anchor = e.target.closest("a");
      if (!anchor || !anchor.href) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;

      setPhase("start");
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  // Two animation frames later, begin creeping forward (the first frame lets
  // the 0-width state paint, so the transition has something to animate from).
  useEffect(() => {
    if (phase !== "start") return;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setPhase("loading"));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [phase]);

  // Safety net: never leave the bar hanging if a navigation doesn't complete.
  useEffect(() => {
    if (phase !== "loading") return;
    const timer = setTimeout(() => setPhase("finishing"), SAFETY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // The route changed: finish the bar.
  useEffect(() => {
    setPhase((current) => (current === "start" || current === "loading" ? "finishing" : current));
  }, [pathname]);

  // Reset once the finish animation has played.
  useEffect(() => {
    if (phase !== "finishing") return;
    const timer = setTimeout(() => setPhase("idle"), FINISH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5">
      <div
        className="h-full origin-left bg-ink-100 shadow-[0_0_12px_rgba(255,255,255,0.7)]"
        style={PHASE_STYLES[phase]}
      />
    </div>
  );
}