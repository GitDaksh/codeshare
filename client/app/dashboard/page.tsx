"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useApi } from "@/lib/api";
import type { Room } from "@/types/room";

export default function DashboardPage() {
  const { userId } = useAuth();
  const api = useApi();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<Room[]>("/api/rooms")
      .then((res) => setRooms(res.data))
      .catch(() => setError("Could not load your rooms."))
      .finally(() => setLoading(false));
  }, [api]);

  async function handleCreateRoom() {
    try {
      const res = await api.post<Room>("/api/rooms", {
        name: `Untitled room ${rooms.length + 1}`,
        language: "javascript",
      });
      setRooms([res.data, ...rooms]);
    } catch {
      setError("Could not create the room.");
    }
  }

  async function handleDeleteRoom(id: string) {
    try {
      await api.delete(`/api/rooms/${id}`);
      setRooms(rooms.filter((room) => room._id !== id));
    } catch {
      setError("Could not delete the room.");
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your rooms</h1>
        <button
          onClick={handleCreateRoom}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-200"
        >
          + New room
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading your rooms…</p>
      ) : rooms.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No rooms yet — create one to get started.
        </p>
      ) : (
        <div className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
          {rooms.map((room) => (
            <div
              key={room._id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{room.name}</span>
                  <span className="rounded bg-neutral-900 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-xs text-neutral-500">
                    {room._id}
                  </span>
                  <span className="rounded border border-neutral-700 px-1.5 py-0.5 text-xs text-neutral-400">
                    {room.language}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">
                  updated {new Date(room.updatedAt).toLocaleString()}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/room/${room._id}`}
                  className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm transition-colors hover:border-neutral-500"
                >
                  Join
                </Link>
                {room.ownerId === userId && (
                  <button
                    onClick={() => handleDeleteRoom(room._id)}
                    className="rounded-md px-2 py-1.5 text-sm text-neutral-500 transition-colors hover:text-red-400"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}