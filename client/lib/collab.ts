"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Socket } from "socket.io-client";
import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";

// Conflict-free shared editing with Yjs (the server side is
// server/src/sockets/collab.ts).
//
// Every browser in a room keeps a copy of the room's document. Your edits
// become small Yjs updates that the server merges and passes on, so edits
// made at the same moment are combined instead of one overwriting the other.
// Joining (or reconnecting) starts with a handshake in which each side sends
// only what the other is missing, so edits made while offline merge in too.

// Marks changes that came from the server (they aren't sent back).
const REMOTE = Symbol("remote");

type AwarenessChanges = { added: number[]; updated: number[]; removed: number[] };

const toBytes = (value: unknown): Uint8Array =>
  value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBuffer);

export type CollabSnapshot = {
  // The document has been synced with the room at least once.
  synced: boolean;
  // Bumped whenever the document or the cursor set is replaced.
  generation: number;
  // How many of your edits were refused for making the code too long.
  refused: number;
};

export class CollabSession {
  doc: Y.Doc;
  text: Y.Text;
  // Undo and redo for this browser's own edits only.
  undo: Y.UndoManager;
  // Everyone's cursors and selections (exists while connected).
  awareness: Awareness | null = null;
  // The origin of this browser's own edits.
  readonly local = { editor: true };

  private socket: Socket | null = null;
  private snapshot: CollabSnapshot = { synced: false, generation: 0, refused: 0 };
  private listeners = new Set<() => void>();
  private resyncTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly roomId: string) {
    this.doc = new Y.Doc();
    this.text = this.doc.getText("code");
    this.undo = new Y.UndoManager(this.text, { trackedOrigins: new Set([this.local]) });
    this.doc.on("update", this.onLocalUpdate);
  }

  // For React's useSyncExternalStore.
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  private publish(next: Partial<CollabSnapshot>) {
    this.snapshot = { ...this.snapshot, ...next };
    for (const listener of this.listeners) listener();
  }

  attach(socket: Socket) {
    this.detach();
    this.socket = socket;
    this.awareness = new Awareness(this.doc);
    this.awareness.on("update", this.onLocalAwareness);
    socket.on("room:joined", this.onJoined);
    socket.on("collab:sync", this.onSync);
    socket.on("collab:update", this.onRemoteUpdate);
    socket.on("collab:awareness", this.onRemoteAwareness);
    socket.on("collab:rejected", this.onRejectedEvent);
    socket.on("disconnect", this.onDisconnect);
    this.publish({ generation: this.snapshot.generation + 1 });
    // The room may have been joined already.
    if (socket.connected) this.hello();
  }

  detach() {
    const socket = this.socket;
    if (!socket) return;
    socket.off("room:joined", this.onJoined);
    socket.off("collab:sync", this.onSync);
    socket.off("collab:update", this.onRemoteUpdate);
    socket.off("collab:awareness", this.onRemoteAwareness);
    socket.off("collab:rejected", this.onRejectedEvent);
    socket.off("disconnect", this.onDisconnect);
    this.socket = null;
    if (this.resyncTimer) clearTimeout(this.resyncTimer);
    this.resyncTimer = null;
    this.awareness?.off("update", this.onLocalAwareness);
    this.awareness?.destroy();
    this.awareness = null;
  }

  private hello = () => {
    this.socket?.emit("collab:hello", { roomId: this.roomId, stateVector: Y.encodeStateVector(this.doc) });
  };

  private onJoined = (data: { roomId: string }) => {
    if (data.roomId === this.roomId) this.hello();
  };

  private onSync = (data: { roomId: string; update: unknown; stateVector: unknown; awareness: unknown }) => {
    if (data.roomId !== this.roomId) return;
    Y.applyUpdate(this.doc, toBytes(data.update), REMOTE);
    // Send what the server is missing (edits made while offline).
    const missing = Y.encodeStateAsUpdate(this.doc, toBytes(data.stateVector));
    if (missing.length > 2) this.socket?.emit("collab:update", { roomId: this.roomId, update: missing });
    if (data.awareness && this.awareness) applyAwarenessUpdate(this.awareness, toBytes(data.awareness), REMOTE);
    if (!this.snapshot.synced) this.publish({ synced: true });
    // Share this cursor again (the server forgets it on reconnect).
    if (this.awareness?.getLocalState()) this.sendAwareness([this.doc.clientID]);
  };

  private onLocalUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE || !this.snapshot.synced || !this.socket?.connected) return;
    this.socket.emit("collab:update", { roomId: this.roomId, update });
  };

  private onRemoteUpdate = (data: { roomId: string; update: unknown }) => {
    if (data.roomId === this.roomId) Y.applyUpdate(this.doc, toBytes(data.update), REMOTE);
  };

  private onLocalAwareness = ({ added, updated, removed }: AwarenessChanges, origin: unknown) => {
    if (origin === "local") this.sendAwareness([...added, ...updated, ...removed]);
  };

  private sendAwareness(ids: number[]) {
    if (!this.awareness || !ids.length || !this.snapshot.synced || !this.socket?.connected) return;
    this.socket.emit("collab:awareness", { roomId: this.roomId, update: encodeAwarenessUpdate(this.awareness, ids) });
  }

  private onRemoteAwareness = (data: { roomId: string; update: unknown }) => {
    if (data.roomId === this.roomId && this.awareness) {
      applyAwarenessUpdate(this.awareness, toBytes(data.update), REMOTE);
    }
  };

  private onRejectedEvent = (data: { roomId: string; reason: string }) => {
    if (data.roomId !== this.roomId) return;
    if (data.reason === "too-long") {
      // The refused edit can't be kept: start over from the room's document.
      this.replaceDoc();
      this.publish({ synced: false, generation: this.snapshot.generation + 1, refused: this.snapshot.refused + 1 });
      this.hello();
      return;
    }
    // Busy: sync again once it calms down (every edit is sent again).
    if (!this.resyncTimer) {
      this.resyncTimer = setTimeout(() => {
        this.resyncTimer = null;
        this.hello();
      }, 300);
    }
  };

  private onDisconnect = () => {
    // Other people's cursors are out of date until we're back.
    if (!this.awareness) return;
    const others = [...this.awareness.getStates().keys()].filter((id) => id !== this.doc.clientID);
    removeAwarenessStates(this.awareness, others, REMOTE);
  };

  private replaceDoc() {
    // The new document gets a new id, so clear this cursor for everyone first
    // (otherwise teammates would see a leftover cursor for a while).
    this.awareness?.setLocalState(null);
    this.doc.off("update", this.onLocalUpdate);
    this.undo.destroy();
    this.doc.destroy();
    this.doc = new Y.Doc();
    this.text = this.doc.getText("code");
    this.undo = new Y.UndoManager(this.text, { trackedOrigins: new Set([this.local]) });
    this.doc.on("update", this.onLocalUpdate);
    if (this.awareness) {
      this.awareness.off("update", this.onLocalAwareness);
      this.awareness.destroy();
      this.awareness = new Awareness(this.doc);
      this.awareness.on("update", this.onLocalAwareness);
    }
  }
}

// The room's shared document, kept in step over the room's socket.
// onRefused is called when an edit was refused (the code would be too long).
export function useCollab(socket: Socket | null, roomId: string, onRefused: () => void) {
  const [session] = useState(() => new CollabSession(roomId));
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);

  const reportedRef = useRef(0);
  useEffect(() => {
    if (snapshot.refused <= reportedRef.current) return;
    reportedRef.current = snapshot.refused;
    onRefused();
  }, [snapshot.refused, onRefused]);

  useEffect(() => {
    if (!socket) return;
    session.attach(socket);
    return () => session.detach();
  }, [session, socket]);

  return { session, synced: snapshot.synced, generation: snapshot.generation };
}