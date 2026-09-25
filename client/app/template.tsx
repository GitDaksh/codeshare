import type { ReactNode } from "react";

// Unlike a layout, Next.js re-mounts a template on every navigation, so the
// .page-enter animation (globals.css) replays each time a new page opens.
// The navbar lives in the root layout, outside this template, so it stays still.
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>;
}