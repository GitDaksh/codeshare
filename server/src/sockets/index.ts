import type { Server, Socket } from "socket.io";
import { verifyToken } from "@clerk/backend";
import { Message } from "../models/Message";
import { Room } from "../models/Room";

type PresenceUser = {
  socketId: string;
  userId: string;
  name: string;
};

type PendingCodeSave = {
  timer: NodeJS.Timeout;
  code: string;
};

const CODE_SAVE_DEBOUNCE_MS = 1500;

const roomPresence = new Map<string, Map<string, PresenceUser>>();
const pendingCodeSaves = new Map<string, PendingCodeSave>();

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

    socket.on("room:join", ({ roomId, name }: { roomId: string; name: string }) => {
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.userName = name || "Anonymous";

      if (!roomPresence.has(roomId)) {
        roomPresence.set(roomId, new Map());
      }

      roomPresence.get(roomId)!.set(socket.id, {
        socketId: socket.id,
        userId: socket.data.userId,
        name: socket.data.userName,
      });

      broadcastPresence(io, roomId);
      console.log(`User ${socket.data.userId} joined room ${roomId}`);
    });

    socket.on("room:leave", (roomId: string) => {
      socket.leave(roomId);
      removeFromRoom(io, socket, roomId);
      console.log(`User ${socket.data.userId} left room ${roomId}`);
    });

    socket.on("chat:message", async ({ roomId, text }: { roomId: string; text: string }) => {
      if (!text?.trim() || !socket.rooms.has(roomId)) return;

      try {
        const message = await Message.create({
          roomId,
          senderId: socket.data.userId,
          senderName: socket.data.userName || "Anonymous",
          text: text.trim(),
        });

        io.to(roomId).emit("chat:message", message);
      } catch (err) {
        console.error("Failed to save chat message:", err);
      }
    });

    socket.on("code:change", ({ roomId, code }: { roomId: string; code: string }) => {
      if (typeof code !== "string" || !socket.rooms.has(roomId)) return;

      socket.to(roomId).emit("code:change", code);
      scheduleCodeSave(roomId, code);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
      if (socket.data.roomId) {
        removeFromRoom(io, socket, socket.data.roomId);
      }
    });
  });
}