import type { Server, Socket } from "socket.io";
import { verifyToken } from "@clerk/backend";
import { Message } from "../models/Message";
import { Room } from "../models/Room";
import { Profile } from "../models/Profile";

type PresenceUser = {
  socketId: string;
  userId: string;
  name: string;
  avatarId: string;
};

type PendingCodeSave = {
  timer: NodeJS.Timeout;
  code: string;
};

const CODE_SAVE_DEBOUNCE_MS = 1500;
const DEFAULT_AVATAR_ID = "codeshare";
const ALLOWED_LANGUAGES = new Set(["javascript", "typescript", "python", "cpp", "java"]);
const ALLOWED_REACTIONS = new Set(["👍", "❤️", "😂", "🎉", "👀", "🚀"]);
const MAX_RUN_TEXT_CHARS = 20000;

const roomPresence = new Map<string, Map<string, PresenceUser>>();
const pendingCodeSaves = new Map<string, PendingCodeSave>();

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

async function saveRoomCode(roomId: string, code: string) {
  try {
    await Room.findByIdAndUpdate(roomId, { code });
  } catch (err) {
    console.error(`Failed to save code for room ${roomId}:`, err);
  }
}

function scheduleCodeSave(roomId: string, code: string) {
  const existing = pendingCodeSaves.get(roomId);
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    pendingCodeSaves.delete(roomId);
    saveRoomCode(roomId, code);
  }, CODE_SAVE_DEBOUNCE_MS);

  pendingCodeSaves.set(roomId, { timer, code });
}

function flushCodeSave(roomId: string) {
  const pending = pendingCodeSaves.get(roomId);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingCodeSaves.delete(roomId);
  saveRoomCode(roomId, pending.code);
}

export async function flushAllPendingCodeSaves() {
  const saves = Array.from(pendingCodeSaves.entries()).map(([roomId, pending]) => {
    clearTimeout(pending.timer);
    return saveRoomCode(roomId, pending.code);
  });
  pendingCodeSaves.clear();
  await Promise.all(saves);
}

function removeFromRoom(io: Server, socket: Socket, roomId: string) {
  const room = roomPresence.get(roomId);
  if (!room) return;

  room.delete(socket.id);
  if (room.size === 0) {
    roomPresence.delete(roomId);
    flushCodeSave(roomId);
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
      const { roomId } = payloadOf<{ roomId: string }>(data);
      if (typeof roomId !== "string") return;

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
      console.log(`User ${socket.data.userId} joined room ${roomId}`);
    });

    socket.on("room:leave", (roomId: unknown) => {
      if (typeof roomId !== "string") return;
      socket.leave(roomId);
      removeFromRoom(io, socket, roomId);
      console.log(`User ${socket.data.userId} left room ${roomId}`);
    });

    socket.on("chat:message", async (data: unknown) => {
      const { roomId, text } = payloadOf<{ roomId: string; text: string }>(data);
      if (typeof roomId !== "string" || typeof text !== "string") return;
      if (!text.trim() || !socket.rooms.has(roomId)) return;

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
      const { roomId, isTyping } = payloadOf<{ roomId: string; isTyping: boolean }>(data);
      if (typeof roomId !== "string" || !socket.rooms.has(roomId)) return;

      socket.to(roomId).emit("typing", {
        userId: socket.data.userId,
        name: socket.data.userName || "Anonymous",
        isTyping: Boolean(isTyping),
      });
    });

    socket.on("code:change", (data: unknown) => {
      const { roomId, code, line, column } = payloadOf<{
        roomId: string;
        code: string;
        line: number;
        column: number;
      }>(data);
      if (typeof roomId !== "string" || typeof code !== "string" || !socket.rooms.has(roomId)) return;

      const cursor =
        typeof line === "number" && typeof column === "number"
          ? { userId: socket.data.userId, name: socket.data.userName || "Anonymous", line, column }
          : null;

      socket.to(roomId).emit("code:change", { code, cursor });
      scheduleCodeSave(roomId, code);
    });

    socket.on("cursor:move", (data: unknown) => {
      const { roomId, line, column } = payloadOf<{ roomId: string; line: number; column: number }>(data);
      if (typeof roomId !== "string" || typeof line !== "number" || typeof column !== "number") return;
      if (!socket.rooms.has(roomId)) return;

      socket.to(roomId).emit("cursor:move", {
        userId: socket.data.userId,
        name: socket.data.userName || "Anonymous",
        line,
        column,
      });
    });

    socket.on("language:change", async (data: unknown) => {
      const { roomId, language } = payloadOf<{ roomId: string; language: string }>(data);
      if (typeof roomId !== "string" || typeof language !== "string") return;
      if (!socket.rooms.has(roomId) || !ALLOWED_LANGUAGES.has(language)) return;

      socket.to(roomId).emit("language:update", {
        language,
        userId: socket.data.userId,
        name: socket.data.userName || "Anonymous",
      });

      try {
        await Room.findByIdAndUpdate(roomId, { language });
      } catch (err) {
        console.error(`Failed to save language for room ${roomId}:`, err);
      }
    });

    socket.on("run:start", (data: unknown) => {
      const { roomId, language } = payloadOf<{ roomId: string; language: string }>(data);
      if (typeof roomId !== "string" || !socket.rooms.has(roomId)) return;

      socket.to(roomId).emit("run:start", {
        ...runnerInfo(socket),
        language: String(language ?? ""),
      });
    });

    socket.on("run:result", (data: unknown) => {
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

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
      if (socket.data.roomId) {
        removeFromRoom(io, socket, socket.data.roomId);
      }
    });
  });
}