import type { Server, Socket } from "socket.io";
import { verifyToken } from "@clerk/backend";

type PresenceUser = {
  socketId: string;
  userId: string;
  name: string;
};

const roomPresence = new Map<string, Map<string, PresenceUser>>();

function broadcastPresence(io: Server, roomId: string) {
  const room = roomPresence.get(roomId);
  const users = room ? Array.from(room.values()) : [];
  io.to(roomId).emit("presence:update", users);
}

function removeFromRoom(io: Server, socket: Socket, roomId: string) {
  const room = roomPresence.get(roomId);
  if (!room) return;

  room.delete(socket.id);
  if (room.size === 0) {
    roomPresence.delete(roomId);
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

      if (!roomPresence.has(roomId)) {
        roomPresence.set(roomId, new Map());
      }

      roomPresence.get(roomId)!.set(socket.id, {
        socketId: socket.id,
        userId: socket.data.userId,
        name: name || "Anonymous",
      });

      broadcastPresence(io, roomId);
      console.log(`User ${socket.data.userId} joined room ${roomId}`);
    });

    socket.on("room:leave", (roomId: string) => {
      socket.leave(roomId);
      removeFromRoom(io, socket, roomId);
      console.log(`User ${socket.data.userId} left room ${roomId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
      if (socket.data.roomId) {
        removeFromRoom(io, socket, socket.data.roomId);
      }
    });
  });
}