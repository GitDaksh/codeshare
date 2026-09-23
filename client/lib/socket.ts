"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { OnlineUser, RemoteCursorEvent, TypingEvent } from "@/types/presence";
import type { ChatMessage, Reaction } from "@/types/chat";
import type { LanguageUpdateEvent, RunResultEvent, RunStartEvent } from "@/types/roomEvents";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

type CodeChangePayload = {
  code: string;
  cursor: RemoteCursorEvent | null;
};

export type ReactionUpdate = {
  messageId: string;
  reactions: Reaction[];
};

export type SocketHandlers = {
  onChatMessage?: (message: ChatMessage) => void;
  onCodeChange?: (code: string, cursor: RemoteCursorEvent | null) => void;
  onCursorMove?: (cursor: RemoteCursorEvent) => void;
  onTyping?: (event: TypingEvent) => void;
  onReactionUpdate?: (update: ReactionUpdate) => void;
  onLanguageUpdate?: (event: LanguageUpdateEvent) => void;
  onRunStart?: (event: RunStartEvent) => void;
  onRunResult?: (event: RunResultEvent) => void;
};

export function useSocket(roomId: string, handlers: SocketHandlers) {
  const { getToken } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

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

      socket.on("connect", () => {
        setStatus("connected");
        socket.emit("room:join", { roomId });
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

      socket.on("code:change", (payload: CodeChangePayload) => {
        handlersRef.current.onCodeChange?.(payload.code, payload.cursor);
      });

      socket.on("cursor:move", (cursor: RemoteCursorEvent) => {
        handlersRef.current.onCursorMove?.(cursor);
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
  }, [roomId, getToken]);

  function sendMessage(text: string) {
    socketRef.current?.emit("chat:message", { roomId, text });
  }

  function sendReaction(messageId: string, emoji: string) {
    socketRef.current?.emit("reaction:toggle", { roomId, messageId, emoji });
  }

  function sendCodeChange(code: string, line: number, column: number) {
    socketRef.current?.emit("code:change", { roomId, code, line, column });
  }

  function sendCursorMove(line: number, column: number) {
    socketRef.current?.emit("cursor:move", { roomId, line, column });
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

  return {
    status,
    onlineUsers,
    sendMessage,
    sendReaction,
    sendCodeChange,
    sendCursorMove,
    sendTyping,
    sendLanguageChange,
    sendRunStart,
    sendRunResult,
  };
}