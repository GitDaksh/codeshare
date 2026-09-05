"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { OnlineUser } from "@/types/presence";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function useSocket(roomId: string) {
  const { getToken } = useAuth();
  const { user, isLoaded } = useUser();
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    if (!isLoaded) return;

    let socket: Socket;

    async function connect() {
      const token = await getToken();
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

      socket.on("disconnect", () => setStatus("disconnected"));
      socket.on("connect_error", (err) => {
        console.error("Socket connection error:", err.message);
        setStatus("disconnected");
      });
    }

    connect();

    return () => {
      socket?.emit("room:leave", roomId);
      socket?.disconnect();
    };
  }, [roomId, getToken, isLoaded, user?.id]);

  return { status, onlineUsers };
}