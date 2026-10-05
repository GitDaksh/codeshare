import type { Server, Socket } from "socket.io";
import { Interview, INTERVIEW_PHASES, type IInterview, type InterviewPhase } from "../models/Interview";
import { limiter, type Limiter } from "../lib/rateLimit";
import {
  COUNTDOWN_MS,
  MAX_EVENTS,
  MAX_EXTRA_MS,
  MAX_MONITOR_EVENTS,
  MAX_NOTES,
  MAX_SNAPSHOTS,
  elapsedMs,
  isCandidate,
  isInterviewer,
  publicInterview,
} from "../lib/interviews";
import { bytesOf, currentCode, measureUpdate, replaceCode } from "./collab";

// Interviews, live. Interviewers start the interview, run the clock and the
// questions, give hints and take shared notes. The candidate's test runs and
// Big-O readings are recorded with the code at that moment, and (when
// monitoring is on, which the candidate is told) so are tab switches, pastes,
// large insertions, second tabs and dropped connections. Everything is
// stamped in interview time for the report.

const EXTEND_MS = 5 * 60 * 1000;
// Practice problems come with a ladder of three hints.
const PROBLEM_HINTS = 3;
const MAX_HINTS = 10;
// Characters added in one edit that count as a large insertion.
const LARGE_INSERT = 120;
const MONITOR_KINDS = new Set(["hidden", "visible", "paste", "consent", "fullscreen"]);

const LIMITS: Record<string, Limiter> = {
  "interview:control": limiter(30, 3),
  "interview:note": limiter(20, 2),
  "interview:done": limiter(3, 0.1),
  "interview:tests": limiter(10, 1),
  "interview:complexity": limiter(10, 1),
  "interview:monitor": limiter(40, 1),
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

// What each open interview needs on every keystroke, kept in memory: whose
// edits to watch, and whether monitoring is on.
type Watch = { candidateId: string | null; monitoring: boolean; running: boolean };
const watching = new Map<string, Watch>();
// When the candidate's last connection to a room dropped.
const awaySince = new Map<string, number>();

function remember(interview: IInterview) {
  const roomId = interview.roomId.toString();
  if (interview.status === "ended") {
    watching.delete(roomId);
    awaySince.delete(roomId);
    return;
  }
  watching.set(roomId, {
    candidateId: interview.candidate?.userId ?? null,
    monitoring: interview.settings.monitoring && interview.mode === "live",
    running: interview.status === "running" || interview.status === "paused",
  });
}

// The room's interview that isn't over yet (scheduled, running or paused).
export function openInterview(roomId: string): Promise<IInterview | null> {
  return Interview.findOne({ roomId, status: { $in: ["scheduled", "running", "paused"] } });
}

function sendNotes(socket: Socket, interview: IInterview) {
  socket.emit("interview:notes", {
    roomId: interview.roomId.toString(),
    interviewId: interview._id.toString(),
    notes: interview.notes,
  });
}

// Everyone in the room gets the view their part allows: interviewers the
// full one (and the shared notes), the candidate and observers the public one.
export function broadcastInterview(interview: IInterview) {
  remember(interview);
  const roomId = interview.roomId.toString();
  const staffView = publicInterview(interview, true);
  const publicView = publicInterview(interview, false);
  for (const socket of server?.of("/").sockets.values() ?? []) {
    if (!socket.rooms.has(roomId)) continue;
    const staff = isInterviewer(interview, socket.data.userId);
    socket.emit("interview:state", { roomId, interview: staff ? staffView : publicView });
    if (staff) sendNotes(socket, interview);
  }
}

function candidateSockets(roomId: string, candidateId: string): number {
  let count = 0;
  for (const socket of server?.of("/").sockets.values() ?? []) {
    if (socket.rooms.has(roomId) && socket.data.userId === candidateId) count++;
  }
  return count;
}

function pushEvent(interview: IInterview, event: IInterview["events"][number]): boolean {
  if (interview.events.length >= MAX_EVENTS) return false;
  if (event.type === "monitor") {
    const monitors = interview.events.filter((e) => e.type === "monitor").length;
    if (monitors >= MAX_MONITOR_EVENTS) return false;
  }
  interview.events.push(event);
  return true;
}

function monitoring(interview: IInterview): boolean {
  return interview.settings.monitoring && interview.mode === "live" && (interview.status === "running" || interview.status === "paused");
}

// Someone joined the room: catch them up. When it's the candidate, note a
// second tab or device, or a return after a dropped connection.
export async function sendInterviewOnJoin(socket: Socket, roomId: string) {
  const interview = await openInterview(roomId).catch(() => null);
  if (!interview) return;
  remember(interview);
  const staff = isInterviewer(interview, socket.data.userId);
  socket.emit("interview:state", { roomId, interview: publicInterview(interview, staff) });
  if (staff) sendNotes(socket, interview);

  if (!isCandidate(interview, socket.data.userId) || !monitoring(interview)) return;
  const tabs = candidateSockets(roomId, socket.data.userId as string);
  const left = awaySince.get(roomId);
  awaySince.delete(roomId);
  if (tabs < 2 && left === undefined) return;
  void serial(roomId, async () => {
    const fresh = await openInterview(roomId);
    if (!fresh || !monitoring(fresh)) return;
    const at = elapsedMs(fresh);
    if (left !== undefined) pushEvent(fresh, { type: "monitor", at, question: fresh.current, data: { kind: "back", ms: Date.now() - left } });
    if (tabs >= 2) pushEvent(fresh, { type: "monitor", at, question: fresh.current, data: { kind: "tabs", count: tabs } });
    await fresh.save();
    broadcastInterview(fresh);
  }).catch((err) => console.error("Interview join note failed:", err));
}

// Someone's connection left the room. The candidate's last one dropping is
// noted, with how long until they're back.
export function noteLeave(socket: Socket, roomId: string) {
  const watch = watching.get(roomId);
  if (!watch || !watch.candidateId || !watch.monitoring || !watch.running) return;
  if (watch.candidateId !== socket.data.userId) return;
  // By now this connection has left the room: anyone else still here?
  if (candidateSockets(roomId, watch.candidateId) > 0) return;
  awaySince.set(roomId, Date.now());
  void serial(roomId, async () => {
    const interview = await openInterview(roomId);
    if (!interview || !monitoring(interview)) return;
    if (!pushEvent(interview, { type: "monitor", at: elapsedMs(interview), question: interview.current, data: { kind: "left" } })) return;
    await interview.save();
    broadcastInterview(interview);
  }).catch((err) => console.error("Interview leave note failed:", err));
}

// An edit by the candidate that adds a lot of text at once.
export function noteEdit(socket: Socket, roomId: string, value: unknown) {
  const watch = watching.get(roomId);
  if (!watch || !watch.monitoring || !watch.running || watch.candidateId !== socket.data.userId) return;
  const update = bytesOf(value);
  if (!update) return;
  const { added, deleted } = measureUpdate(update);
  if (added < LARGE_INSERT || added - deleted < LARGE_INSERT - 20) return;
  void serial(roomId, async () => {
    const interview = await openInterview(roomId);
    if (!interview || !monitoring(interview)) return;
    const at = elapsedMs(interview);
    // The candidate's browser already reported this as a paste (it arrives
    // first): one action, one flag.
    const paste = [...interview.events].reverse().find((event) => event.type === "monitor" && event.data?.kind === "paste");
    if (paste && at - paste.at < 5000 && Math.abs(Number(paste.data?.chars ?? 0) - added) <= Math.max(5, added * 0.1)) return;
    if (!pushEvent(interview, { type: "monitor", at, question: interview.current, data: { kind: "insert", chars: added } })) return;
    await interview.save();
    broadcastInterview(interview);
  }).catch((err) => console.error("Interview edit note failed:", err));
}

// The code as it is now, for the report (skipped if nothing changed).
async function addSnapshot(interview: IInterview, label: string, at: number) {
  const code = await currentCode(interview.roomId.toString()).catch(() => null);
  if (code === null) return;
  const last = interview.snapshots[interview.snapshots.length - 1];
  if (last && last.code === code && last.question === interview.current) return;
  // Keep the first one (where they started) and the most recent ones.
  if (interview.snapshots.length >= MAX_SNAPSHOTS) interview.snapshots.splice(1, 1);
  interview.snapshots.push({ at, label, code, question: interview.current });
}

// Saves the current question's code and time before the interview leaves it.
async function closeQuestion(interview: IInterview, at: number) {
  const question = interview.questions[interview.current];
  if (!question) return;
  question.code = await currentCode(interview.roomId.toString()).catch(() => question.code);
  question.timeSpentMs += Math.max(0, at - interview.currentSince);
  if (question.status === "active") question.status = "done";
  interview.markModified("questions");
}

export async function endInterview(interview: IInterview, now = Date.now()) {
  if (interview.status === "paused" && interview.pausedAt) {
    interview.pausedMs += now - interview.pausedAt.getTime();
    interview.pausedAt = null;
  }
  const at = elapsedMs(interview, now);
  if (interview.status !== "scheduled") {
    await addSnapshot(interview, "Final", at);
    await closeQuestion(interview, at);
  }
  interview.status = "ended";
  interview.endedAt = new Date(now);
  interview.events.push({ type: "end", at, question: interview.current });
  await interview.save();
  broadcastInterview(interview);
}

// Starts a scheduled interview: question 1's starter code for everyone,
// then the countdown.
export async function startInterview(interview: IInterview, now = Date.now()) {
  const first = interview.questions[0];
  interview.status = "running";
  interview.startedAt = new Date(now + COUNTDOWN_MS);
  interview.current = 0;
  interview.currentSince = 0;
  first.status = "active";
  interview.markModified("questions");
  interview.events.push({ type: "start", at: 0, question: 0 });
  if (server) await replaceCode(server, interview.roomId.toString(), first.starter);
  await interview.save();
  broadcastInterview(interview);
}

// Sets the room's code for everyone (the in-room setup's clean editor).
export async function resetRoomCode(roomId: string, code: string) {
  if (server) await replaceCode(server, roomId, code);
}

export function registerInterviewEvents(socket: Socket) {
  const userId = () => socket.data.userId as string;

  // The interviewers' controls.
  socket.on("interview:control", (data: unknown) => {
    if (!allowed(socket, "interview:control")) return;
    const { roomId, action, phase, text, index } = payloadOf<{
      roomId: string;
      action: string;
      phase: string;
      text: string;
      index: number;
    }>(data);
    if (typeof roomId !== "string" || !socket.rooms.has(roomId) || typeof action !== "string") return;

    void serial(roomId, async () => {
      const interview = await openInterview(roomId);
      if (!interview || !isInterviewer(interview, userId())) return;
      const now = Date.now();

      if (action === "start") {
        if (interview.status !== "scheduled") return;
        if (!interview.candidate) {
          socket.emit("interview:error", { roomId, message: "The candidate hasn't joined yet." });
          return;
        }
        return startInterview(interview, now);
      }
      if (interview.status === "scheduled") return;
      if (action === "end") return endInterview(interview, now);

      const started = now >= (interview.startedAt?.getTime() ?? Infinity);
      const at = elapsedMs(interview, now);
      const question = interview.questions[interview.current];

      if (action === "pause") {
        if (interview.status !== "running" || !started) return;
        interview.status = "paused";
        interview.pausedAt = new Date(now);
        pushEvent(interview, { type: "pause", at, question: interview.current });
      } else if (action === "resume") {
        if (interview.status !== "paused" || !interview.pausedAt) return;
        interview.pausedMs += now - interview.pausedAt.getTime();
        interview.pausedAt = null;
        interview.status = "running";
        pushEvent(interview, { type: "resume", at, question: interview.current });
      } else if (action === "extend") {
        if (interview.extraMs + EXTEND_MS > MAX_EXTRA_MS) return;
        interview.extraMs += EXTEND_MS;
        pushEvent(interview, { type: "extend", at, question: interview.current, data: { minutes: EXTEND_MS / 60000 } });
      } else if (action === "phase") {
        if (!INTERVIEW_PHASES.includes(phase as InterviewPhase) || phase === interview.phase) return;
        interview.phase = phase as InterviewPhase;
        pushEvent(interview, { type: "phase", at, question: interview.current, data: { phase } });
      } else if (action === "hint") {
        if (!interview.settings.hints || !question) return;
        if (question.problemSlug) {
          if (question.hintsGiven >= PROBLEM_HINTS) return;
        } else if (question.hintsGiven >= question.hints.length) {
          // Their own question, out of written hints: the interviewer writes one.
          if (typeof text !== "string" || !text.trim() || text.length > 500) return;
          if (question.hints.length >= MAX_HINTS) return;
          question.hints.push(text.trim());
        }
        question.hintsGiven += 1;
        interview.markModified("questions");
        pushEvent(interview, { type: "hint", at, question: interview.current, data: { index: question.hintsGiven } });
      } else if (action === "goto" || action === "next") {
        const target = action === "next" ? interview.current + 1 : index;
        if (typeof target !== "number" || !Number.isInteger(target)) return;
        if (target < 0 || target >= interview.questions.length || target === interview.current) return;
        await addSnapshot(interview, "Moved on", at);
        const from = interview.current;
        await closeQuestion(interview, at);
        const next = interview.questions[target];
        next.status = "active";
        interview.current = target;
        interview.currentSince = at;
        interview.markModified("questions");
        pushEvent(interview, { type: "question", at, question: target, data: { from, to: target } });
        if (server) await replaceCode(server, roomId, next.code || next.starter);
      } else {
        return;
      }
      await interview.save();
      broadcastInterview(interview);
    }).catch((err) => console.error("Interview control failed:", err));
  });

  // The interviewers' notes, shared between them and stamped with the time.
  socket.on("interview:note", (data: unknown) => {
    if (!allowed(socket, "interview:note")) return;
    const { roomId, text, tag } = payloadOf<{ roomId: string; text: string; tag: string }>(data);
    if (typeof roomId !== "string" || !socket.rooms.has(roomId)) return;
    if (typeof text !== "string" || !text.trim() || text.length > 500) return;
    if (tag !== undefined && (typeof tag !== "string" || tag.length > 40)) return;

    void serial(roomId, async () => {
      const interview = await openInterview(roomId);
      if (!interview || !isInterviewer(interview, userId()) || interview.notes.length >= MAX_NOTES) return;
      const author = interview.interviewers.find((person) => person.userId === userId());
      interview.notes.push({
        at: elapsedMs(interview),
        text: text.trim(),
        ...(tag ? { tag } : {}),
        authorId: userId(),
        authorName: author?.name ?? "Interviewer",
        question: interview.current,
      });
      await interview.save();
      broadcastInterview(interview);
    }).catch((err) => console.error("Interview note failed:", err));
  });

  // The candidate says they're done (with the current question).
  socket.on("interview:done", (data: unknown) => {
    if (!allowed(socket, "interview:done")) return;
    const { roomId } = payloadOf<{ roomId: string }>(data);
    if (typeof roomId !== "string" || !socket.rooms.has(roomId)) return;

    void serial(roomId, async () => {
      const interview = await openInterview(roomId);
      if (!interview || !isCandidate(interview, userId()) || interview.status === "scheduled") return;
      if (!pushEvent(interview, { type: "done", at: elapsedMs(interview), question: interview.current })) return;
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
      const interview = await openInterview(roomId);
      if (!interview || !isCandidate(interview, userId()) || interview.status === "scheduled") return;
      if (Date.now() < (interview.startedAt?.getTime() ?? Infinity)) return;
      const at = elapsedMs(interview);
      if (!pushEvent(interview, { type: "tests", at, question: interview.current, data: { passed, total } })) return;
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
      const interview = await openInterview(roomId);
      if (!interview || !isCandidate(interview, userId()) || interview.status === "scheduled") return;
      if (Date.now() < (interview.startedAt?.getTime() ?? Infinity)) return;
      // Only when the reading changes (for this question).
      const last = [...interview.events]
        .reverse()
        .find((event) => event.type === "complexity" && event.question === interview.current);
      if (last && last.data?.time === time && last.data?.space === (space ?? null)) return;
      if (!pushEvent(interview, { type: "complexity", at: elapsedMs(interview), question: interview.current, data: { time, space: space ?? null } })) return;
      await interview.save();
      broadcastInterview(interview);
    }).catch((err) => console.error("Interview complexity failed:", err));
  });

  // What the candidate's browser notices (when monitoring is on): the tab
  // hidden and shown again (with how long), pastes, leaving full screen, and
  // the candidate acknowledging that monitoring is on.
  socket.on("interview:monitor", (data: unknown) => {
    if (!allowed(socket, "interview:monitor")) return;
    const { roomId, kind, ms, chars, lines } = payloadOf<{
      roomId: string;
      kind: string;
      ms: number;
      chars: number;
      lines: number;
    }>(data);
    if (typeof roomId !== "string" || !socket.rooms.has(roomId) || typeof kind !== "string" || !MONITOR_KINDS.has(kind)) return;
    const number = (value: unknown, max: number) =>
      typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.min(Math.round(value), max) : undefined;
    const details = {
      ...(number(ms, 24 * 60 * 60 * 1000) !== undefined ? { ms: number(ms, 24 * 60 * 60 * 1000) } : {}),
      ...(number(chars, 1_000_000) !== undefined ? { chars: number(chars, 1_000_000) } : {}),
      ...(number(lines, 100_000) !== undefined ? { lines: number(lines, 100_000) } : {}),
    };

    void serial(roomId, async () => {
      const interview = await openInterview(roomId);
      if (!interview || !isCandidate(interview, userId()) || interview.mode !== "live" || !interview.settings.monitoring) return;
      // Consent can be given in the lobby; everything else counts once it's running.
      if (kind !== "consent" && !monitoring(interview)) return;
      if (kind === "consent" && interview.events.some((event) => event.type === "monitor" && event.data?.kind === "consent")) return;
      if (!pushEvent(interview, { type: "monitor", at: elapsedMs(interview), question: interview.current, data: { kind, ...details } })) return;
      await interview.save();
      broadcastInterview(interview);
    }).catch((err) => console.error("Interview monitor failed:", err));
  });
}