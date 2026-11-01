// Shared setup for the integration tests: a real test database, the real app
// on a random port, and Socket.IO clients signed in as test users.
import type { AddressInfo } from "node:net";
import mongoose from "mongoose";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import request from "supertest";
import * as Y from "yjs";
import { createApp } from "../src/app";
import { flushAllPendingCodeSaves } from "../src/sockets";

export const TEST_MONGODB_URI = process.env.TEST_MONGODB_URI ?? "mongodb://127.0.0.1:27017/codeshare-test";

export async function connectTestDb() {
  await mongoose.connect(TEST_MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
}

export async function clearTestDb() {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

export async function disconnectTestDb() {
  await mongoose.disconnect();
}

// Every test gets its own user names, so per-user rate limits never carry
// over from one test to the next.
let counter = 0;
export function users<const T extends string[]>(...names: T): { [K in keyof T]: string } {
  counter += 1;
  return names.map((name) => `${name}${counter}`) as { [K in keyof T]: string };
}

export function bearer(user: string) {
  return { Authorization: `Bearer test:${user}` };
}

export type TestServer = Awaited<ReturnType<typeof startServer>>;

export async function startServer() {
  const { app, httpServer, io } = createApp({ allowedOrigins: [], logRequests: false });
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = httpServer.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;
  const clients: ClientSocket[] = [];
  return {
    app,
    io,
    url,
    api: () => request(app),
    // A connected socket for this user (or an error for a bad token).
    async connect(user: string | null, token = user ? `test:${user}` : undefined): Promise<ClientSocket> {
      const socket = ioClient(url, { auth: token ? { token } : {}, transports: ["websocket"], reconnection: false, forceNew: true });
      clients.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", () => resolve());
        socket.once("connect_error", (err) => reject(err));
      });
      return socket;
    },
    async close() {
      for (const socket of clients) socket.disconnect();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      // Rooms save their code when the last person leaves; let that finish
      // before the database connection closes.
      await flushAllPendingCodeSaves();
    },
  };
}

export type CreatedRoom = { _id: string; name: string; language: string; role: string; invites: { edit: string; view: string } };

// A new room owned by `owner`, made through the API like the app does.
export async function createRoom(
  server: TestServer,
  owner: string,
  body: Record<string, unknown> = { name: "Graphs", language: "python" },
): Promise<CreatedRoom> {
  const res = await server.api().post("/api/rooms").set(bearer(owner)).send(body);
  if (res.status !== 201) throw new Error(`creating a room failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as CreatedRoom;
}

// An edit that types `text` at the start of the room's code, as a browser
// would send it.
export function typed(text: string): Uint8Array {
  const doc = new Y.Doc();
  doc.getText("code").insert(0, text);
  const update = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return update;
}

// The room's code as the server holds it (asks with collab:hello, like a
// browser that just joined). Also handy as a barrier: everything this socket
// sent before has been handled once the answer arrives.
export async function sharedCode(socket: ClientSocket, roomId: string): Promise<string> {
  const sync = eventWhere<{ roomId: string; update: Uint8Array }>(socket, "collab:sync", (payload) => payload.roomId === roomId);
  socket.emit("collab:hello", { roomId });
  const { update } = await sync;
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(update));
  const code = doc.getText("code").toString();
  doc.destroy();
  return code;
}

// Retries `check` until it passes (for things saved a moment later).
export async function eventually(check: () => Promise<void> | void, ms = 3000): Promise<void> {
  const started = Date.now();
  for (;;) {
    try {
      await check();
      return;
    } catch (err) {
      if (Date.now() - started > ms) throw err;
      await pause(50);
    }
  }
}

// The next `event` on this socket (fails after `ms`).
export function nextEvent<T = unknown>(socket: ClientSocket, event: string, ms = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`no "${event}" within ${ms}ms`));
    }, ms);
    function handler(payload: T) {
      clearTimeout(timer);
      resolve(payload);
    }
    socket.once(event, handler);
  });
}

// Waits for an event that matches, skipping others of the same name.
export function eventWhere<T = unknown>(socket: ClientSocket, event: string, match: (payload: T) => boolean, ms = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`no matching "${event}" within ${ms}ms`));
    }, ms);
    function handler(payload: T) {
      if (!match(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }
    socket.on(event, handler);
  });
}

// Collects every `event` this socket receives from now on.
export function collect<T = unknown>(socket: ClientSocket, event: string): T[] {
  const seen: T[] = [];
  socket.on(event, (payload: T) => seen.push(payload));
  return seen;
}

export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Joins a room and resolves with the role the server gave this socket.
export async function joinRoom(socket: ClientSocket, roomId: string, invite?: string): Promise<string> {
  const joined = nextEvent<{ roomId: string; role: string }>(socket, "room:joined");
  socket.emit("room:join", { roomId, invite });
  return (await joined).role;
}
