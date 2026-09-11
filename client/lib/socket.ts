"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { OnlineUser } from "@/types/presence";
import type { ChatMessage } from "@/types/chat";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function useSocket(
  roomId: string,
  onChatMessage?: (message: ChatMessage) => void,
  onCodeChange?: (code: string) => void
) {
  const { getToken } = useAuth();
  const { user, isLoaded } = useUser();
  const socketRef = useRef<Socket | null>(null);
  const onChatMessageRef = useRef(onChatMessage);
  const onCodeChangeRef = useRef(onCodeChange);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    onChatMessageRef.current = onChatMessage;
  }, [onChatMessage]);

  useEffect(() => {
    onCodeChangeRef.current = onCodeChange;
  }, [onCodeChange]);

  useEffect(() => {
    if (!isLoaded) return;

    let cancelled = false;
    let socket: Socket;

    async function connect() {
      const token = await getToken();

      if (cancelled) return;

      const displayName = user?.fullName || user?.username || "Anonymous";

      socket = io(process.env.NEXT_PUBLIC_API_URL!, {
        auth: { token },
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        setStatus("connected");
        socket.emit("room:join", { roomId, name: displayName });
      });

      socket.on("presence:update", (users: OnlineUser[]) => {
        setOnlineUsers(users);
      });

      socket.on("chat:message", (message: ChatMessage) => {
        onChatMessageRef.current?.(message);
      });

      socket.on("code:change", (code: string) => {
        onCodeChangeRef.current?.(code);
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
  }, [roomId, getToken, isLoaded, user?.id]);

  function sendMessage(text: string) {
    socketRef.current?.emit("chat:message", { roomId, text });
  }

  function sendCodeChange(code: string) {
    socketRef.current?.emit("code:change", { roomId, code });
  }

  return { status, onlineUsers, sendMessage, sendCodeChange };
}