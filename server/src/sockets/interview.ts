import type { Server, Socket } from "socket.io";
import { Interview, INTERVIEW_PHASES, type IInterview, type InterviewPhase } from "../models/Interview";
import { limiter, type Limiter } from "../lib/rateLimit";
import {
  MAX_EVENTS,
  MAX_EXTRA_MS,
  MAX_NOTES,
  MAX_SNAPSHOTS,
  elapsedMs,
  publicInterview,
} from "../lib/interviews";
import { currentCode } from "./collab";

// Interviews, live: the interviewer runs the clock, phases and hints and
// takes private notes; the candidate's test runs and Big-O readings are
// recorded with a snapshot of the code. Everything is stamped in interview
// time for the report.

const EXTEND_MS = 5 * 60 * 1000;
// Practice problems come with a ladder of three hints.
const PROBLEM_HINTS = 3;
const MAX_CUSTOM_HINTS = 10;

const LIMITS: Record<string, Limiter> = {
  "interview:control": limiter(20, 2),
  "interview:note": limiter(20, 2),
  "interview:done": limiter(3, 0.1),
  "interview:tests": limiter(10, 1),
  "interview:complexity": limiter(10, 1),
};

let server: Server | null = null;

export function setInterviewServer(io: Server) {
  server = io;
}

function allowed(socket: Socket, event: string): boolean {
  return LIMITS[event].take(socket.data.userId as string);
}

function payloadOf<T extends object>(data: unknown): Partial<T> {
  return data && typeof data === "object" ? (data as Partial<T>) : {};
}

// One change at a time per room, so two actions arriving together never
// overwrite each other.
const queues = new Map<string, Promise<unknown>>();
export function serial<T>(roomId: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(roomId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  queues.set(roomId, next);
  void next.finally(() => {
    if (queues.get(roomId) === next) queues.delete(roomId);
  });
  return next;
}

export function activeInterview(roomId: string): Promise<IInterview | null> {
  return Interview.findOne({ roomId, status: { $in: ["running", "paused"] } });
}

function sendNotes(interview: IInterview, only?: Socket) {
  const roomId = interview.roomId.toString();
  const payload = { roomId, interviewId: interview._id.toString(), notes: interview.notes };
  if (only) {
    only.emit("interview:notes", payload);
    return;
  }
  for (const socket of server?.of("/").sockets.values() ?? []) {
    if (socket.rooms.has(roomId) && socket.data.userId === interview.interviewerId) {
      socket.emit("interview:notes", payload);
    }
  }
}

// Everyone in the room gets the public state; the interviewer's own tabs
// also get their private notes.
export function broadcastInterview(interview: IInterview) {
  const roomId = interview.roomId.toString();
  server?.to(roomId).emit("interview:state", { roomId, interview: publicInterview(interview) });
  sendNotes(interview);
}

// Someone joined the room: catch them up on the interview in progress.
export async function sendInterviewOnJoin(socket: Socket, roomId: string) {
  const interview = await activeInterview(roomId).catch(() => null);
  if (!interview) return;
  socket.emit("interview:state", { roomId, interview: publicInterview(interview) });
  if (socket.data.userId === interview.interviewerId) sendNotes(interview, socket);
}

// The code as it is now, for the report (skipped if nothing changed).
async function addSnapshot(interview: IInterview, label: string, at: number) {
  const code = await currentCode(interview.roomId.toString()).catch(() => null);
  if (code === null) return;
  const last = interview.snapshots[interview.snapshots.length - 1];
  if (last && last.code === code) return;
  // Keep the first one (where they started) and the most recent ones.
  if (interview.snapshots.length >= MAX_SNAPSHOTS) interview.snapshots.splice(1, 1);
  interview.snapshots.push({ at, label, code });
}

export async function endInterview(interview: IInterview, now = Date.now()) {
  if (interview.status === "paused" && interview.pausedAt) {
    interview.pausedMs += now - interview.pausedAt.getTime();
    interview.pausedAt = null;
  }
  interview.status = "ended";
  interview.endedAt = new Date(now);
  const at = elapsedMs(interview, now);
  interview.finalCode = await currentCode(interview.roomId.toString()).catch(() => "");
  await addSnapshot(interview, "Final", at);
  interview.events.push({ type: "end", at });
  await interview.save();
  broadcastInterview(interview);
}

export function registerInterviewEvents(socket: Socket) {
  const userId = () => socket.data.userId as string;

  // The interviewer's controls.
  socket.on("interview:control", (data: unknown) => {
    if (!allowed(socket, "interview:control")) return;
    const { roomId, action, phase, text } = payloadOf<{ roomId: string; action: string; phase: string; text: string }>(data);
    if (typeof roomId !== "string" || !socket.rooms.has(roomId) || typeof action !== "string") return;

    void serial(roomId, async () => {
      const interview = await activeInterview(roomId);
      if (!interview || interview.interviewerId !== userId()) return;
      const now = Date.now();
      const started = now >= interview.startedAt.getTime();
      const at = elapsedMs(interview, now);

      if (action === "end") return endInterview(interview, now);
      if (interview.events.length >= MAX_EVENTS) return;

      if (action === "pause") {
        if (interview.status !== "running" || !started) return;
        interview.status = "paused";
        interview.pausedAt = new Date(now);
        interview.events.push({ type: "pause", at });
      } else if (action === "resume") {
        if (interview.status !== "paused" || !interview.pausedAt) return;
        interview.pausedMs += now - interview.pausedAt.getTime();
        interview.pausedAt = null;
        interview.status = "running";
        interview.events.push({ type: "resume", at });
      } else if (action === "extend") {
        if (interview.extraMs + EXTEND_MS > MAX_EXTRA_MS) return;
        interview.extraMs += EXTEND_MS;
        interview.events.push({ type: "extend", at, data: { minutes: EXTEND_MS / 60000 } });
      } else if (action === "phase") {
        if (!INTERVIEW_PHASES.includes(phase as InterviewPhase) || phase === interview.phase) return;
        interview.phase = phase as InterviewPhase;
        interview.events.push({ type: "phase", at, data: { phase } });
      } else if (action === "hint") {
        if (interview.problemSlug) {
          if (interview.hintsGiven >= PROBLEM_HINTS) return;
        } else {
          // Their own question: the interviewer writes the hint.
          if (typeof text !== "string" || !text.trim() || text.length > 500) return;
          if (interview.customHints.length >= MAX_CUSTOM_HINTS) return;
          interview.customHints.push(text.trim());
        }
        interview.hintsGiven += 1;
        interview.events.push({ type: "hint", at, data: { index: interview.hintsGiven } });
      } else {
        return;
      }
      await interview.save();
      broadcastInterview(interview);
    }).catch((err) => console.error("Interview control failed:", err));
  });

  // The interviewer's private, timestamped notes.
  socket.on("interview:note", (data: unknown) => {
    if (!allowed(socket, "interview:note")) return;
    const { roomId, text, tag } = payloadOf<{ roomId: string; text: string; tag: string }>(data);
    if (typeof roomId !== "string" || !socket.rooms.has(roomId)) return;
    if (typeof text !== "string" || !text.trim() || text.length > 500) return;
    if (tag !== undefined && (typeof tag !== "string" || tag.length > 40)) return;

    void serial(roomId, async () => {
      const interview = await activeInterview(roomId);
      if (!interview || interview.interviewerId !== userId() || interview.notes.length >= MAX_NOTES) return;
      interview.notes.push({ at: elapsedMs(interview), text: text.trim(), ...(tag ? { tag } : {}) });
      await interview.save();
      sendNotes(interview);
    }).catch((err) => console.error("Interview note failed:", err));
  });

  // The candidate says they're done.
  socket.on("interview:done", (data: unknown) => {
    if (!allowed(socket, "interview:done")) return;
    const { roomId } = payloadOf<{ roomId: string }>(data);
    if (typeof roomId !== "string" || !socket.rooms.has(roomId)) return;

    void serial(roomId, async () => {
      const interview = await activeInterview(roomId);
      if (!interview || interview.candidateId !== userId() || interview.events.length >= MAX_EVENTS) return;
      interview.events.push({ type: "done", at: elapsedMs(interview) });
      await interview.save();
      broadcastInterview(interview);
    }).catch((err) => console.error("Interview done failed:", err));
  });

  // The candidate ran the tests: record the result and the code at that moment.
  socket.on("interview:tests", (data: unknown) => {
    if (!allowed(socket, "interview:tests")) return;
    const { roomId, passed, total } = payloadOf<{ roomId: string; passed: number; total: number }>(data);
    if (typeof roomId !== "string" || !socket.rooms.has(roomId)) return;
    if (typeof passed !== "number" || typeof total !== "number") return;
    if (!Number.isInteger(passed) || !Number.isInteger(total) || total < 0 || total > 1000) return;
    if (passed < 0 || passed > total) return;

    void serial(roomId, async () => {
      const interview = await activeInterview(roomId);
      if (!interview || interview.candidateId !== userId() || interview.events.length >= MAX_EVENTS) return;
      if (Date.now() < interview.startedAt.getTime()) return;
      const at = elapsedMs(interview);
      interview.events.push({ type: "tests", at, data: { passed, total } });
      await addSnapshot(interview, `Tests ${passed}/${total}`, at);
      await interview.save();
      broadcastInterview(interview);
    }).catch((err) => console.error("Interview tests failed:", err));
  });

  // The Big-O meter measured the candidate's code.
  socket.on("interview:complexity", (data: unknown) => {
    if (!allowed(socket, "interview:complexity")) return;
    const { roomId, time, space } = payloadOf<{ roomId: string; time: string; space: string }>(data);
    if (typeof roomId !== "string" || !socket.rooms.has(roomId)) return;
    if (typeof time !== "string" || time.length > 24 || (space !== undefined && (typeof space !== "string" || space.length > 24))) return;

    void serial(roomId, async () => {
      const interview = await activeInterview(roomId);
      if (!interview || interview.candidateId !== userId() || interview.events.length >= MAX_EVENTS) return;
      if (Date.now() < interview.startedAt.getTime()) return;
      // Only when the reading changes.
      const last = [...interview.events].reverse().find((event) => event.type === "complexity");
      if (last && last.data?.time === time && last.data?.space === (space ?? null)) return;
      interview.events.push({ type: "complexity", at: elapsedMs(interview), data: { time, space: space ?? null } });
      await interview.save();
      broadcastInterview(interview);
    }).catch((err) => console.error("Interview complexity failed:", err));
  });
}