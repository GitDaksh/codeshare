import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { clerkMiddleware } from "@clerk/express";
import { connectDB } from "./config/db";
import roomRoutes from "./routes/roomRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { setupSocket, flushAllPendingCodeSaves } from "./sockets";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  },
});

const PORT = process.env.PORT || 5001;

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));
app.use(clerkMiddleware());

app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "CodeShare API is running" });
});

app.use("/api/rooms", roomRoutes);

app.use(errorHandler);

setupSocket(io);

async function shutdown() {
  console.log("Shutting down — flushing pending code saves...");
  await flushAllPendingCodeSaves();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function start() {
  await connectDB();
  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();