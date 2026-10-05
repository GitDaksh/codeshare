import type { Server, Socket } from "socket.io";
import { verifyToken } from "@clerk/backend";
import { Message } from "../models/Message";
import { Room } from "../models/Room";
import { Profile } from "../models/Profile";
import { canEdit, openRoom, roleOf, type RoomRole } from "../lib/access";
import { limiter, type Limiter } from "../lib/rateLimit";
import { awarenessShared, closeShared, flushShared, helloShared, leaveShared, updateShared } from "./collab";
import { noteEdit, noteLeave, registerInterviewEvents, sendInterviewOnJoin, setInterviewServer } from "./interview";

type PresenceUser = {
  socketId: string;
  userId: string;
  name: string;
  avatarId: string;
  role: RoomRole;
};

const DEFAULT_AVATAR_ID = "codeshare";
const ALLOWED_LANGUAGES = new Set(["javascript", "typescript", "python", "cpp", "java"]);
const ALLOWED_REACTIONS = new Set(["👍", "❤️", "😂", "🎉", "👀", "🚀"]);
const MAX_RUN_TEXT_CHARS = 20000;
const MAX_MESSAGE_CHARS = 2000;

// How fast each person may send each kind of event: a burst, then a steady
// rate per second. Far above what anyone does by hand; it stops scripts from
// flooding a room (or the database). Extra events are dropped.
const EVENT_LIMITS: Record<string, Limiter> = {
  "room:join": limiter(10, 1),
  "chat:message": limiter(8, 0.7),
  "reaction:toggle": limiter(15, 3),
  typing: limiter(10, 2),
  // Shared editing: every keystroke is an update; cursors move constantly.
  "collab:hello": limiter(10, 1),
  "collab:update": limiter(100, 40),
  "collab:awareness": limiter(60, 30),
  "language:change": limiter(5, 0.5),
  "run:start": limiter(6, 1),
  "run:result": limiter(6, 1),
  // Someone clicking through tests records several in a row.
  "lens:start": limiter(10, 0.5),
  "lens:step": limiter(60, 30),
  "lens:drive": limiter(10, 2),
  "lens:stop": limiter(10, 2),
  // Asking for edit access: a few times, then once every 30 seconds.
  "access:request": limiter(3, 1 / 30),
  "access:dismiss": limiter(20, 2),
};

function allowed(socket: Socket, event: string): boolean {
  return EVENT_LIMITS[event].take(socket.data.userId as string);
}

// Whether this connection may change the room: edit the code, switch the
// language, share runs, or drive Lens. Viewers can watch, follow and chat.
function mayEdit(socket: Socket): boolean {
  return canEdit(socket.data.role as RoomRole | undefined);
}

const roomPresence = new Map<string, Map<string, PresenceUser>>();
let server: Server | null = null;

// ---------- Asking for edit access ----------
// A viewer asks the owner to let them edit. Requests wait in memory (for an
// hour at most), so an owner who isn't in the room sees them when they come
// back. Granting one is just changing the person's role (peopleController.ts).

type AccessRequest = { userId: string; name: string; avatarId: string; at: number };

const ACCESS_REQUEST_TTL_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_ROOM = 50;
const accessRequests = new Map<string, Map<string, AccessRequest>>();

// The room's requests that haven't expired.
function pendingRequests(roomId: string): AccessRequest[] {
  const requests = accessRequests.get(roomId);
  if (!requests) return [];
  const now = Date.now();
  for (const [userId, request] of requests) {
    if (now - request.at > ACCESS_REQUEST_TTL_MS) requests.delete(userId);
  }
  if (requests.size === 0) accessRequests.delete(roomId);
  return [...requests.values()];
}

// Tells the room's owner (every tab they have open) who's waiting.
function sendRequestsToOwner(io: Server, roomId: string) {
  const requests = pendingRequests(roomId);
  for (const socket of io.of("/").sockets.values()) {
    if (socket.rooms.has(roomId) && socket.data.role === "owner") {
      socket.emit("access:requests", { roomId, requests });
    }
  }
}

function clearRequest(io: Server, roomId: string, userId: string) {
  const requests = accessRequests.get(roomId);
  if (!requests?.delete(userId)) return;
  if (requests.size === 0) accessRequests.delete(roomId);
  sendRequestsToOwner(io, roomId);
}

// ---------- Lens: shared step-by-step visualizations ----------
// The person who clicks Visualize records the run in their browser and
// sends the recording here gzip-compressed. The server never unpacks it: it
// relays it to the room and keeps the live session in memory so people who
// join late can catch up. The driver's current step is shared too.

type LensDriver = { userId: string; name: string; avatarId: string };

type LensSession = {
  id: string;
  title: string;
  code: string;
  trace: Buffer;
  driver: LensDriver | null;
  step: number;
  updatedAt: number;
};

const LENS_MAX_TRACE_BYTES = 800_000;
const LENS_MAX_CODE_CHARS = 60_000;
const LENS_MAX_TITLE_CHARS = 80;
const LENS_MAX_STEP = 1000;
const LENS_MAX_SESSIONS = 100;
const LENS_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const LENS_ID = /^[A-Za-z0-9-]{8,64}$/;

// One live session per room.
const lensSessions = new Map<string, LensSession>();

function currentLensSession(roomId: string, id?: unknown): LensSession | null {
  const session = lensSessions.get(roomId);
  if (!session) return null;
  if (Date.now() - session.updatedAt > LENS_SESSION_TTL_MS) {
    lensSessions.delete(roomId);
    return null;
  }
  return id === undefined || session.id === id ? session : null;
}

function isLensStep(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= LENS_MAX_STEP;
}

function lensSessionPayload(session: LensSession, fresh: boolean) {
  return {
    id: session.id,
    title: session.title,
    code: session.code,
    trace: session.trace,
    driver: session.driver,
    step: session.step,
    fresh,
  };
}

// Socket payloads come from clients and can be anything. Destructuring a
// missing/non-object payload would throw inside the handler, so every handler
// reads its payload through this and validates each field it uses.
function payloadOf<T extends object>(data: unknown): Partial<T> {
  return data && typeof data === "object" ? (data as Partial<T>) : {};
}

function runnerInfo(socket: Socket) {
  return {
    userId: socket.data.userId as string,
    name: (socket.data.userName as string) || "Anonymous",
    avatarId: (socket.data.userAvatarId as string) || DEFAULT_AVATAR_ID,
  };
}

function broadcastPresence(io: Server, roomId: string) {
  const room = roomPresence.get(roomId);
  const users = room ? Array.from(room.values()) : [];
  io.to(roomId).emit("presence:update", users);
}

// Shutdown: save every room's unsaved edits.
export async function flushAllPendingCodeSaves() {
  await flushShared();
}

function removeFromRoom(io: Server, socket: Socket, roomId: string) {
  const room = roomPresence.get(roomId);
  if (!room) return;

  room.delete(socket.id);
  leaveShared(io, socket, roomId);
  noteLeave(socket, roomId);
  if (room.size === 0) {
    roomPresence.delete(roomId);
    void closeShared(roomId);
    lensSessions.delete(roomId);
  } else {
    // The Lens driver left (all their tabs): free the wheel for anyone.
    const lens = lensSessions.get(roomId);
    const userId = socket.data.userId as string;
    const stillHere = Array.from(room.values()).some((user) => user.userId === userId);
    if (lens && lens.driver?.userId === userId && !stillHere) {
      lens.driver = null;
      io.to(roomId).emit("lens:driver", { id: lens.id, driver: null, step: lens.step });
    }
  }

  broadcastPresence(io, roomId);
}

// ---------- Changes made through the API (peopleController.ts calls these) ----------

// Everyone in the room re-reads who's here (and, if they may invite, the
// invite links).
export function roomChanged(roomId: string) {
  server?.to(roomId).emit("room:people", { roomId });
}

// Someone's role changed: it takes effect on their open connections at once.
export function applyRoleLive(roomId: string, userId: string, role: RoomRole) {
  const io = server;
  if (!io) return;
  for (const socket of io.of("/").sockets.values()) {
    if (socket.data.userId !== userId || !socket.rooms.has(roomId)) continue;
    socket.data.role = role;
    const entry = roomPresence.get(roomId)?.get(socket.id);
    if (entry) entry.role = role;
    socket.emit("room:role", { roomId, role });
  }
  // A viewer can't drive Lens: free the wheel for everyone else.
  const lens = lensSessions.get(roomId);
  if (!canEdit(role) && lens?.driver?.userId === userId) {
    lens.driver = null;
    io.to(roomId).emit("lens:driver", { id: lens.id, driver: null, step: lens.step });
  }
  // A request to edit is answered once their role changes.
  clearRequest(io, roomId, userId);
  broadcastPresence(io, roomId);
  roomChanged(roomId);
}

// Someone was removed from the room (or left it): their open connections are
// taken out of it straight away.
export function removeLive(roomId: string, userId: string) {
  const io = server;
  if (!io) return;
  for (const socket of io.of("/").sockets.values()) {
    if (socket.data.userId !== userId || !socket.rooms.has(roomId)) continue;
    socket.emit("room:removed", { roomId });
    socket.leave(roomId);
    removeFromRoom(io, socket, roomId);
    socket.data.roomId = undefined;
    socket.data.role = undefined;
  }
  clearRequest(io, roomId, userId);
  roomChanged(roomId);
}

export function setupSocket(io: Server) {
  server = io;
  setInterviewServer(io);
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("No token provided"));
    }

    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });

      socket.data.userId = payload.sub;
      next();
    } catch (err) {
      console.error("Socket auth rejected:", err);
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    console.log(`Socket connected: ${socket.id} (user ${socket.data.userId})`);
    registerInterviewEvents(socket);

    socket.on("room:join", async (data: unknown) => {
      if (!allowed(socket, "room:join")) return;
      const { roomId, invite } = payloadOf<{ roomId: string; invite: string }>(data);
      if (typeof roomId !== "string") return;

      // Only people who may open the room can join it: its owner, anyone who
      // joined before, or anyone with its invite link.
      const room = await openRoom(roomId, socket.data.userId as string, invite).catch(() => null);
      if (!room) {
        socket.emit("room:denied", { roomId });
        return;
      }

      const role = roleOf(room, socket.data.userId as string) ?? "viewer";
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.role = role;

      try {
        const profile = await Profile.findOne({ clerkUserId: socket.data.userId });
        socket.data.userName = profile?.username || "Anonymous";
        socket.data.userAvatarId = profile?.avatarId || DEFAULT_AVATAR_ID;
      } catch (err) {
        console.error("Failed to load profile for socket identity:", err);
        socket.data.userName = "Anonymous";
        socket.data.userAvatarId = DEFAULT_AVATAR_ID;
      }

      if (!roomPresence.has(roomId)) {
        roomPresence.set(roomId, new Map());
      }

      roomPresence.get(roomId)!.set(socket.id, {
        socketId: socket.id,
        userId: socket.data.userId,
        name: socket.data.userName,
        avatarId: socket.data.userAvatarId,
        role,
      });

      broadcastPresence(io, roomId);

      // Catch up on a Lens session that's already running.
      const lens = currentLensSession(roomId);
      if (lens) socket.emit("lens:session", lensSessionPayload(lens, false));

      // The browser can now sync the shared document (collab:hello).
      socket.emit("room:joined", { roomId, role });
      // The owner sees who asked to edit while they were away.
      if (role === "owner") {
        const requests = pendingRequests(roomId);
        if (requests.length) socket.emit("access:requests", { roomId, requests });
      }
      // Catch up on an interview in progress.
      void sendInterviewOnJoin(socket, roomId);
      console.log(`User ${socket.data.userId} joined room ${roomId}`);
    });

    // Shared editing (see collab.ts).
    socket.on("collab:hello", async (data: unknown) => {
      if (!allowed(socket, "collab:hello")) return;
      const { roomId, stateVector } = payloadOf<{ roomId: string; stateVector: unknown }>(data);
      if (typeof roomId !== "string" || !socket.rooms.has(roomId)) return;
      await helloShared(socket, roomId, stateVector).catch((err) => console.error("Failed to sync a room:", err));
    });

    socket.on("collab:update", async (data: unknown) => {
      const { roomId, update } = payloadOf<{ roomId: string; update: unknown }>(data);
      if (typeof roomId !== "string" || !socket.rooms.has(roomId)) return;
      // A dropped edit would leave this person out of step, so they're told
      // to sync again (their edits are sent again, nothing is lost).
      if (!allowed(socket, "collab:update")) {
        socket.emit("collab:rejected", { roomId, reason: "busy" });
        return;
      }
      // Viewers can't edit. Their editor is read-only, so this only happens
      // when someone is made a viewer mid-keystroke (or a script tries it):
      // they go back to the shared version.
      if (!mayEdit(socket)) {
        socket.emit("collab:rejected", { roomId, reason: "view-only" });
        return;
      }
      const result = await updateShared(socket, roomId, update).catch(() => "ignored" as const);
      if (result === "rejected") socket.emit("collab:rejected", { roomId, reason: "too-long" });
      // A large insertion by an interview's candidate is noted (monitoring).
      if (result === "ok") noteEdit(socket, roomId, update);
    });

    socket.on("collab:awareness", async (data: unknown) => {
      if (!allowed(socket, "collab:awareness")) return;
      const { roomId, update } = payloadOf<{ roomId: string; update: unknown }>(data);
      if (typeof roomId !== "string" || !socket.rooms.has(roomId)) return;
      await awarenessShared(socket, roomId, update, runnerInfo(socket)).catch(() => {});
    });

    socket.on("room:leave", (roomId: unknown) => {
      if (typeof roomId !== "string") return;
      socket.leave(roomId);
      removeFromRoom(io, socket, roomId);
      console.log(`User ${socket.data.userId} left room ${roomId}`);
    });

    socket.on("chat:message", async (data: unknown) => {
      if (!allowed(socket, "chat:message")) return;
      const { roomId, text } = payloadOf<{ roomId: string; text: string }>(data);
      if (typeof roomId !== "string" || typeof text !== "string") return;
      if (!text.trim() || text.trim().length > MAX_MESSAGE_CHARS || !socket.rooms.has(roomId)) return;

      try {
        const message = await Message.create({
          roomId,
          senderId: socket.data.userId,
          senderName: socket.data.userName || "Anonymous",
          senderAvatarId: socket.data.userAvatarId || DEFAULT_AVATAR_ID,
          text: text.trim(),
        });

        io.to(roomId).emit("chat:message", message);
      } catch (err) {
        console.error("Failed to save chat message:", err);
      }
    });

    socket.on("reaction:toggle", async (data: unknown) => {
      if (!allowed(socket, "reaction:toggle")) return;
      const { roomId, messageId, emoji } = payloadOf<{ roomId: string; messageId: string; emoji: string }>(data);
      if (typeof roomId !== "string" || typeof messageId !== "string" || typeof emoji !== "string") return;
      if (!socket.rooms.has(roomId) || !ALLOWED_REACTIONS.has(emoji)) return;

      try {
        const message = await Message.findById(messageId);
        if (!message || message.roomId.toString() !== roomId) return;

        const userId = socket.data.userId;
        const existingIndex = message.reactions.findIndex(
          (r) => r.userId === userId && r.emoji === emoji
        );

        if (existingIndex >= 0) {
          message.reactions.splice(existingIndex, 1);
        } else {
          message.reactions.push({ emoji, userId });
        }

        await message.save();

        io.to(roomId).emit("reaction:update", {
          messageId,
          reactions: message.reactions,
        });
      } catch (err) {
        console.error("Failed to toggle reaction:", err);
      }
    });

    socket.on("typing", (data: unknown) => {
      if (!allowed(socket, "typing")) return;
      const { roomId, isTyping } = payloadOf<{ roomId: string; isTyping: boolean }>(data);
      if (typeof roomId !== "string" || !socket.rooms.has(roomId)) return;

      socket.to(roomId).emit("typing", {
        userId: socket.data.userId,
        name: socket.data.userName || "Anonymous",
        isTyping: Boolean(isTyping),
      });
    });

    // A viewer asks the owner for edit access.
    socket.on("access:request", (data: unknown) => {
      if (!allowed(socket, "access:request")) return;
      const { roomId } = payloadOf<{ roomId: string }>(data);
      if (typeof roomId !== "string" || !socket.rooms.has(roomId) || socket.data.role !== "viewer") return;

      // Check the room's limit first (this also clears expired requests).
      const userId = socket.data.userId as string;
      const waiting = pendingRequests(roomId);
      if (!waiting.some((request) => request.userId === userId) && waiting.length >= MAX_REQUESTS_PER_ROOM) return;
      let requests = accessRequests.get(roomId);
      if (!requests) {
        requests = new Map();
        accessRequests.set(roomId, requests);
      }
      const { name, avatarId } = runnerInfo(socket);
      requests.set(userId, { userId, name, avatarId, at: Date.now() });

      sendRequestsToOwner(io, roomId);
      const ownerHere = Array.from(roomPresence.get(roomId)?.values() ?? []).some((user) => user.role === "owner");
      socket.emit("access:requested", { roomId, ownerHere });
    });

    // The owner turns a request down (it just disappears; nobody is told).
    socket.on("access:dismiss", (data: unknown) => {
      if (!allowed(socket, "access:dismiss")) return;
      const { roomId, userId } = payloadOf<{ roomId: string; userId: string }>(data);
      if (typeof roomId !== "string" || typeof userId !== "string") return;
      if (!socket.rooms.has(roomId) || socket.data.role !== "owner") return;
      clearRequest(io, roomId, userId);
    });

    socket.on("language:change", async (data: unknown) => {
      if (!allowed(socket, "language:change")) return;
      const { roomId, language } = payloadOf<{ roomId: string; language: string }>(data);
      if (typeof roomId !== "string" || typeof language !== "string") return;
      if (!socket.rooms.has(roomId) || !ALLOWED_LANGUAGES.has(language) || !mayEdit(socket)) return;

      socket.to(roomId).emit("language:update", {
        language,
        userId: socket.data.userId,
        name: socket.data.userName || "Anonymous",
      });

      try {
        await Room.updateOne({ _id: roomId }, { language });
      } catch (err) {
        console.error(`Failed to save language for room ${roomId}:`, err);
      }
    });

    socket.on("run:start", (data: unknown) => {
      if (!allowed(socket, "run:start")) return;
      const { roomId, language } = payloadOf<{ roomId: string; language: string }>(data);
      if (typeof roomId !== "string" || !socket.rooms.has(roomId) || !mayEdit(socket)) return;

      socket.to(roomId).emit("run:start", {
        ...runnerInfo(socket),
        language: String(language ?? ""),
      });
    });

    socket.on("run:result", (data: unknown) => {
      if (!allowed(socket, "run:result")) return;
      const { roomId, language, output, error, durationMs } = payloadOf<{
        roomId: string;
        language: string;
        output: string;
        error: string | null;
        durationMs: number;
      }>(data);
      if (typeof roomId !== "string" || !socket.rooms.has(roomId) || !mayEdit(socket)) return;

      socket.to(roomId).emit("run:result", {
        ...runnerInfo(socket),
        language: String(language ?? ""),
        output: typeof output === "string" ? output.slice(0, MAX_RUN_TEXT_CHARS) : "",
        error: typeof error === "string" ? error.slice(0, MAX_RUN_TEXT_CHARS) : null,
        durationMs: typeof durationMs === "number" && Number.isFinite(durationMs) ? durationMs : 0,
      });
    });

    socket.on("lens:start", (data: unknown) => {
      if (!allowed(socket, "lens:start")) return;
      const { roomId, id, title, code, trace } = payloadOf<{
        roomId: string;
        id: string;
        title: string;
        code: string;
        trace: unknown;
      }>(data);
      if (typeof roomId !== "string" || !socket.rooms.has(roomId) || !mayEdit(socket)) return;
      if (typeof id !== "string" || !LENS_ID.test(id)) return;
      if (typeof code !== "string" || code.length > LENS_MAX_CODE_CHARS) return;
      if (!Buffer.isBuffer(trace) || trace.length === 0 || trace.length > LENS_MAX_TRACE_BYTES) return;

      // Keep memory bounded: make room by dropping the oldest session.
      if (!lensSessions.has(roomId) && lensSessions.size >= LENS_MAX_SESSIONS) {
        let oldest: string | null = null;
        let oldestAt = Infinity;
        for (const [key, session] of lensSessions) {
          if (session.updatedAt < oldestAt) {
            oldest = key;
            oldestAt = session.updatedAt;
          }
        }
        if (oldest) lensSessions.delete(oldest);
      }

      const session: LensSession = {
        id,
        title: typeof title === "string" ? title.trim().slice(0, LENS_MAX_TITLE_CHARS) : "",
        code,
        trace,
        driver: runnerInfo(socket),
        step: 0,
        updatedAt: Date.now(),
      };
      lensSessions.set(roomId, session);
      socket.to(roomId).emit("lens:session", lensSessionPayload(session, true));
    });

    socket.on("lens:step", (data: unknown) => {
      if (!allowed(socket, "lens:step")) return;
      const { roomId, id, step } = payloadOf<{ roomId: string; id: string; step: number }>(data);
      if (typeof roomId !== "string" || !socket.rooms.has(roomId) || !isLensStep(step) || !mayEdit(socket)) return;
      const session = currentLensSession(roomId, id);
      // Only the driver moves everyone.
      if (!session || session.driver?.userId !== socket.data.userId) return;

      session.step = step;
      session.updatedAt = Date.now();
      socket.to(roomId).emit("lens:step", { id: session.id, step });
    });

    socket.on("lens:drive", (data: unknown) => {
      if (!allowed(socket, "lens:drive")) return;
      const { roomId, id, step } = payloadOf<{ roomId: string; id: string; step: number }>(data);
      if (typeof roomId !== "string" || !socket.rooms.has(roomId) || !isLensStep(step) || !mayEdit(socket)) return;
      const session = currentLensSession(roomId, id);
      if (!session) return;

      session.driver = runnerInfo(socket);
      session.step = step;
      session.updatedAt = Date.now();
      socket.to(roomId).emit("lens:driver", { id: session.id, driver: session.driver, step });
    });

    socket.on("lens:stop", (data: unknown) => {
      if (!allowed(socket, "lens:stop")) return;
      const { roomId, id } = payloadOf<{ roomId: string; id: string }>(data);
      if (typeof roomId !== "string" || !socket.rooms.has(roomId) || !mayEdit(socket)) return;
      const session = currentLensSession(roomId, id);
      // The driver ends it (or any editor, once nobody is driving).
      if (!session || (session.driver && session.driver.userId !== socket.data.userId)) return;

      lensSessions.delete(roomId);
      socket.to(roomId).emit("lens:stop", { id: session.id });
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
      if (socket.data.roomId) {
        removeFromRoom(io, socket, socket.data.roomId);
      }
    });
  });
}