"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Link as LinkIcon, Plus, Search, Users } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useApi } from "@/lib/api";
import { useOnboardingGate } from "@/lib/useOnboardingGate";
import { useToast } from "@/components/ToastProvider";
import { CreateRoomModal } from "@/components/CreateRoomModal";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { DashboardSummary } from "@/components/DashboardSummary";
import { InterviewList } from "@/components/interview/InterviewList";
import { PageContainer, PageHeader } from "@/components/PageHeader";
import { RoomRow, languageLabel } from "@/components/RoomRow";
import { Segmented } from "@/components/Segmented";
import { getStarterCode } from "@/lib/languages";
import { ui } from "@/lib/ui";
import type { ProfileStats } from "@/types/profile";
import type { Room } from "@/types/room";

type SortMode = "updated" | "name";
type Tab = "mine" | "shared";

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

// A room link (or a bare room id) → where to go. Invite links keep their
// invite code, so the room opens for someone who hasn't joined it yet.
function roomPathFrom(input: string): string | null {
  const trimmed = input.trim();
  const id = trimmed.match(/room\/([a-f0-9]{24})/i)?.[1] ?? (/^[a-f0-9]{24}$/i.test(trimmed) ? trimmed : null);
  if (!id) return null;
  const invite = trimmed.match(/[?&]invite=([A-Za-z0-9]{16})/)?.[1];
  return invite ? `/room/${id}?invite=${invite}` : `/room/${id}`;
}

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Up late";
}

// "Join a room": a small panel to paste an invite link or a room ID into.
function JoinRoom({ onJoin }: { onJoin: (value: string) => boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (onJoin(value)) {
      setOpen(false);
      setValue("");
    }
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={ui.secondary}>
        <LinkIcon className="h-4 w-4" />
        Join a room
      </button>
      <AnimatePresence>
        {open && (
          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 top-full z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-ink-800 bg-ink-900 p-4 shadow-raised sm:left-auto sm:right-0"
          >
            <p className="text-sm font-semibold text-ink-100">Join a room</p>
            <p className="mt-0.5 text-xs text-ink-500">Paste an invite link or a room ID.</p>
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://codeshare.tech/room/…"
              enterKeyHint="go"
              className={`${ui.input} mt-3`}
            />
            <button type="submit" disabled={!value.trim()} className={`${ui.primary} mt-2 w-full`}>
              Join
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
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
  const [tab, setTab] = useState<Tab>("mine");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortMode>("updated");
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [statsFailed, setStatsFailed] = useState(false);
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

  // The summary column. Days on its activity chart follow this browser's time zone.
  useEffect(() => {
    api
      .get<ProfileStats>("/api/profile/stats", { params: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone } })
      .then((res) => setStats(res.data))
      .catch(() => setStatsFailed(true));
  }, [api]);

  // Keyboard shortcuts: N opens "New room", / jumps to search.
  // Ignored while typing in any field, and when a modifier key is held.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
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
      // New rooms start with the language's starter code in the shared document.
      const res = await api.post<Room>("/api/rooms", { name, language, code: getStarterCode(language) });
      setRooms([res.data, ...rooms]);
      setTab("mine");
      toast(`"${res.data.name}" created`);
    } catch (err) {
      // The server's reason (for example, the 100-room limit), if it sent one.
      const reason = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast(reason || "Could not create the room.", "error");
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

  function handleJoin(value: string): boolean {
    const path = roomPathFrom(value);
    if (!path) {
      toast("That doesn't look like a valid room link or ID.", "error");
      return false;
    }
    router.push(path);
    return true;
  }

  function clearFilters() {
    setQuery("");
    setLanguageFilter(null);
  }

  const source = tab === "mine" ? rooms : recentRooms;
  const availableLanguages = useMemo(() => Array.from(new Set(source.map((r) => r.language))), [source]);

  const filteredRooms = useMemo(() => {
    let result = source.filter((room) => room.name.toLowerCase().includes(query.trim().toLowerCase()));
    if (languageFilter) result = result.filter((room) => room.language === languageFilter);
    if (sortBy === "name") return [...result].sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [source, query, sortBy, languageFilter]);

  if (checking) {
    return <DashboardSkeleton />;
  }

  const name = profile?.username ?? "there";

  return (
    <PageContainer>
      <PageHeader
        title={`${greetingFor(new Date())}, ${name}`}
        description="Your rooms, practice and interviews, all in one place."
        actions={
          <>
            <JoinRoom onJoin={handleJoin} />
            <button type="button" onClick={() => setModalOpen(true)} className={ui.primary}>
              <Plus className="h-4 w-4" />
              New room
              <kbd className="hidden rounded border border-ink-50/20 px-1 font-[family-name:var(--font-mono)] text-[10px] text-ink-950/70 sm:inline">
                N
              </kbd>
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-8">
          {/* ---------- Rooms ---------- */}
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <Segmented
                id="dashboard-rooms"
                value={tab}
                onChange={(next) => {
                  setTab(next);
                  setLanguageFilter(null);
                }}
                options={[
                  { value: "mine", label: "Your rooms", count: rooms.length },
                  { value: "shared", label: "Shared with you", count: recentRooms.length },
                ]}
              />
              {source.length > 0 && (
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
                    <input
                      ref={searchRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search"
                      enterKeyHint="search"
                      className={`${ui.input} pl-9 pr-8`}
                    />
                    <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-ink-700 px-1.5 font-[family-name:var(--font-mono)] text-[10px] text-ink-500 sm:block">
                      /
                    </kbd>
                  </div>
                  <Segmented
                    id="dashboard-sort"
                    size="sm"
                    value={sortBy}
                    onChange={setSortBy}
                    options={[
                      { value: "updated", label: "Recent" },
                      { value: "name", label: "A–Z" },
                    ]}
                  />
                </div>
              )}
            </div>

            {availableLanguages.length > 1 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {[null, ...availableLanguages].map((lang) => {
                  const active = languageFilter === lang;
                  return (
                    <button
                      key={lang ?? "all"}
                      type="button"
                      onClick={() => setLanguageFilter(lang)}
                      className={`h-7 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                        active
                          ? "border-ink-100 bg-ink-100 text-ink-950"
                          : "border-ink-800 bg-ink-900 text-ink-400 hover:border-ink-700 hover:text-ink-100"
                      }`}
                    >
                      {lang ? languageLabel(lang) : "All languages"}
                    </button>
                  );
                })}
              </div>
            )}

            {loading ? (
              <div className={`${ui.card} divide-y divide-ink-800 overflow-hidden`}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3.5 px-5 py-3">
                    <span className="h-9 w-9 animate-pulse rounded-lg bg-ink-800" />
                    <span className="flex-1 space-y-1.5">
                      <span className="block h-3 w-40 animate-pulse rounded bg-ink-800" />
                      <span className="block h-2.5 w-28 animate-pulse rounded bg-ink-800" />
                    </span>
                  </div>
                ))}
              </div>
            ) : source.length === 0 ? (
              <div className="flex flex-col items-center rounded-xl border border-dashed border-ink-700 bg-ink-950 px-6 py-14 text-center">
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-ink-800 bg-ink-900 shadow-xs">
                  {tab === "mine" ? <Plus className="h-5 w-5 text-ink-400" /> : <Users className="h-5 w-5 text-ink-400" />}
                </div>
                <h3 className="mt-4 text-sm font-semibold text-ink-100">
                  {tab === "mine" ? "No rooms yet" : "Nothing shared with you yet"}
                </h3>
                <p className="mt-1 max-w-xs text-sm text-ink-500">
                  {tab === "mine"
                    ? "Create a room, share the link, and start coding together."
                    : "Rooms you join with someone's invite link show up here."}
                </p>
                {tab === "mine" ? (
                  <button type="button" onClick={() => setModalOpen(true)} className={`${ui.primary} mt-5`}>
                    <Plus className="h-4 w-4" />
                    Create your first room
                  </button>
                ) : (
                  <div className="mt-5">
                    <JoinRoom onJoin={handleJoin} />
                  </div>
                )}
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink-700 bg-ink-950 px-6 py-10 text-center">
                <p className="text-sm text-ink-400">No rooms match your filters.</p>
                <button type="button" onClick={clearFilters} className={`${ui.secondarySm} mt-3`}>
                  Clear filters
                </button>
              </div>
            ) : (
              <motion.div layout className={`${ui.card} divide-y divide-ink-800 overflow-hidden`}>
                <AnimatePresence initial={false}>
                  {filteredRooms.map((room) => (
                    <motion.div
                      key={room._id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    >
                      <RoomRow
                        room={room}
                        meta={`Updated ${timeAgo(room.updatedAt)}`}
                        canDelete={tab === "mine" && room.ownerId === userId}
                        confirmingDelete={pendingDeleteId === room._id}
                        onRequestDelete={() => requestDelete(room._id, room.name)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </section>

          {/* ---------- Interviews (only once you've had one) ---------- */}
          <InterviewList />
        </div>

        {/* ---------- Summary ---------- */}
        <DashboardSummary profile={profile} stats={stats} statsFailed={statsFailed} />
      </div>

      <CreateRoomModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreateRoom}
        defaultLanguage={profile?.favoriteLanguage || "javascript"}
      />
    </PageContainer>
  );
}