"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search, Plus } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useApi } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { CreateRoomModal } from "@/components/CreateRoomModal";
import { Skeleton } from "@/components/Skeleton";
import type { Room } from "@/types/room";

export default function DashboardPage() {
  const { userId } = useAuth();
  const api = useApi();
  const { toast } = useToast();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    api
      .get<Room[]>("/api/rooms")
      .then((res) => setRooms(res.data))
      .catch(() => toast("Could not load your rooms.", "error"))
      .finally(() => setLoading(false));
  }, [api]);

  async function handleCreateRoom(name: string, language: string) {
    try {
      const res = await api.post<Room>("/api/rooms", { name, language });
      setRooms([res.data, ...rooms]);
      toast(`"${res.data.name}" created`);
    } catch {
      toast("Could not create the room.", "error");
      throw new Error("create failed");
    }
  }

  async function handleDeleteRoom(id: string, name: string) {
    try {
      await api.delete(`/api/rooms/${id}`);
      setRooms(rooms.filter((room) => room._id !== id));
      toast(`"${name}" deleted`);
    } catch {
      toast("Could not delete the room.", "error");
    }
  }

  const filteredRooms = useMemo(
    () =>
      rooms.filter((room) =>
        room.name.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [rooms, query]
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your rooms</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-200"
        >
          <Plus className="h-4 w-4" />
          New room
        </button>
      </div>

      {rooms.length > 0 && (
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rooms…"
            className="w-full rounded-md border border-neutral-800 bg-neutral-900 py-2 pl-9 pr-3 text-sm placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-lg border border-neutral-800 p-4">
              <Skeleton className="mb-2 h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-800 py-16 text-center">
          <p className="text-sm text-neutral-400">No rooms yet.</p>
          <button
            onClick={() => setModalOpen(true)}
            className="text-sm font-medium text-neutral-100 underline underline-offset-4 hover:text-neutral-300"
          >
            Create your first room
          </button>
        </div>
      ) : filteredRooms.length === 0 ? (
        <p className="text-sm text-neutral-500">No rooms match "{query}".</p>
      ) : (
        <div className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
          {filteredRooms.map((room, i) => (
            <motion.div
              key={room._id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: i * 0.03 }}
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
                    onClick={() => handleDeleteRoom(room._id, room.name)}
                    className="rounded-md px-2 py-1.5 text-sm text-neutral-500 transition-colors hover:text-red-400"
                  >
                    Delete
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <CreateRoomModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreateRoom}
      />
    </main>
  );
}