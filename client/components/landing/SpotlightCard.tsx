"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
};

// A card whose border and surface light up around the mouse. The mouse
// position is written straight to CSS variables, so moving the mouse never
// triggers a React re-render.
export function SpotlightCard({ children, className = "" }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`group relative rounded-2xl bg-ink-800/70 p-px ${className}`}
    >
      <div className="spotlight-border pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative h-full overflow-hidden rounded-[15px] bg-ink-950">
        <div className="spotlight-fill pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="relative h-full">{children}</div>
      </div>
    </div>
  );
}