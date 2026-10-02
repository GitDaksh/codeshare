import type { Server, Socket } from "socket.io";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import * as decoding from "lib0/decoding";
import { Room } from "../models/Room";

// Conflict-free editing with Yjs. Each open room has one shared document in
// memory here. People send their edits as small Yjs updates; the server
// merges them into the document and passes them on, so edits made at the same
// moment are combined instead of one overwriting the other.
//
// Two things are saved: the plain text (everything else reads Room.code) and
// the document's Yjs state, so people who reconnect after a restart merge
// into the same history instead of duplicating the text.

const SAVE_DEBOUNCE_MS = 1500;
// Saved at least this often while people keep typing.
const SAVE_AT_LEAST_EVERY_MS = 10_000;
// The same limit as a room's starting code.
const MAX_CODE_CHARS = 100_000;
const MAX_UPDATE_BYTES = 512 * 1024;
const MAX_AWARENESS_BYTES = 16 * 1024;
// Cursors one connection can show.
const MAX_CURSORS_PER_CONNECTION = 4;

export type Identity = { userId: string; name: string; avatarId: string };

type SharedRoom = {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  // The awareness (cursor) ids each connection speaks for.
  owners: Map<string, Set<number>>;
  saveTimer: NodeJS.Timeout | null;
  dirtySince: number | null;
};

type AwarenessChanges = { added: number[]; updated: number[]; removed: number[] };

const shared = new Map<string, Promise<SharedRoom>>();
const closing = new Map<string, Promise<void>>();

function bytesOf(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return null;
}

async function save(roomId: string, room: SharedRoom): Promise<void> {
  if (room.saveTimer) clearTimeout(room.saveTimer);
  room.saveTimer = null;
  room.dirtySince = null;
  try {
    await Room.updateOne(
      { _id: roomId },
      { code: room.doc.getText("code").toString(), yState: Buffer.from(Y.encodeStateAsUpdate(room.doc)) },
    );
  } catch (err) {
    room.dirtySince = Date.now();
    console.error(`Failed to save code for room ${roomId}:`, err);
  }
}

function scheduleSave(roomId: string, room: SharedRoom) {
  const now = Date.now();
  room.dirtySince ??= now;
  if (room.saveTimer) clearTimeout(room.saveTimer);
  const wait = Math.max(0, Math.min(SAVE_DEBOUNCE_MS, room.dirtySince + SAVE_AT_LEAST_EVERY_MS - now));
  room.saveTimer = setTimeout(() => void save(roomId, room), wait);
}

// The room's shared document, loaded once and kept while anyone is in it.
function openShared(roomId: string): Promise<SharedRoom> {
  let pending = shared.get(roomId);
  if (pending) return pending;
  pending = (async () => {
    // A room that was just closed finishes saving first.
    await closing.get(roomId);
    const room = await Room.findById(roomId).select("+yState");
    if (!room) throw new Error("Room not found");
    const doc = new Y.Doc();
    const entry: SharedRoom = {
      doc,
      awareness: new awarenessProtocol.Awareness(doc),
      owners: new Map(),
      saveTimer: null,
      dirtySince: null,
    };
    // The server has no cursor of its own.
    entry.awareness.setLocalState(null);
    entry.awareness.on("update", ({ added, updated, removed }: AwarenessChanges, origin: unknown) => {
      if (typeof origin !== "string") return;
      const ids = entry.owners.get(origin) ?? new Set<number>();
      for (const id of [...added, ...updated]) ids.add(id);
      for (const id of removed) ids.delete(id);
      entry.owners.set(origin, ids);
    });
    if (room.yState?.length) {
      Y.applyUpdate(doc, room.yState);
    } else {
      // A room from before shared editing (or a new one): its history starts
      // here, and is saved right away so every later load shares it. Line
      // endings are always \n (editors convert \r\n, which would make their
      // copy of the text drift from the shared one).
      if (room.code) doc.getText("code").insert(0, room.code.replace(/\r\n?/g, "\n"));
      await save(roomId, entry);
    }
    return entry;
  })();
  shared.set(roomId, pending);
  pending.catch(() => shared.delete(roomId));
  return pending;
}

// What an update adds: text in the room's code only, and how many characters.
// null for anything else (other shared types, maps, binary data).
function textAdded(update: Uint8Array): number | null {
  let added = 0;
  for (const struct of Y.decodeUpdate(update).structs) {
    if (!(struct instanceof Y.Item)) continue;
    if (struct.parentSub !== null) return null;
    // At runtime a root-level item's parent is its type's name ("code"), or
    // null when it follows other text (Yjs's typings don't include strings).
    const parent = struct.parent as unknown;
    if (parent !== null && parent !== "code") return null;
    if (struct.content instanceof Y.ContentString) {
      if (struct.content.str.includes("\r")) return null;
      added += struct.content.str.length;
    } else if (!(struct.content instanceof Y.ContentDeleted)) {
      return null;
    }
  }
  return added;
}

// The room's code right now: the live document while anyone's in the room,
// otherwise what was last saved.
export async function currentCode(roomId: string): Promise<string> {
  const live = shared.get(roomId);
  if (live) {
    try {
      return (await live).doc.getText("code").toString();
    } catch {
      // Fall back to the saved copy.
    }
  }
  const room = await Room.findById(roomId, { code: 1 }).lean();
  return room?.code ?? "";
}

// Someone (re)joined: send what they're missing, plus everyone's cursors.
// They reply with what the server is missing (edits made while offline).
export async function helloShared(socket: Socket, roomId: string, stateVector: unknown): Promise<void> {
  const room = await openShared(roomId);
  let update: Uint8Array;
  try {
    update = Y.encodeStateAsUpdate(room.doc, bytesOf(stateVector) ?? undefined);
  } catch {
    update = Y.encodeStateAsUpdate(room.doc);
  }
  const cursors = [...room.awareness.getStates().keys()];
  socket.emit("collab:sync", {
    roomId,
    update,
    stateVector: Y.encodeStateVector(room.doc),
    awareness: cursors.length ? awarenessProtocol.encodeAwarenessUpdate(room.awareness, cursors) : null,
  });
}

// An edit. "rejected" when it would take the code past the size limit (the
// sender then goes back to the shared version), "ignored" for anything that
// isn't a valid edit of the code.
export async function updateShared(socket: Socket, roomId: string, value: unknown): Promise<"ok" | "rejected" | "ignored"> {
  const update = bytesOf(value);
  if (!update || update.length === 0 || update.length > MAX_UPDATE_BYTES) return "ignored";
  const room = await openShared(roomId);

  let added: number | null;
  try {
    added = textAdded(update);
  } catch {
    return "ignored";
  }
  if (added === null) return "ignored";

  const code = room.doc.getText("code");
  if (code.length + added > MAX_CODE_CHARS) {
    // It may also delete text: try it on a copy to be sure.
    const probe = new Y.Doc();
    try {
      Y.applyUpdate(probe, Y.encodeStateAsUpdate(room.doc));
      Y.applyUpdate(probe, update);
      if (probe.getText("code").length > MAX_CODE_CHARS) return "rejected";
    } catch {
      return "ignored";
    } finally {
      probe.destroy();
    }
  }

  try {
    Y.applyUpdate(room.doc, update, socket.id);
  } catch {
    return "ignored";
  }
  socket.to(roomId).emit("collab:update", { roomId, update });
  scheduleSave(roomId, room);
  return "ok";
}

function awarenessIds(update: Uint8Array): number[] {
  const decoder = decoding.createDecoder(update);
  const ids: number[] = [];
  const count = decoding.readVarUint(decoder);
  for (let i = 0; i < count; i++) {
    ids.push(decoding.readVarUint(decoder));
    decoding.readVarUint(decoder);
    decoding.readVarString(decoder);
  }
  return ids;
}

// A cursor or selection moved. The sender's real name and avatar are stamped
// on by the server, so nobody can show a cursor under someone else's name.
export async function awarenessShared(socket: Socket, roomId: string, value: unknown, identity: Identity) {
  const update = bytesOf(value);
  if (!update || update.length > MAX_AWARENESS_BYTES) return;
  const room = await openShared(roomId);

  let ids: number[];
  try {
    ids = awarenessIds(update);
  } catch {
    return;
  }
  const mine = room.owners.get(socket.id) ?? new Set<number>();
  for (const id of ids) {
    if (mine.has(id)) continue;
    // Someone else's cursor.
    for (const [owner, theirs] of room.owners) if (owner !== socket.id && theirs.has(id)) return;
  }
  if (new Set([...mine, ...ids]).size > MAX_CURSORS_PER_CONNECTION) return;

  try {
    awarenessProtocol.applyAwarenessUpdate(room.awareness, update, socket.id);
  } catch {
    return;
  }
  const states = room.awareness.getStates();
  for (const id of ids) {
    const state = states.get(id);
    if (state) state.user = identity;
  }
  socket.to(roomId).emit("collab:awareness", {
    roomId,
    update: awarenessProtocol.encodeAwarenessUpdate(room.awareness, ids),
  });
}

// A connection left the room: its cursors disappear for everyone.
export function leaveShared(io: Server, socket: Socket, roomId: string) {
  const pending = shared.get(roomId);
  if (!pending) return;
  pending
    .then((room) => {
      const ids = [...(room.owners.get(socket.id) ?? [])];
      room.owners.delete(socket.id);
      if (!ids.length) return;
      awarenessProtocol.removeAwarenessStates(room.awareness, ids, null);
      io.to(roomId).emit("collab:awareness", {
        roomId,
        update: awarenessProtocol.encodeAwarenessUpdate(room.awareness, ids),
      });
    })
    .catch(() => {});
}

// Everyone left: save and free the room's document.
export function closeShared(roomId: string): Promise<void> {
  const pending = shared.get(roomId);
  if (!pending) return Promise.resolve();
  shared.delete(roomId);
  const done = (async () => {
    const room = await pending.catch(() => null);
    if (!room) return;
    if (room.dirtySince !== null) await save(roomId, room);
    room.awareness.destroy();
    room.doc.destroy();
  })();
  closing.set(roomId, done);
  void done.finally(() => {
    if (closing.get(roomId) === done) closing.delete(roomId);
  });
  return done;
}

// Shutdown: save every room with unsaved edits.
export async function flushShared(): Promise<void> {
  await Promise.all(
    [...shared.entries()].map(async ([roomId, pending]) => {
      const room = await pending.catch(() => null);
      if (room && room.dirtySince !== null) await save(roomId, room);
    }),
  );
  await Promise.all(closing.values());
}