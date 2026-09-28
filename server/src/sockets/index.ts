import type { Server, Socket } from "socket.io";
import { verifyToken } from "@clerk/backend";
import { Message } from "../models/Message";
import { Room } from "../models/Room";
import { Profile } from "../models/Profile";
import { openRoom } from "../lib/access";
import { limiter, type Limiter } from "../lib/rateLimit";
import { awarenessShared, closeShared, flushShared, helloShared, leaveShared, updateShared } from "./collab";

type PresenceUser = {
  socketId: string;
  userId: string;
  name: string;
  avatarId: string;
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
};

function allowed(socket: Socket, event: string): boolean {
  return EVENT_LIMITS[event].take(socket.data.userId as string);
}

const roomPresence = new Map<string, Map<string, PresenceUser>>();

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

export function setupSocket(io: Server) {
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

      socket.join(roomId);
      socket.data.roomId = roomId;

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
      });

      broadcastPresence(io, roomId);

      // Catch up on a Lens session that's already running.
      const lens = currentLensSession(roomId);
      if (lens) socket.emit("lens:session", lensSessionPayload(lens, false));

      // The browser can now sync the shared document (collab:hello).
      socket.emit("room:joined", { roomId });
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
      const result = await updateShared(socket, roomId, update).catch(() => "ignored" as const);
      if (result === "rejected") socket.emit("collab:rejected", { roomId, reason: "too-long" });
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

    socket.on("language:change", async (data: unknown) => {
      if (!allowed(socket, "language:change")) return;
      const { roomId, language } = payloadOf<{ roomId: string; language: string }>(data);
      if (typeof roomId !== "string" || typeof language !== "string") return;
      if (!socket.rooms.has(roomId) || !ALLOWED_LANGUAGES.has(language)) return;

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
      if (typeof roomId !== "string" || !socket.rooms.has(roomId)) return;

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
      if (typeof roomId !== "string" || !socket.rooms.has(roomId)) return;

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
      if (typeof roomId !== "string" || !socket.rooms.has(roomId)) return;
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
      if (typeof roomId !== "string" || !socket.rooms.has(roomId) || !isLensStep(step)) return;
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
      if (typeof roomId !== "string" || !socket.rooms.has(roomId) || !isLensStep(step)) return;
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
      if (typeof roomId !== "string" || !socket.rooms.has(roomId)) return;
      const session = currentLensSession(roomId, id);
      // The driver ends it (or anyone, once nobody is driving).
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