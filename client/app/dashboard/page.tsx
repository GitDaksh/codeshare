"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Clock,
  Languages,
  LayoutGrid,
  Link as LinkIcon,
  Plus,
  Search,
  Star,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useApi } from "@/lib/api";
import { useOnboardingGate } from "@/lib/useOnboardingGate";
import { useToast } from "@/components/ToastProvider";
import { CreateRoomModal } from "@/components/CreateRoomModal";
import { AvatarIcon } from "@/components/AvatarIcon";
import { Skeleton } from "@/components/Skeleton";
import { RoomCard } from "@/components/RoomCard";
import { DashboardSkeleton, RoomCardSkeleton } from "@/components/DashboardSkeleton";
import { LANGUAGES } from "@/lib/languages";
import type { Room } from "@/types/room";

type SortMode = "updated" | "name";

const DELETE_CONFIRM_WINDOW_MS = 3000;
const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98];

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

function languageLabel(value: string): string {
  return LANGUAGES.find((l) => l.value === value)?.label ?? value;
}

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Up late";
}

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-medium text-ink-100">
      {title}
      <span className="rounded-md bg-ink-900 px-1.5 py-0.5 text-[11px] tabular-nums text-ink-500">{count}</span>
    </h2>
  );
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
  const searchRef = useRef<HTMLInputElement>(null);

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

  // Keyboard shortcuts: N opens "New room", / jumps to search.
  // Ignored while typing in any field, and when a modifier key is held.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing) return;

      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setModalOpen(true);
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  function clearFilters() {
    setQuery("");
    setLanguageFilter(null);
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
    return <DashboardSkeleton />;
  }

  const stats: { label: string; value: string; icon: LucideIcon }[] = [
    { label: "Rooms", value: String(rooms.length), icon: LayoutGrid },
    { label: "Languages", value: String(availableLanguages.length), icon: Languages },
    { label: "Last active", value: lastActive ? timeAgo(lastActive) : "—", icon: Clock },
    {
      label: "Favorite",
      value: profile?.favoriteLanguage ? languageLabel(profile.favoriteLanguage) : "Not set",
      icon: Star,
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      {/* ---------- Header ---------- */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-center gap-4">
          {profile && (
            <AvatarIcon
              avatarId={profile.avatarId}
              className="h-12 w-12 shrink-0 rounded-full ring-1 ring-ink-800 ring-offset-2 ring-offset-ink-950 sm:h-14 sm:w-14"
            />
          )}
          <div className="min-w-0">
            <p className="text-sm text-ink-500">{greetingFor(new Date())}</p>
            <h1 className="text-gradient truncate pb-0.5 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
              {profile ? `@${profile.username}` : "Your rooms"}
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/profile"
            className="inline-flex h-9 items-center rounded-full border border-ink-800 px-4 text-sm text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-100"
          >
            Profile
          </Link>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-ink-100 pl-3 pr-3 text-sm font-semibold text-ink-950 shadow-[0_0_24px_-8px_rgba(255,255,255,0.55)] transition-all hover:bg-white hover:shadow-[0_0_32px_-6px_rgba(255,255,255,0.7)] active:scale-[0.98] sm:pr-2"
          >
            <Plus className="h-4 w-4" />
            New room
            <kbd className="hidden rounded bg-ink-950/10 px-1.5 font-[family-name:var(--font-mono)] text-[10px] text-ink-950/60 sm:inline">
              N
            </kbd>
          </button>
        </div>
      </motion.div>

      {/* ---------- Stats ---------- */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05, ease: EASE }}
        className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-ink-800 bg-ink-800 sm:grid-cols-4"
      >
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-ink-950 p-4 sm:p-5">
            <div className="flex items-center gap-1.5 text-xs text-ink-500">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
            <div className="mt-2 truncate font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-ink-100 sm:text-2xl">
              {loading && label !== "Favorite" ? <Skeleton className="h-7 w-12" /> : value}
            </div>
          </div>
        ))}
      </motion.div>

      {/* ---------- Join bar ---------- */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
        className="mt-4 flex items-center gap-2 rounded-2xl border border-ink-800 bg-ink-950 p-1.5 pl-4 transition-colors focus-within:border-ink-600"
      >
        <LinkIcon className="h-4 w-4 shrink-0 text-ink-600" />
        <input
          value={joinInput}
          onChange={(e) => setJoinInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleJoinByLink()}
          placeholder="Paste a room link or ID to join"
          enterKeyHint="go"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-ink-100 placeholder:text-ink-600 focus:outline-none"
        />
        <button
          onClick={handleJoinByLink}
          disabled={!joinInput.trim()}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl bg-ink-900 px-3 text-sm text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Join
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </motion.div>

      {/* ---------- Recently joined ---------- */}
      {recentRooms.length > 0 && (
        <section className="mt-12">
          <SectionHeading title="Recently joined" count={recentRooms.length} />
          <div className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
            {recentRooms.map((room) => (
              <Link
                key={room._id}
                href={`/room/${room._id}`}
                className="group flex w-60 shrink-0 snap-start flex-col rounded-xl border border-ink-800 bg-ink-950 p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-ink-600"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate text-sm font-medium text-ink-100">{room.name}</span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-600 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink-100" />
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-ink-500">
                  <span className="rounded-md border border-ink-800 bg-ink-900 px-1.5 py-0.5 text-[10px] text-ink-400">
                    {languageLabel(room.language)}
                  </span>
                  <span className="truncate">{timeAgo(room.updatedAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------- Your rooms ---------- */}
      <section className="mt-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeading title="Your rooms" count={rooms.length} />

          {rooms.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-600" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search rooms"
                  enterKeyHint="search"
                  className="h-9 w-full rounded-lg border border-ink-800 bg-ink-950 pl-9 pr-8 text-sm text-ink-100 placeholder:text-ink-600 transition-colors focus:border-ink-600 focus:outline-none"
                />
                <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-ink-800 px-1.5 font-[family-name:var(--font-mono)] text-[10px] text-ink-600 sm:block">
                  /
                </kbd>
              </div>

              <div className="flex h-9 shrink-0 rounded-lg border border-ink-800 bg-ink-950 p-0.5">
                {(["updated", "name"] as const).map((mode) => {
                  const active = sortBy === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => setSortBy(mode)}
                      className="relative rounded-md px-2.5 text-xs font-medium"
                    >
                      {active && (
                        <motion.span
                          layoutId="dashboard-sort-pill"
                          className="absolute inset-0 rounded-md bg-ink-800"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                        />
                      )}
                      <span className={`relative transition-colors ${active ? "text-ink-100" : "text-ink-500 hover:text-ink-300"}`}>
                        {mode === "updated" ? "Recent" : "A–Z"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {availableLanguages.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {[null, ...availableLanguages].map((lang) => {
              const active = languageFilter === lang;
              return (
                <button
                  key={lang ?? "all"}
                  onClick={() => setLanguageFilter(lang)}
                  className={`h-7 rounded-full border px-3 text-xs transition-colors ${
                    active
                      ? "border-ink-100 bg-ink-100 text-ink-950"
                      : "border-ink-800 text-ink-400 hover:border-ink-600 hover:text-ink-100"
                  }`}
                >
                  {lang ? languageLabel(lang) : "All"}
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <RoomCardSkeleton key={i} />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-ink-800 px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-ink-800 bg-ink-900">
              <Plus className="h-5 w-5 text-ink-400" />
            </div>
            <h3 className="mt-4 font-medium text-ink-100">No rooms yet</h3>
            <p className="mt-1 max-w-xs text-sm text-ink-500">
              Create a room, share the link, and start coding together.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="mt-6 inline-flex h-9 items-center gap-2 rounded-full bg-ink-100 px-4 text-sm font-semibold text-ink-950 transition-colors hover:bg-white"
            >
              <Plus className="h-4 w-4" />
              Create your first room
            </button>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-ink-800 px-6 py-12 text-center">
            <p className="text-sm text-ink-400">No rooms match your filters.</p>
            <button
              onClick={clearFilters}
              className="mt-3 text-sm text-ink-100 underline underline-offset-4 transition-colors hover:text-ink-300"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <motion.div layout className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filteredRooms.map((room, i) => (
                <motion.div
                  key={room._id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
                  transition={{
                    layout: { duration: 0.35, ease: EASE },
                    opacity: { duration: 0.35, delay: Math.min(i, 8) * 0.04 },
                    y: { duration: 0.35, delay: Math.min(i, 8) * 0.04, ease: EASE },
                  }}
                >
                  <RoomCard
                    room={room}
                    updatedLabel={`updated ${timeAgo(room.updatedAt)}`}
                    canDelete={room.ownerId === userId}
                    confirmingDelete={pendingDeleteId === room._id}
                    onRequestDelete={() => requestDelete(room._id, room.name)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      <CreateRoomModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreateRoom}
        defaultLanguage={profile?.favoriteLanguage || "javascript"}
      />
    </main>
  );
}