"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { OnlineUser, TypingEvent } from "@/types/presence";
import type { ChatMessage, Reaction } from "@/types/chat";
import type { AccessRequest, RoomRole } from "@/types/room";
import type {
  LanguageUpdateEvent,
  LensDriverEvent,
  LensSessionEvent,
  LensStepEvent,
  LensStopEvent,
  RunResultEvent,
  RunStartEvent,
} from "@/types/roomEvents";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

export type ReactionUpdate = {
  messageId: string;
  reactions: Reaction[];
};

export type SocketHandlers = {
  onChatMessage?: (message: ChatMessage) => void;
  onTyping?: (event: TypingEvent) => void;
  onReactionUpdate?: (update: ReactionUpdate) => void;
  onLanguageUpdate?: (event: LanguageUpdateEvent) => void;
  onRunStart?: (event: RunStartEvent) => void;
  onRunResult?: (event: RunResultEvent) => void;
  onLensSession?: (event: LensSessionEvent) => void;
  onLensStep?: (event: LensStepEvent) => void;
  onLensDriver?: (event: LensDriverEvent) => void;
  onLensStop?: (event: LensStopEvent) => void;
  // The owner changed your role.
  onRole?: (role: RoomRole) => void;
  // The owner removed you from the room.
  onRemoved?: () => void;
  // Who's in the room (or its invite links) changed.
  onPeople?: () => void;
  // Owner: the viewers asking to edit.
  onAccessRequests?: (requests: AccessRequest[]) => void;
  // Viewer: your request was sent (and whether the owner is in the room).
  onAccessRequested?: (ownerHere: boolean) => void;
};

// "invite" is the code from an invite link (/room/<id>?invite=<code>): the
// server only lets people join a room they own, joined before, or were invited to.
export function useSocket(roomId: string, handlers: SocketHandlers, invite: string | null = null) {
  const { getToken } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  // The live connection, for shared editing (lib/collab.ts). Code and cursors
  // travel over it as Yjs updates.
  const [connection, setConnection] = useState<Socket | null>(null);

  // Always call the latest handlers without reconnecting the socket when
  // their identities change between renders.
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    let cancelled = false;
    let socket: Socket;

    async function connect() {
      let token: string | null;
      try {
        token = await getToken({ skipCache: true });
      } catch (err) {
        console.error("Failed to fetch auth token for socket connection:", err);
        setStatus("disconnected");
        return;
      }

      if (cancelled) return;

      socket = io(process.env.NEXT_PUBLIC_API_URL!, {
        auth: { token },
      });

      socketRef.current = socket;
      setConnection(socket);

      socket.on("connect", () => {
        setStatus("connected");
        socket.emit("room:join", { roomId, invite });
      });

      socket.on("presence:update", (users: OnlineUser[]) => {
        setOnlineUsers(users);
      });

      socket.on("chat:message", (message: ChatMessage) => {
        handlersRef.current.onChatMessage?.(message);
      });

      socket.on("reaction:update", (update: ReactionUpdate) => {
        handlersRef.current.onReactionUpdate?.(update);
      });

      socket.on("typing", (event: TypingEvent) => {
        handlersRef.current.onTyping?.(event);
      });

      socket.on("language:update", (event: LanguageUpdateEvent) => {
        handlersRef.current.onLanguageUpdate?.(event);
      });

      socket.on("run:start", (event: RunStartEvent) => {
        handlersRef.current.onRunStart?.(event);
      });

      socket.on("run:result", (event: RunResultEvent) => {
        handlersRef.current.onRunResult?.(event);
      });

      socket.on("lens:session", (event: LensSessionEvent) => {
        handlersRef.current.onLensSession?.(event);
      });

      socket.on("lens:step", (event: LensStepEvent) => {
        handlersRef.current.onLensStep?.(event);
      });

      socket.on("lens:driver", (event: LensDriverEvent) => {
        handlersRef.current.onLensDriver?.(event);
      });

      socket.on("lens:stop", (event: LensStopEvent) => {
        handlersRef.current.onLensStop?.(event);
      });

      socket.on("room:role", (event: { roomId: string; role: RoomRole }) => {
        if (event.roomId === roomId) handlersRef.current.onRole?.(event.role);
      });

      socket.on("room:removed", (event: { roomId: string }) => {
        if (event.roomId === roomId) handlersRef.current.onRemoved?.();
      });

      socket.on("room:people", (event: { roomId: string }) => {
        if (event.roomId === roomId) handlersRef.current.onPeople?.();
      });

      socket.on("access:requests", (event: { roomId: string; requests: AccessRequest[] }) => {
        if (event.roomId === roomId) handlersRef.current.onAccessRequests?.(event.requests ?? []);
      });

      socket.on("access:requested", (event: { roomId: string; ownerHere: boolean }) => {
        if (event.roomId === roomId) handlersRef.current.onAccessRequested?.(!!event.ownerHere);
      });

      socket.on("disconnect", () => setStatus("disconnected"));
      socket.on("connect_error", (err) => {
        console.error("Socket connection error:", err.message);
        setStatus("disconnected");
      });
    }

    connect();

    return () => {
      cancelled = true;
      socket?.emit("room:leave", roomId);
      socket?.disconnect();
    };
  }, [roomId, invite, getToken]);

  function sendMessage(text: string) {
    socketRef.current?.emit("chat:message", { roomId, text });
  }

  function sendReaction(messageId: string, emoji: string) {
    socketRef.current?.emit("reaction:toggle", { roomId, messageId, emoji });
  }

  function sendTyping(isTyping: boolean) {
    socketRef.current?.emit("typing", { roomId, isTyping });
  }

  function sendLanguageChange(language: string) {
    socketRef.current?.emit("language:change", { roomId, language });
  }

  function sendRunStart(language: string) {
    socketRef.current?.emit("run:start", { roomId, language });
  }

  function sendRunResult(
    language: string,
    result: { output: string; error: string | null; durationMs: number }
  ) {
    socketRef.current?.emit("run:result", { roomId, language, ...result });
  }

  function sendLensStart(session: { id: string; title: string; code: string; trace: Uint8Array }) {
    socketRef.current?.emit("lens:start", { roomId, ...session });
  }

  function sendLensStep(id: string, step: number) {
    socketRef.current?.emit("lens:step", { roomId, id, step });
  }

  function sendLensDrive(id: string, step: number) {
    socketRef.current?.emit("lens:drive", { roomId, id, step });
  }

  function sendLensStop(id: string) {
    socketRef.current?.emit("lens:stop", { roomId, id });
  }

  function sendAccessRequest() {
    socketRef.current?.emit("access:request", { roomId });
  }

  function sendAccessDismiss(userId: string) {
    socketRef.current?.emit("access:dismiss", { roomId, userId });
  }

  return {
    status,
    onlineUsers,
    socket: connection,
    sendMessage,
    sendReaction,
    sendTyping,
    sendLanguageChange,
    sendRunStart,
    sendRunResult,
    sendLensStart,
    sendLensStep,
    sendLensDrive,
    sendLensStop,
    sendAccessRequest,
    sendAccessDismiss,
  };
}