import type { ReactNode } from "react";

// Unlike a layout, Next.js re-mounts a template on every navigation, so the
// .page-enter animation (globals.css) replays each time a new page opens.
// The navbar lives in the root layout, outside this template, so it stays still.
// id="main-content" is the target of the "Skip to content" link in the layout.
export default function Template({ children }: { children: ReactNode }) {
  return (
    <div id="main-content" className="page-enter">
      {children}
    </div>
  );
}