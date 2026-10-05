"use client";

import { useEffect } from "react";
import type { InterviewState, RoomInterview } from "@/lib/interview";

// The candidate's side of monitoring: tells the interview when the tab is
// hidden (and how long for) and when something is pasted into the editor.
// Only while monitoring is on, the interview is running, and you're its
// candidate (the candidate is told, in the lobby and on the bar).
export function useInterviewMonitor(
  interview: InterviewState | null,
  me: string | null | undefined,
  monitor: RoomInterview["monitor"]
) {
  const active =
    !!interview &&
    interview.mode === "live" &&
    interview.settings.monitoring &&
    (interview.status === "running" || interview.status === "paused") &&
    !!me &&
    interview.candidate?.userId === me;

  useEffect(() => {
    if (!active) return;
    let hiddenAt: number | null = document.hidden ? Date.now() : null;

    function handleVisibility() {
      if (document.hidden) {
        hiddenAt = Date.now();
        monitor("hidden");
      } else if (hiddenAt !== null) {
        monitor("visible", { ms: Date.now() - hiddenAt });
        hiddenAt = null;
      }
    }

    function handlePaste(event: ClipboardEvent) {
      const target = event.target as HTMLElement | null;
      // Only pastes into the code editor count.
      if (!target?.closest?.(".monaco-editor")) return;
      const text = event.clipboardData?.getData("text") ?? "";
      if (!text) return;
      monitor("paste", { chars: text.length, lines: text.split("\n").length });
    }

    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("paste", handlePaste, true);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("paste", handlePaste, true);
    };
  }, [active, monitor]);

  return active;
}