import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import { clerkMiddleware } from "@clerk/express";
import roomRoutes from "./routes/roomRoutes";
import profileRoutes from "./routes/profileRoutes";
import interviewRoutes from "./routes/interviewRoutes";
import gameRoutes from "./routes/gameRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { setupSocket } from "./sockets";

// CLIENT_URL can hold several comma-separated website addresses, so the API
// accepts requests from all of them (the custom domain, its www version, and
// the old vercel.app address). Trailing slashes are stripped, because a
// browser's Origin header never has one, and a mismatch silently fails CORS.
export function allowedOriginsFrom(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

// The whole API: the Express app, the HTTP server it runs on, and the
// Socket.IO server sharing that port. server.ts starts it; the tests build
// their own copy.
export function createApp(options: { allowedOrigins: string[]; logRequests?: boolean }) {
  const { allowedOrigins, logRequests = true } = options;

  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  app.use(helmet());
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  // Room code can be up to 100,000 characters.
  app.use(express.json({ limit: "512kb" }));
  if (logRequests) app.use(morgan("dev"));
  app.use(clerkMiddleware());

  app.get("/", (_req, res) => {
    res.json({ status: "ok", message: "CodeShare API is running" });
  });

  // For uptime monitors: is the server up, and can it reach the database?
  // Cheap (no query), so it can be called every few minutes.
  app.get("/health", (_req, res) => {
    const database = mongoose.connection.readyState === 1 ? "up" : "down";
    res.status(database === "up" ? 200 : 503).json({
      status: database === "up" ? "ok" : "degraded",
      database,
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  app.use("/api/rooms", roomRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/interviews", interviewRoutes);
  app.use("/api/games", gameRoutes);

  app.use(errorHandler);

  setupSocket(io);

  return { app, httpServer, io };
}
