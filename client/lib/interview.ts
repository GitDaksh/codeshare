"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Socket } from "socket.io-client";
import { getProblem } from "@/lib/problems";

// Interviews on the client: the shapes the server sends, the clock, the
// integrity summary, and the hook that keeps a room's interview in step
// (server: sockets/interview.ts).

export type InterviewPhase = "intro" | "coding" | "testing" | "wrapup";

export const INTERVIEW_PHASES: { id: InterviewPhase; label: string }[] = [
  { id: "intro", label: "Intro" },
  { id: "coding", label: "Coding" },
  { id: "testing", label: "Testing" },
  { id: "wrapup", label: "Wrap-up" },
];

export type InterviewVerdict = "strong-no" | "no" | "yes" | "strong-yes";

export const INTERVIEW_VERDICTS: { id: InterviewVerdict; label: string; score: number }[] = [
  { id: "strong-no", label: "Strong no hire", score: 1 },
  { id: "no", label: "No hire", score: 2 },
  { id: "yes", label: "Hire", score: 3 },
  { id: "strong-yes", label: "Strong hire", score: 4 },
];

export type InterviewCriterion = "problemSolving" | "coding" | "communication" | "testing";

export const INTERVIEW_CRITERIA: { id: InterviewCriterion; label: string; hint: string }[] = [
  { id: "problemSolving", label: "Problem solving", hint: "Understood the problem, then found and justified an approach" },
  { id: "coding", label: "Coding", hint: "Clean, correct, readable code" },
  { id: "communication", label: "Communication", hint: "Thought out loud, asked good questions, used hints well" },
  { id: "testing", label: "Testing", hint: "Checked edge cases and verified the solution" },
];

export const RATING_LABELS = ["Poor", "Mixed", "Good", "Excellent"];

// The panel's overall call: the average of the interviewers' verdicts
// (null until someone has scored).
export function panelVerdict(verdicts: InterviewVerdict[]) {
  if (!verdicts.length) return null;
  const scores = verdicts.map((verdict) => INTERVIEW_VERDICTS.find((option) => option.id === verdict)?.score ?? 0);
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return INTERVIEW_VERDICTS[Math.min(3, Math.max(0, Math.round(average) - 1))];
}

export const INTERVIEW_LEVELS = ["Intern", "Junior", "Mid-level", "Senior", "Staff"] as const;

export type InterviewPerson = { userId: string; name: string; avatarId: string };

export type InterviewEventType =
  | "start"
  | "phase"
  | "question"
  | "hint"
  | "pause"
  | "resume"
  | "extend"
  | "tests"
  | "complexity"
  | "done"
  | "monitor"
  | "end";

export type InterviewEvent = {
  type: InterviewEventType;
  at: number;
  question?: number;
  data?: Record<string, unknown>;
};

export type InterviewNote = {
  at: number;
  text: string;
  tag?: string;
  authorId: string;
  authorName: string;
  question: number;
};

export type InterviewSnapshot = { at: number; label: string; code: string; question: number };

export type InterviewSettings = {
  hints: boolean;
  runTests: boolean;
  lens: boolean;
  meter: boolean;
  monitoring: boolean;
};

// A question as you may see it. Until the interview reaches it, the
// candidate only sees that it exists (hidden).
export type InterviewQuestion = {
  index: number;
  minutes: number;
  status: "pending" | "active" | "done";
  hintsGiven: number;
  timeSpentMs: number;
  hidden: boolean;
  problemSlug?: string | null;
  title?: string | null;
  prompt?: string | null;
  hints?: string[];
  // Interviewers only.
  answer?: string | null;
  // Reports only.
  code?: string;
};

export type InterviewState = {
  id: string;
  roomId: string;
  mode: "live" | "solo";
  title: string;
  position: string | null;
  level: string | null;
  language: string;
  organizerId: string;
  interviewers: InterviewPerson[];
  candidate: InterviewPerson | null;
  questions: InterviewQuestion[];
  current: number;
  currentSince: number;
  durationMs: number;
  extraMs: number;
  status: "scheduled" | "running" | "paused" | "ended";
  scheduledFor: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  pausedMs: number;
  endedAt: string | null;
  phase: InterviewPhase;
  settings: InterviewSettings;
  events: InterviewEvent[];
  // Interviewers only: the invite links' codes.
  codes?: { candidate: string; interviewer: string; observer: string };
  invitedCandidateId?: string | null;
  serverNow: string;
};

export type InterviewScorecard = {
  interviewerId: string;
  name: string;
  avatarId: string;
  ratings: Record<InterviewCriterion, number>;
  verdict: InterviewVerdict;
  feedback: string;
  at: string;
};

export type InterviewReport = InterviewState & {
  snapshots: InterviewSnapshot[];
  scorecards: InterviewScorecard[];
  notes: InterviewNote[];
  shared: boolean;
  viewer: "interviewer" | "candidate";
};

export type InterviewSummary = {
  id: string;
  roomId: string;
  mode: "live" | "solo";
  title: string;
  position: string | null;
  level: string | null;
  language: string;
  status: "scheduled" | "running" | "paused" | "ended";
  role: "interviewer" | "candidate";
  organizer: boolean;
  scheduledFor: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  durationMs: number;
  questionCount: number;
  interviewers: InterviewPerson[];
  candidate: InterviewPerson | null;
  verdicts: InterviewVerdict[];
  scorecardCount: number;
};

// ---------- People ----------

export function isInterviewerIn(state: Pick<InterviewState, "interviewers">, userId: string | null | undefined) {
  return !!userId && state.interviewers.some((person) => person.userId === userId);
}

export function isCandidateIn(state: Pick<InterviewState, "candidate">, userId: string | null | undefined) {
  return !!userId && state.candidate?.userId === userId;
}

// ---------- Questions ----------

export function questionTitle(question: Pick<InterviewQuestion, "problemSlug" | "title" | "hidden">, index: number) {
  if (question.hidden) return `Question ${index + 1}`;
  return question.title ?? (question.problemSlug ? getProblem(question.problemSlug)?.title : null) ?? `Question ${index + 1}`;
}

// ---------- Time ----------

// Interview time at a moment on the server's clock: milliseconds since the
// start, not counting pauses (0 before the start and during the countdown).
export function elapsedAt(state: InterviewState, serverNow: number): number {
  if (!state.startedAt) return 0;
  const end = state.status === "ended" && state.endedAt ? Date.parse(state.endedAt) : serverNow;
  const pausedNow = state.status === "paused" && state.pausedAt ? end - Date.parse(state.pausedAt) : 0;
  return Math.max(0, end - Date.parse(state.startedAt) - state.pausedMs - pausedNow);
}

// Negative once the time is up (overtime).
export function remainingAt(state: InterviewState, serverNow: number): number {
  return state.durationMs + state.extraMs - elapsedAt(state, serverNow);
}

// Milliseconds left in the 3-2-1 countdown (0 once it's started, or before).
export function countdownAt(state: InterviewState, serverNow: number): number {
  if (!state.startedAt || state.status === "scheduled") return 0;
  return Math.max(0, Date.parse(state.startedAt) - serverNow);
}

// Time spent on the current question so far (earlier visits included).
export function questionElapsedAt(state: InterviewState, serverNow: number): number {
  const question = state.questions[state.current];
  if (!question) return 0;
  const live = state.status === "running" || state.status === "paused";
  return question.timeSpentMs + (live ? Math.max(0, elapsedAt(state, serverNow) - state.currentSince) : 0);
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

// "1h 30m", "45m", "40s".
export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return `${Math.max(0, Math.round(ms / 1000))}s`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h${minutes ? ` ${minutes}m` : ""}` : `${minutes}m`;
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

// The latest test run (for one question, or any).
export function latestTests(events: InterviewEvent[], question?: number): { passed: number; total: number; at: number } | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type === "tests" && (question === undefined || event.question === question)) {
      return { passed: Number(event.data?.passed), total: Number(event.data?.total), at: event.at };
    }
  }
  return null;
}

export function latestComplexity(
  events: InterviewEvent[],
  question?: number
): { time: string; space: string | null; at: number } | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type === "complexity" && (question === undefined || event.question === question)) {
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

export type IntegritySummary = {
  consented: boolean;
  tabSwitches: number;
  awayMs: number;
  pastes: number;
  pastedChars: number;
  largestPaste: number;
  inserts: number;
  largestInsert: number;
  extraTabs: number;
  drops: number;
  // Everything worth a second look, newest last.
  flags: InterviewEvent[];
};

// What monitoring saw, in numbers.
export function summarizeIntegrity(events: InterviewEvent[]): IntegritySummary {
  const summary: IntegritySummary = {
    consented: false,
    tabSwitches: 0,
    awayMs: 0,
    pastes: 0,
    pastedChars: 0,
    largestPaste: 0,
    inserts: 0,
    largestInsert: 0,
    extraTabs: 0,
    drops: 0,
    flags: [],
  };
  for (const event of events) {
    if (event.type !== "monitor") continue;
    const kind = event.data?.kind;
    const chars = Number(event.data?.chars ?? 0);
    if (kind === "consent") summary.consented = true;
    else if (kind === "hidden") summary.tabSwitches++;
    else if (kind === "visible") summary.awayMs += Number(event.data?.ms ?? 0);
    else if (kind === "paste") {
      summary.pastes++;
      summary.pastedChars += chars;
      summary.largestPaste = Math.max(summary.largestPaste, chars);
    } else if (kind === "insert") {
      summary.inserts++;
      summary.largestInsert = Math.max(summary.largestInsert, chars);
    } else if (kind === "tabs") summary.extraTabs++;
    else if (kind === "left") summary.drops++;
    if (kind !== "consent" && kind !== "visible" && kind !== "back") summary.flags.push(event);
  }
  return summary;
}

export function describeMonitor(event: InterviewEvent): string {
  const chars = Number(event.data?.chars ?? 0);
  switch (event.data?.kind) {
    case "consent":
      return "Acknowledged that monitoring is on";
    case "hidden":
      return "Switched away from the tab";
    case "visible":
      return `Came back after ${formatDuration(Number(event.data?.ms ?? 0))}`;
    case "paste":
      return `Pasted ${chars.toLocaleString()} characters`;
    case "insert":
      return `Added ${chars.toLocaleString()} characters at once`;
    case "tabs":
      return `Opened the room in another tab or device (${event.data?.count} open)`;
    case "left":
      return "Lost connection";
    case "back":
      return `Reconnected after ${formatDuration(Number(event.data?.ms ?? 0))}`;
    case "fullscreen":
      return "Left full screen";
    default:
      return "Activity";
  }
}

// ---------- The live hook ----------

export type RoomInterview = ReturnType<typeof useInterview>;

type InterviewEvents = {
  // A different interview than before (one just started, or you just arrived).
  onNew?: (state: InterviewState) => void;
  // The interview went from the lobby to running.
  onStarted?: (state: InterviewState) => void;
  // The interview moved to another question.
  onQuestion?: (state: InterviewState) => void;
  // The interview you were watching just ended.
  onEnded?: (state: InterviewState) => void;
  // The server turned an action down, with why.
  onError?: (message: string) => void;
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
    if (!previous || previous.id !== state.id) {
      eventsRef.current.onNew?.(state);
      return;
    }
    if (previous.status === "scheduled" && state.status === "running") eventsRef.current.onStarted?.(state);
    if (previous.current !== state.current) eventsRef.current.onQuestion?.(state);
    if (previous.status !== "ended" && state.status === "ended") eventsRef.current.onEnded?.(state);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onState = (event: { roomId: string; interview: InterviewState }) => {
      if (event.roomId === roomId && event.interview) adopt(event.interview);
    };
    const onNotes = (event: { roomId: string; interviewId: string; notes: InterviewNote[] }) => {
      if (event.roomId === roomId) setNotes({ id: event.interviewId, notes: event.notes ?? [] });
    };
    const onError = (event: { roomId: string; message: string }) => {
      if (event.roomId === roomId) eventsRef.current.onError?.(event.message);
    };
    socket.on("interview:state", onState);
    socket.on("interview:notes", onNotes);
    socket.on("interview:error", onError);
    return () => {
      socket.off("interview:state", onState);
      socket.off("interview:notes", onNotes);
      socket.off("interview:error", onError);
    };
  }, [socket, roomId, adopt]);

  const emit = useCallback(
    (event: string, payload: Record<string, unknown> = {}) => {
      socket?.emit(event, { roomId, ...payload });
    },
    [socket, roomId]
  );

  const control = useCallback(
    (
      action: "start" | "pause" | "resume" | "extend" | "end" | "hint" | "phase" | "goto" | "next",
      extra: Record<string, unknown> = {}
    ) => emit("interview:control", { action, ...extra }),
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
  const monitor = useCallback(
    (kind: "hidden" | "visible" | "paste" | "consent" | "fullscreen", details: { ms?: number; chars?: number; lines?: number } = {}) =>
      emit("interview:monitor", { kind, ...details }),
    [emit]
  );

  return {
    interview,
    // The interviewers' shared notes for the current interview.
    notes: interview && notes?.id === interview.id ? notes.notes : [],
    skew,
    adopt,
    control,
    addNote,
    done,
    reportTests,
    reportComplexity,
    monitor,
  };
}