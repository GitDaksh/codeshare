import type { Server, Socket } from "socket.io";
import { verifyToken } from "@clerk/backend";

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

    socket.on("room:join", (roomId: string) => {
      socket.join(roomId);
      console.log(`User ${socket.data.userId} joined room ${roomId}`);
    });

    socket.on("room:leave", (roomId: string) => {
      socket.leave(roomId);
      console.log(`User ${socket.data.userId} left room ${roomId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}