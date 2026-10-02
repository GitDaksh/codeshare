"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Socket } from "socket.io-client";

// Interview mode on the client: the shapes the server sends, the clock, and
// the hook that keeps a room's interview in step (server: sockets/interview.ts).

export type InterviewPhase = "intro" | "coding" | "testing" | "wrapup";

export const INTERVIEW_PHASES: { id: InterviewPhase; label: string }[] = [
  { id: "intro", label: "Intro" },
  { id: "coding", label: "Coding" },
  { id: "testing", label: "Testing" },
  { id: "wrapup", label: "Wrap-up" },
];

export type InterviewVerdict = "strong-no" | "no" | "yes" | "strong-yes";

export const INTERVIEW_VERDICTS: { id: InterviewVerdict; label: string }[] = [
  { id: "strong-no", label: "Strong no hire" },
  { id: "no", label: "No hire" },
  { id: "yes", label: "Hire" },
  { id: "strong-yes", label: "Strong hire" },
];

export type InterviewCriterion = "problemSolving" | "coding" | "communication" | "testing";

export const INTERVIEW_CRITERIA: { id: InterviewCriterion; label: string; hint: string }[] = [
  { id: "problemSolving", label: "Problem solving", hint: "Understood the problem, then found and justified an approach" },
  { id: "coding", label: "Coding", hint: "Clean, correct, readable code" },
  { id: "communication", label: "Communication", hint: "Thought out loud, asked good questions, used hints well" },
  { id: "testing", label: "Testing", hint: "Checked edge cases and verified the solution" },
];

export const RATING_LABELS = ["Poor", "Mixed", "Good", "Excellent"];

export type InterviewPerson = { userId: string; name: string; avatarId: string };

export type InterviewEventType =
  | "start"
  | "phase"
  | "hint"
  | "pause"
  | "resume"
  | "extend"
  | "tests"
  | "complexity"
  | "done"
  | "end";

export type InterviewEvent = { type: InterviewEventType; at: number; data?: Record<string, unknown> };
export type InterviewNote = { at: number; text: string; tag?: string };
export type InterviewSnapshot = { at: number; label: string; code: string };

export type InterviewState = {
  id: string;
  roomId: string;
  mode: "live" | "solo";
  interviewer: InterviewPerson;
  candidate: InterviewPerson;
  problemSlug: string | null;
  custom: { title: string; prompt: string } | null;
  language: string;
  durationMs: number;
  extraMs: number;
  status: "running" | "paused" | "ended";
  startedAt: string;
  pausedAt: string | null;
  pausedMs: number;
  endedAt: string | null;
  phase: InterviewPhase;
  hintsGiven: number;
  customHints: string[];
  events: InterviewEvent[];
  serverNow: string;
};

export type InterviewReport = InterviewState & {
  snapshots: InterviewSnapshot[];
  finalCode: string;
  ratings: Partial<Record<InterviewCriterion, number>> | null;
  verdict: InterviewVerdict | null;
  feedback: string;
  shared: boolean;
  notes: InterviewNote[];
  viewer: "interviewer" | "candidate";
};

export type InterviewSummary = {
  id: string;
  roomId: string;
  mode: "live" | "solo";
  role: "interviewer" | "candidate";
  problemSlug: string | null;
  customTitle: string | null;
  status: "running" | "paused" | "ended";
  startedAt: string;
  endedAt: string | null;
  durationMs: number;
  verdict: InterviewVerdict | null;
  interviewer: { name: string; avatarId: string };
  candidate: { name: string; avatarId: string };
};

// ---------- Time ----------

// Interview time at a moment on the server's clock: milliseconds since the
// start, not counting pauses (0 during the countdown).
export function elapsedAt(state: InterviewState, serverNow: number): number {
  const end = state.status === "ended" && state.endedAt ? Date.parse(state.endedAt) : serverNow;
  const pausedNow = state.status === "paused" && state.pausedAt ? end - Date.parse(state.pausedAt) : 0;
  return Math.max(0, end - Date.parse(state.startedAt) - state.pausedMs - pausedNow);
}

// Negative once the time is up (overtime).
export function remainingAt(state: InterviewState, serverNow: number): number {
  return state.durationMs + state.extraMs - elapsedAt(state, serverNow);
}

// Milliseconds left in the 3-2-1 countdown (0 once it's started).
export function countdownAt(state: InterviewState, serverNow: number): number {
  return Math.max(0, Date.parse(state.startedAt) - serverNow);
}

const pad = (value: number) => String(value).padStart(2, "0");

// 07:05, or 1:02:09 past an hour.
export function formatClock(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function formatMinutes(ms: number): string {
  const minutes = Math.round(ms / 60000);
  return minutes === 1 ? "1 min" : `${minutes} min`;
}

// One shared clock for every timer on the page, ticking only while
// something shows it (so the room page itself never re-renders per tick).
let clockNow = 0;
let clockTimer: ReturnType<typeof setInterval> | null = null;
const clockListeners = new Set<() => void>();

function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (!clockTimer) {
    clockNow = Date.now();
    clockTimer = setInterval(() => {
      clockNow = Date.now();
      for (const notify of clockListeners) notify();
    }, 250);
  }
  return () => {
    clockListeners.delete(listener);
    if (!clockListeners.size && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

export function useClock(): number {
  return useSyncExternalStore(
    subscribeClock,
    () => clockNow,
    () => 0
  );
}

// ---------- Reading the record ----------

export function latestTests(events: InterviewEvent[]): { passed: number; total: number; at: number } | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type === "tests") return { passed: Number(event.data?.passed), total: Number(event.data?.total), at: event.at };
  }
  return null;
}

export function latestComplexity(events: InterviewEvent[]): { time: string; space: string | null; at: number } | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type === "complexity") {
      return { time: String(event.data?.time), space: (event.data?.space as string | null) ?? null, at: event.at };
    }
  }
  return null;
}

// "O(n log n)" and "O(n·log n)" read the same.
export function sameComplexity(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (value: string) => value.replace(/[\s·*]/g, "").toLowerCase();
  return !!a && !!b && norm(a) === norm(b);
}

// ---------- The live hook ----------

export type RoomInterview = ReturnType<typeof useInterview>;

type InterviewEvents = {
  // A different interview than before (one just started, or you just arrived).
  onNew?: (state: InterviewState) => void;
  // The interview you were watching just ended.
  onEnded?: (state: InterviewState) => void;
};

// A room's interview, kept in step over the room's socket.
export function useInterview(socket: Socket | null, roomId: string, events: InterviewEvents = {}) {
  const [interview, setInterview] = useState<InterviewState | null>(null);
  const [notes, setNotes] = useState<{ id: string; notes: InterviewNote[] } | null>(null);
  // How far this browser's clock is behind the server's.
  const [skew, setSkew] = useState(0);
  const eventsRef = useRef(events);
  const currentRef = useRef<InterviewState | null>(null);

  useEffect(() => {
    eventsRef.current = events;
  });

  const adopt = useCallback((state: InterviewState) => {
    const previous = currentRef.current;
    currentRef.current = state;
    setSkew(Date.parse(state.serverNow) - Date.now());
    setInterview(state);
    if (!previous || previous.id !== state.id) eventsRef.current.onNew?.(state);
    else if (previous.status !== "ended" && state.status === "ended") eventsRef.current.onEnded?.(state);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onState = (event: { roomId: string; interview: InterviewState }) => {
      if (event.roomId === roomId && event.interview) adopt(event.interview);
    };
    const onNotes = (event: { roomId: string; interviewId: string; notes: InterviewNote[] }) => {
      if (event.roomId === roomId) setNotes({ id: event.interviewId, notes: event.notes ?? [] });
    };
    socket.on("interview:state", onState);
    socket.on("interview:notes", onNotes);
    return () => {
      socket.off("interview:state", onState);
      socket.off("interview:notes", onNotes);
    };
  }, [socket, roomId, adopt]);

  const emit = useCallback(
    (event: string, payload: Record<string, unknown> = {}) => {
      socket?.emit(event, { roomId, ...payload });
    },
    [socket, roomId]
  );

  const control = useCallback(
    (action: "pause" | "resume" | "extend" | "end" | "hint" | "phase", extra: Record<string, unknown> = {}) =>
      emit("interview:control", { action, ...extra }),
    [emit]
  );
  const addNote = useCallback(
    (text: string, tag?: string) => emit("interview:note", { text, ...(tag ? { tag } : {}) }),
    [emit]
  );
  const done = useCallback(() => emit("interview:done"), [emit]);
  const reportTests = useCallback(
    (passed: number, total: number) => emit("interview:tests", { passed, total }),
    [emit]
  );
  const reportComplexity = useCallback(
    (time: string, space: string | null) => emit("interview:complexity", { time, ...(space ? { space } : {}) }),
    [emit]
  );

  return {
    interview,
    // The interviewer's private notes for the current interview.
    notes: interview && notes?.id === interview.id ? notes.notes : [],
    skew,
    adopt,
    control,
    addNote,
    done,
    reportTests,
    reportComplexity,
  };
}