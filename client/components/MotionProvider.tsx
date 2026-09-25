"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";

// App-wide Framer Motion settings. reducedMotion="user" makes every motion
// component respect the OS "reduce motion" setting: movement and layout
// animations are skipped, while simple fades still play.
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}