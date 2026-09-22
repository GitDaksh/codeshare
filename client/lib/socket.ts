"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { OnlineUser, RemoteCursorEvent, TypingEvent } from "@/types/presence";
import type { ChatMessage } from "@/types/chat";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

type CodeChangePayload = {
  code: string;
  cursor: RemoteCursorEvent | null;
};

export function useSocket(
  roomId: string,
  onChatMessage?: (message: ChatMessage) => void,
  onCodeChange?: (code: string, cursor: RemoteCursorEvent | null) => void,
  onCursorMove?: (cursor: RemoteCursorEvent) => void,
  onTyping?: (event: TypingEvent) => void
) {
  const { getToken } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const onChatMessageRef = useRef(onChatMessage);
  const onCodeChangeRef = useRef(onCodeChange);
  const onCursorMoveRef = useRef(onCursorMove);
  const onTypingRef = useRef(onTyping);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    onChatMessageRef.current = onChatMessage;
  }, [onChatMessage]);

  useEffect(() => {
    onCodeChangeRef.current = onCodeChange;
  }, [onCodeChange]);

  useEffect(() => {
    onCursorMoveRef.current = onCursorMove;
  }, [onCursorMove]);

  useEffect(() => {
    onTypingRef.current = onTyping;
  }, [onTyping]);

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
        onChatMessageRef.current?.(message);
      });

      socket.on("code:change", (payload: CodeChangePayload) => {
        onCodeChangeRef.current?.(payload.code, payload.cursor);
      });

      socket.on("cursor:move", (cursor: RemoteCursorEvent) => {
        onCursorMoveRef.current?.(cursor);
      });

      socket.on("typing", (event: TypingEvent) => {
        onTypingRef.current?.(event);
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

  function sendCodeChange(code: string, line: number, column: number) {
    socketRef.current?.emit("code:change", { roomId, code, line, column });
  }

  function sendCursorMove(line: number, column: number) {
    socketRef.current?.emit("cursor:move", { roomId, line, column });
  }

  function sendTyping(isTyping: boolean) {
    socketRef.current?.emit("typing", { roomId, isTyping });
  }

  return { status, onlineUsers, sendMessage, sendCodeChange, sendCursorMove, sendTyping };
}