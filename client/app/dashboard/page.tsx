"use client";

import { useState } from "react";
import Link from "next/link";
import type { Room } from "@/types/room";

const initialRooms: Room[] = [
  {
    id: "a3f9c1",
    name: "Interview prep",
    participants: 2,
    updatedAt: "2 hours ago",
    ownedByMe: true,
  },
  {
    id: "b7d2e8",
    name: "Algo study group",
    participants: 4,
    updatedAt: "yesterday",
    ownedByMe: false,
  },
  {
    id: "c4a0f5",
    name: "React refactor",
    participants: 1,
    updatedAt: "3 days ago",
    ownedByMe: true,
  },
];

export default function DashboardPage() {
  const [rooms, setRooms] = useState<Room[]>(initialRooms);

  function handleCreateRoom() {
    const newRoom: Room = {
      id: Math.random().toString(16).slice(2, 8),
      name: `Untitled room ${rooms.length + 1}`,
      participants: 1,
      updatedAt: "just now",
      ownedByMe: true,
    };
    setRooms([newRoom, ...rooms]);
  }

  function handleDeleteRoom(id: string) {
    setRooms(rooms.filter((room) => room.id !== id));
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

      {rooms.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No rooms yet — create one to get started.
        </p>
      ) : (
        <div className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{room.name}</span>
                  <span className="rounded bg-neutral-900 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-xs text-neutral-500">
                    {room.id}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {room.participants} online · updated {room.updatedAt}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/room/${room.id}`}
                  className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm transition-colors hover:border-neutral-500"
                >
                  Join
                </Link>
                {room.ownedByMe && (
                  <button
                    onClick={() => handleDeleteRoom(room.id)}
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