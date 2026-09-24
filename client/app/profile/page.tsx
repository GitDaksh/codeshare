"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock,
  Languages,
  LayoutGrid,
  Loader2,
  LogOut,
  Pencil,
  Settings,
} from "lucide-react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useApi } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { AvatarIcon } from "@/components/AvatarIcon";
import { AvatarPicker } from "@/components/AvatarPicker";
import { GithubIcon } from "@/components/GithubIcon";
import { UsernameInput } from "@/components/UsernameInput";
import { ProfilePreviewCard } from "@/components/ProfilePreviewCard";
import { RoomCard } from "@/components/RoomCard";
import { Skeleton } from "@/components/Skeleton";
import { LANGUAGES } from "@/lib/languages";
import type { Profile } from "@/types/profile";
import type { Room } from "@/types/room";

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98];
const ROOMS_PREVIEW_COUNT = 4;

const LANGUAGE_CHOICES: { value: string; label: string }[] = [
  { value: "", label: "No preference" },
  ...LANGUAGES.map((l) => ({ value: l.value, label: l.label })),
];

function languageLabel(value: string): string {
  return LANGUAGES.find((l) => l.value === value)?.label ?? value;
}

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

// ---------- Small building blocks ----------

function Section({
  title,
  description,
  action,
  delay = 0,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  delay?: number;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: EASE }}
      className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-950"
    >
      <div className="flex items-start justify-between gap-4 border-b border-ink-900 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-ink-100">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-ink-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

// Smoothly expands/collapses an inline editor.
function Expand({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EditButton({ onClick, label = "Edit" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-ink-800 px-3 text-xs text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-100"
    >
      <Pencil className="h-3 w-3" />
      {label}
    </button>
  );
}

function SaveBar({
  onSave,
  onCancel,
  saving,
  disabled = false,
  saveLabel = "Save",
}: {
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  disabled?: boolean;
  saveLabel?: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="h-9 rounded-full px-4 text-sm text-ink-400 transition-colors hover:text-ink-100"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={disabled || saving}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink-100 px-4 text-sm font-semibold text-ink-950 transition-all hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        {saving ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-start sm:gap-6">
      <dt className="w-36 shrink-0 text-xs text-ink-500 sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-sm text-ink-100">{children}</dd>
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-ink-600">{children}</span>;
}

function ProfileSkeleton() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-3 h-9 w-56" />
      <Skeleton className="mt-3 h-4 w-72" />
      <div className="mt-10 grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-10">
        <Skeleton className="h-[380px] w-full rounded-3xl" />
        <div className="space-y-6">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    </main>
  );
}

// ---------- Page ----------

export default function ProfilePage() {
  const api = useApi();
  const { toast } = useToast();
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const reduce = useReducedMotion();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  // null = avatar picker closed. While open, this holds the avatar being
  // previewed, so you can browse freely and only save when you're happy.
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameDraftValid, setUsernameDraftValid] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);

  const [editingDetails, setEditingDetails] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [languageDraft, setLanguageDraft] = useState("");
  const [githubDraft, setGithubDraft] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  useEffect(() => {
    document.title = "Profile — CodeShare";
  }, []);

  useEffect(() => {
    Promise.all([api.get<Profile>("/api/profile"), api.get<Room[]>("/api/rooms")])
      .then(([profileRes, roomsRes]) => {
        setProfile(profileRes.data);
        setUsernameDraft(profileRes.data.username);
        setBioDraft(profileRes.data.bio);
        setLanguageDraft(profileRes.data.favoriteLanguage);
        setGithubDraft(profileRes.data.githubUsername);
        setRooms(roomsRes.data);
      })
      .catch(() => toast("Could not load your profile.", "error"))
      .finally(() => setLoading(false));
  }, [api]);

  async function handleAvatarSave() {
    if (!profile || avatarDraft === null) return;
    if (avatarDraft === profile.avatarId) {
      setAvatarDraft(null);
      return;
    }

    setSavingAvatar(true);
    try {
      const res = await api.put<Profile>("/api/profile", { avatarId: avatarDraft });
      setProfile(res.data);
      setAvatarDraft(null);
      toast("Avatar updated");
    } catch {
      toast("Could not update your avatar.", "error");
    } finally {
      setSavingAvatar(false);
    }
  }

  async function handleSaveUsername() {
    if (!usernameDraftValid) return;
    setSavingUsername(true);
    try {
      const res = await api.put<Profile>("/api/profile", { username: usernameDraft });
      setProfile(res.data);
      setEditingUsername(false);
      toast("Username updated");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Could not update username.";
      toast(message, "error");
    } finally {
      setSavingUsername(false);
    }
  }

  async function handleSaveDetails() {
    setSavingDetails(true);
    try {
      const res = await api.put<Profile>("/api/profile", {
        bio: bioDraft.trim(),
        favoriteLanguage: languageDraft,
        githubUsername: githubDraft.trim(),
      });
      setProfile(res.data);
      setEditingDetails(false);
      toast("Profile updated");
    } catch {
      toast("Could not update your profile.", "error");
    } finally {
      setSavingDetails(false);
    }
  }

  const sortedRooms = useMemo(
    () => [...rooms].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [rooms]
  );

  const languagesUsed = useMemo(() => new Set(rooms.map((r) => r.language)).size, [rooms]);

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (!profile) {
    return (
      <main className="flex min-h-[calc(100dvh-56px)] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="font-medium text-ink-100">Couldn&apos;t load your profile</p>
        <p className="max-w-xs text-sm text-ink-500">Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 inline-flex h-9 items-center rounded-full border border-ink-800 px-4 text-sm text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-100"
        >
          Try again
        </button>
      </main>
    );
  }

  // The member card previews unsaved edits live; Cancel snaps it back.
  const previewAvatar = avatarDraft ?? profile.avatarId;
  const previewUsername = editingUsername ? usernameDraft : profile.username;
  const previewBio = editingDetails ? bioDraft : profile.bio;
  const previewLanguage = editingDetails ? languageDraft : profile.favoriteLanguage;
  const previewGithub = editingDetails ? githubDraft : profile.githubUsername;

  const email = user?.primaryEmailAddress?.emailAddress;
  const lastActive = sortedRooms[0]?.updatedAt;

  const stats = [
    {
      label: "Member since",
      value: new Date(profile.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" }),
      icon: CalendarDays,
    },
    { label: "Rooms", value: String(rooms.length), icon: LayoutGrid },
    { label: "Languages", value: String(languagesUsed), icon: Languages },
    { label: "Last active", value: lastActive ? timeAgo(lastActive) : "—", icon: Clock },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      {/* ---------- Header ---------- */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mb-8 sm:mb-10"
      >
        <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em] text-ink-500">
          Profile
        </p>
        <h1 className="text-gradient mt-2 pb-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
          Your profile
        </h1>
        <p className="mt-2 text-sm text-ink-400">
          This is how you show up in rooms, in chat, and next to your cursor.
        </p>
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-10">
        {/* ---------- Live member card ---------- */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05, ease: EASE }}
          >
            <ProfilePreviewCard
              avatarId={previewAvatar}
              username={previewUsername}
              bio={previewBio}
              favoriteLanguage={previewLanguage}
              githubUsername={previewGithub}
            />
            <p className="mt-4 text-center text-xs text-ink-600">Updates live as you edit</p>
          </motion.div>
        </aside>

        <div className="min-w-0 space-y-6">
          {/* ---------- Identity ---------- */}
          <Section title="Identity" description="Your avatar and username." delay={0.08}>
            {/* Avatar */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-4">
                <AvatarIcon avatarId={previewAvatar} className="h-12 w-12 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-100">Avatar</p>
                  <p className="text-xs text-ink-500">Shown next to your cursor, your messages, and in rooms.</p>
                </div>
                {avatarDraft === null && (
                  <EditButton label="Change" onClick={() => setAvatarDraft(profile.avatarId)} />
                )}
              </div>
              <Expand open={avatarDraft !== null}>
                <div className="pt-5">
                  <div className="rounded-xl border border-ink-800 bg-ink-900/30 p-4">
                    <AvatarPicker value={avatarDraft ?? profile.avatarId} onChange={setAvatarDraft} />
                  </div>
                  <div className="mt-4">
                    <SaveBar
                      onSave={handleAvatarSave}
                      onCancel={() => setAvatarDraft(null)}
                      saving={savingAvatar}
                      saveLabel="Save avatar"
                    />
                  </div>
                </div>
              </Expand>
            </div>

            {/* Username */}
            <div className="border-t border-ink-900 px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ink-800 bg-ink-900 font-[family-name:var(--font-mono)] text-lg text-ink-400">
                  @
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink-500">Username</p>
                  <p className="truncate text-sm font-medium text-ink-100">@{profile.username}</p>
                </div>
                {!editingUsername && (
                  <EditButton
                    onClick={() => {
                      setUsernameDraft(profile.username);
                      setEditingUsername(true);
                    }}
                  />
                )}
              </div>
              <Expand open={editingUsername}>
                <div className="space-y-4 pt-5">
                  <UsernameInput
                    value={usernameDraft}
                    onChange={setUsernameDraft}
                    onValidityChange={setUsernameDraftValid}
                  />
                  <SaveBar
                    onSave={handleSaveUsername}
                    onCancel={() => {
                      setUsernameDraft(profile.username);
                      setEditingUsername(false);
                    }}
                    saving={savingUsername}
                    disabled={!usernameDraftValid}
                  />
                </div>
              </Expand>
            </div>
          </Section>

          {/* ---------- About ---------- */}
          <Section
            title="About"
            description="A little about you, visible on your member card."
            delay={0.14}
            action={!editingDetails ? <EditButton onClick={() => setEditingDetails(true)} /> : undefined}
          >
            {!editingDetails && (
              <dl className="divide-y divide-ink-900">
                <DetailRow label="Bio">{profile.bio || <Muted>No bio yet</Muted>}</DetailRow>
                <DetailRow label="Favorite language">
                  {profile.favoriteLanguage ? (
                    <span className="inline-block rounded-full border border-ink-800 bg-ink-900 px-2.5 py-0.5 text-xs text-ink-300">
                      {languageLabel(profile.favoriteLanguage)}
                    </span>
                  ) : (
                    <Muted>No preference</Muted>
                  )}
                </DetailRow>
                <DetailRow label="GitHub">
                  {profile.githubUsername ? (
                    <a
                      href={`https://github.com/${profile.githubUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex max-w-full items-center gap-1.5 text-ink-100 transition-colors hover:text-white"
                    >
                      <GithubIcon className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                      <span className="truncate">{profile.githubUsername}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ink-600 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </a>
                  ) : (
                    <Muted>Not linked</Muted>
                  )}
                </DetailRow>
              </dl>
            )}

            <Expand open={editingDetails}>
              <div className="space-y-6 px-5 py-5">
                <div>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <span className="text-xs font-medium text-ink-300">Favorite language</span>
                    <span className="text-[11px] text-ink-600">Pre-selected when you create rooms</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {LANGUAGE_CHOICES.map((lang) => {
                      const active = languageDraft === lang.value;
                      return (
                        <button
                          key={lang.value || "none"}
                          type="button"
                          onClick={() => setLanguageDraft(lang.value)}
                          aria-pressed={active}
                          className={`h-8 rounded-full border px-3 text-xs transition-colors ${
                            active
                              ? "border-ink-100 bg-ink-100 text-ink-950"
                              : "border-ink-800 text-ink-400 hover:border-ink-600 hover:text-ink-100"
                          }`}
                        >
                          {lang.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="mb-2 block text-xs font-medium text-ink-300">GitHub</span>
                  <div className="flex h-11 items-center rounded-xl border border-ink-800 bg-ink-950 transition-colors focus-within:border-ink-500">
                    <span className="pl-3.5 text-sm text-ink-600">github.com/</span>
                    <input
                      value={githubDraft}
                      onChange={(e) => setGithubDraft(e.target.value)}
                      placeholder="octocat"
                      maxLength={39}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className="h-full min-w-0 flex-1 bg-transparent pr-3 text-sm text-ink-100 placeholder:text-ink-700 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <span className="text-xs font-medium text-ink-300">Bio</span>
                    <span className="text-[11px] tabular-nums text-ink-600">{bioDraft.length}/160</span>
                  </div>
                  <textarea
                    value={bioDraft}
                    onChange={(e) => setBioDraft(e.target.value.slice(0, 160))}
                    placeholder="Building things, learning as I go."
                    rows={3}
                    className="w-full resize-none rounded-xl border border-ink-800 bg-ink-950 px-3.5 py-3 text-sm text-ink-100 placeholder:text-ink-700 transition-colors focus:border-ink-500 focus:outline-none"
                  />
                </div>

                <SaveBar
                  onSave={handleSaveDetails}
                  onCancel={() => {
                    setBioDraft(profile.bio);
                    setLanguageDraft(profile.favoriteLanguage);
                    setGithubDraft(profile.githubUsername);
                    setEditingDetails(false);
                  }}
                  saving={savingDetails}
                />
              </div>
            </Expand>
          </Section>

          {/* ---------- Activity ---------- */}
          <Section title="Activity" delay={0.2}>
            <div className="grid grid-cols-2 gap-px bg-ink-900 sm:grid-cols-4">
              {stats.map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-ink-950 p-4 sm:p-5">
                  <div className="flex items-center gap-1.5 text-xs text-ink-500">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                  <p className="mt-2 truncate font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-ink-100">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </Section>

          {/* ---------- Rooms ---------- */}
          <Section
            title="Your rooms"
            description={rooms.length > 0 ? "Your most recently active rooms." : undefined}
            delay={0.26}
            action={
              rooms.length > 0 ? (
                <Link
                  href="/dashboard"
                  className="group inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs text-ink-400 transition-colors hover:text-ink-100"
                >
                  {rooms.length > ROOMS_PREVIEW_COUNT ? `View all ${rooms.length}` : "Open dashboard"}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ) : undefined
            }
          >
            {sortedRooms.length === 0 ? (
              <div className="flex flex-col items-center px-5 py-10 text-center">
                <p className="text-sm text-ink-400">No rooms yet.</p>
                <Link
                  href="/dashboard"
                  className="mt-3 text-sm text-ink-100 underline underline-offset-4 transition-colors hover:text-ink-300"
                >
                  Create one from your dashboard
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                {sortedRooms.slice(0, ROOMS_PREVIEW_COUNT).map((room) => (
                  <RoomCard
                    key={room._id}
                    room={room}
                    updatedLabel={`updated ${timeAgo(room.updatedAt)}`}
                    canDelete={false}
                    confirmingDelete={false}
                    onRequestDelete={() => {}}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* ---------- Account ---------- */}
          <Section title="Account" description="Email, password, and security are managed securely by Clerk." delay={0.32}>
            <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs text-ink-500">Signed in as</p>
                <p className="truncate text-sm text-ink-100">{email ?? "—"}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openUserProfile()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-800 px-4 text-sm text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-100"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Manage account
                </button>
                <button
                  type="button"
                  onClick={() => void signOut({ redirectUrl: "/" })}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm text-ink-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </main>
  );
}