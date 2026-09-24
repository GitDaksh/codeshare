"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Plus, ArrowRight } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useApi } from "@/lib/api";
import { useOnboardingGate } from "@/lib/useOnboardingGate";
import { useToast } from "@/components/ToastProvider";
import { CreateRoomModal } from "@/components/CreateRoomModal";
import { Skeleton } from "@/components/Skeleton";
import { AvatarIcon } from "@/components/AvatarIcon";
import { getLanguageBadgeClasses } from "@/lib/languages";
import type { Room } from "@/types/room";

type SortMode = "updated" | "name";

const DELETE_CONFIRM_WINDOW_MS = 3000;

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function extractRoomId(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/room\/([a-f0-9]{24})/i);
  if (match) return match[1];
  if (/^[a-f0-9]{24}$/i.test(trimmed)) return trimmed;
  return null;
}

export default function DashboardPage() {
  const { userId } = useAuth();
  const router = useRouter();
  const api = useApi();
  const { toast } = useToast();
  const { checking, profile } = useOnboardingGate();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [recentRooms, setRecentRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortMode>("updated");
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [joinInput, setJoinInput] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Dashboard — CodeShare";
  }, []);

  useEffect(() => {
    api
      .get<Room[]>("/api/rooms")
      .then((res) => setRooms(res.data))
      .catch(() => toast("Could not load your rooms.", "error"))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    api
      .get<Room[]>("/api/profile/recent-rooms")
      .then((res) => setRecentRooms(res.data))
      .catch(() => {});
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
      setRooms((prev) => prev.filter((room) => room._id !== id));
      toast(`"${name}" deleted`);
    } catch {
      toast("Could not delete the room.", "error");
    }
  }

  // Two-step delete: first tap arms it, second tap within 3s confirms.
  // Prevents a stray tap (especially on phones) from wiping a room.
  function requestDelete(id: string, name: string) {
    if (pendingDeleteId === id) {
      setPendingDeleteId(null);
      handleDeleteRoom(id, name);
      return;
    }
    setPendingDeleteId(id);
    setTimeout(() => {
      setPendingDeleteId((current) => (current === id ? null : current));
    }, DELETE_CONFIRM_WINDOW_MS);
  }

  function handleJoinByLink() {
    const id = extractRoomId(joinInput);
    if (!id) {
      toast("That doesn't look like a valid room link or ID.", "error");
      return;
    }
    router.push(`/room/${id}`);
  }

  const availableLanguages = useMemo(
    () => Array.from(new Set(rooms.map((r) => r.language))),
    [rooms]
  );

  const filteredRooms = useMemo(() => {
    let result = rooms.filter((room) =>
      room.name.toLowerCase().includes(query.trim().toLowerCase())
    );
    if (languageFilter) {
      result = result.filter((room) => room.language === languageFilter);
    }
    if (sortBy === "name") {
      return [...result].sort((a, b) => a.name.localeCompare(b.name));
    }
    return result;
  }, [rooms, query, sortBy, languageFilter]);

  const lastActive = useMemo(() => {
    if (rooms.length === 0) return null;
    return rooms.reduce((latest, r) => (r.updatedAt > latest ? r.updatedAt : latest), rooms[0].updatedAt);
  }, [rooms]);

  if (checking) {
    return (
      <main className="flex min-h-[calc(100dvh-56px)] items-center justify-center">
        <p className="text-sm text-ink-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      {profile && (
        <div className="mb-6 flex items-center gap-3 sm:mb-8">
          <AvatarIcon avatarId={profile.avatarId} className="h-10 w-10 shrink-0 rounded-full sm:h-12 sm:w-12" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-[family-name:var(--font-display)] text-lg font-semibold text-ink-100 sm:text-xl">
              Welcome back, @{profile.username}
            </h1>
            {profile.bio && <p className="truncate text-sm text-ink-500">{profile.bio}</p>}
          </div>
          <Link
            href="/profile"
            className="shrink-0 text-xs text-ink-500 transition-colors hover:text-ink-100"
          >
            Edit profile
          </Link>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-2 sm:mb-8 sm:grid-cols-4 sm:gap-3">
        <div className="rounded-lg border border-ink-800 p-3">
          <p className="text-xs text-ink-500">Rooms</p>
          <p className="mt-1 text-base font-medium text-ink-100 sm:text-lg">{rooms.length}</p>
        </div>
        <div className="rounded-lg border border-ink-800 p-3">
          <p className="text-xs text-ink-500">Languages used</p>
          <p className="mt-1 text-base font-medium text-ink-100 sm:text-lg">{availableLanguages.length}</p>
        </div>
        <div className="rounded-lg border border-ink-800 p-3">
          <p className="text-xs text-ink-500">Last active</p>
          <p className="mt-1 text-base font-medium text-ink-100 sm:text-lg">
            {lastActive ? timeAgo(lastActive) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-ink-800 p-3">
          <p className="text-xs text-ink-500">Favorite language</p>
          <p className="mt-1 truncate text-base font-medium text-ink-100 sm:text-lg">
            {profile?.favoriteLanguage || "Not set"}
          </p>
        </div>
      </div>

      <div className="mb-8 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-1.5 rounded-md bg-ink-100 px-4 py-2.5 text-sm font-medium text-ink-950 transition-colors hover:bg-white sm:py-2"
        >
          <Plus className="h-4 w-4" />
          New room
        </button>
        <div className="flex flex-1 gap-2">
          <input
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoinByLink()}
            placeholder="Paste a room link or ID…"
            enterKeyHint="go"
            className="min-w-0 flex-1 rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-600 focus:border-ink-600 focus:outline-none"
          />
          <button
            onClick={handleJoinByLink}
            className="flex shrink-0 items-center gap-1 rounded-md border border-ink-700 px-3 py-2 text-sm text-ink-100 transition-colors hover:border-ink-500"
          >
            Join
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {recentRooms.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-500">
            Recently joined
          </h2>
          <div className="divide-y divide-ink-800 rounded-lg border border-ink-800">
            {recentRooms.map((room) => (
              <div key={room._id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink-100">{room.name}</span>
                    <span className={`rounded border px-1.5 py-0.5 text-xs ${getLanguageBadgeClasses(room.language)}`}>
                      {room.language}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-500">updated {timeAgo(room.updatedAt)}</p>
                </div>
                <Link
                  href={`/room/${room._id}`}
                  className="shrink-0 rounded-md border border-ink-700 px-3 py-1.5 text-sm text-ink-100 transition-colors hover:border-ink-500"
                >
                  Join
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-500">Your rooms</h2>

      {rooms.length > 0 && (
        <>
          <div className="mb-3 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-600" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search rooms…"
                enterKeyHint="search"
                className="w-full rounded-md border border-ink-800 bg-ink-900 py-2 pl-9 pr-3 text-sm text-ink-100 placeholder:text-ink-600 focus:border-ink-600 focus:outline-none"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortMode)}
              aria-label="Sort rooms"
              className="shrink-0 rounded-md border border-ink-800 bg-ink-900 px-2 text-sm text-ink-400 focus:border-ink-600 focus:outline-none"
            >
              <option value="updated">Recent</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>

          {availableLanguages.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              <button
                onClick={() => setLanguageFilter(null)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  languageFilter === null
                    ? "border-ink-100 bg-ink-100 text-ink-950"
                    : "border-ink-700 text-ink-400 hover:border-ink-500"
                }`}
              >
                All
              </button>
              {availableLanguages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguageFilter(lang)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    languageFilter === lang
                      ? "border-ink-100 bg-ink-100 text-ink-950"
                      : "border-ink-700 text-ink-400 hover:border-ink-500"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-lg border border-ink-800 p-4">
              <Skeleton className="mb-2 h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-ink-800 px-4 py-12 text-center sm:py-16">
          <p className="text-sm text-ink-400">No rooms yet.</p>
          <button
            onClick={() => setModalOpen(true)}
            className="text-sm font-medium text-ink-100 underline underline-offset-4 hover:text-ink-300"
          >
            Create your first room
          </button>
        </div>
      ) : filteredRooms.length === 0 ? (
        <p className="text-sm text-ink-500">No rooms match your filters.</p>
      ) : (
        <div className="divide-y divide-ink-800 rounded-lg border border-ink-800">
          {filteredRooms.map((room, i) => {
            const confirming = pendingDeleteId === room._id;
            return (
              <motion.div
                key={room._id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: i * 0.03 }}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink-100">{room.name}</span>
                    <span className="hidden rounded bg-ink-900 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-xs text-ink-500 sm:inline">
                      {room._id}
                    </span>
                    <span className={`rounded border px-1.5 py-0.5 text-xs ${getLanguageBadgeClasses(room.language)}`}>
                      {room.language}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-500">updated {timeAgo(room.updatedAt)}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/room/${room._id}`}
                    className="rounded-md border border-ink-700 px-3 py-1.5 text-sm text-ink-100 transition-colors hover:border-ink-500"
                  >
                    Join
                  </Link>
                  {room.ownerId === userId && (
                    <button
                      onClick={() => requestDelete(room._id, room.name)}
                      className={`rounded-md px-2 py-1.5 text-sm transition-colors ${
                        confirming
                          ? "bg-red-500/10 text-red-400"
                          : "text-ink-500 hover:text-red-400"
                      }`}
                    >
                      {confirming ? "Confirm delete" : "Delete"}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <CreateRoomModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreateRoom}
        defaultLanguage={profile?.favoriteLanguage || "javascript"}
      />
    </main>
  );
}