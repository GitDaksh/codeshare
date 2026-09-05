"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function useSocket(roomId: string) {
  const { getToken } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  useEffect(() => {
    let socket: Socket;

    async function connect() {
      const token = await getToken();

      if (!token) {
        console.error("useSocket: getToken() returned no token — user may not be signed in yet");
      }

      socket = io(process.env.NEXT_PUBLIC_API_URL!, {
        auth: { token },
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        setStatus("connected");
        socket.emit("room:join", roomId);
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
  }, [roomId, getToken]);

  return { status };
}