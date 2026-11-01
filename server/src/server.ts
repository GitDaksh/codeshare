import dotenv from "dotenv";
import mongoose from "mongoose";
import { allowedOriginsFrom, createApp } from "./app";
import { connectDB } from "./config/db";
import { flushAllPendingCodeSaves } from "./sockets";
import { prepareRooms } from "./lib/access";
import { prepareInterviews } from "./lib/interviews";

dotenv.config();

const allowedOrigins = allowedOriginsFrom(process.env.CLIENT_URL);
const { httpServer, io } = createApp({ allowedOrigins });

const PORT = process.env.PORT || 5001;

// The most a shutdown may take. Render waits about 30 seconds before it
// kills the old server, so a stuck save or connection can't hold it longer.
const SHUTDOWN_DEADLINE_MS = 10_000;
let shuttingDown = false;

// On a deploy (SIGTERM) or Ctrl+C (SIGINT): stop taking connections, save the
// edits still waiting on their debounce timer, close the database, then exit.
// Browsers reconnect to the new server on their own and sync what they have.
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received: shutting down (saving pending code first)...`);

  setTimeout(() => {
    console.error(`Shutdown took longer than ${SHUTDOWN_DEADLINE_MS / 1000}s; exiting anyway.`);
    process.exit(1);
  }, SHUTDOWN_DEADLINE_MS).unref();

  try {
    // Disconnects every socket and stops new connections; rooms that empty
    // out start saving as their last socket leaves. Not awaited: the HTTP
    // server only finishes closing once every client has hung up, and a
    // client that stopped answering (a laptop asleep) can take 30 seconds.
    // The saves below don't depend on it.
    void io.close();
    await flushAllPendingCodeSaves();
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error while shutting down:", err);
    process.exit(1);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

async function start() {
  const connected = await connectDB();
  if (!connected) {
    process.exitCode = 1;
    return;
  }
  try {
    await prepareRooms();
  } catch (err) {
    console.error("Failed to prepare invite links for existing rooms:", err);
  }
  try {
    await prepareInterviews();
  } catch (err) {
    console.error("Failed to move interviews to the multi-question format:", err);
  }
  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Allowed origins: ${allowedOrigins.join(", ") || "(none set)"}`);
  });
}

start();
