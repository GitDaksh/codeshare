"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { useApi } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { AvatarIcon } from "@/components/AvatarIcon";
import { AvatarPicker } from "@/components/AvatarPicker";
import { GithubIcon } from "@/components/GithubIcon";
import { UsernameInput } from "@/components/UsernameInput";
import { LANGUAGES, getLanguageBadgeClasses } from "@/lib/languages";
import type { Profile } from "@/types/profile";
import type { Room } from "@/types/room";

export default function ProfilePage() {
  const api = useApi();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  // null = picker closed. While open, this holds the avatar being previewed,
  // so you can browse freely and only save when you're happy.
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

  if (loading || !profile) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <p className="text-sm text-ink-500">Loading profile…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="flex items-start gap-4">
        <button
          onClick={() => setAvatarDraft(avatarDraft === null ? profile.avatarId : null)}
          aria-label="Change avatar"
          className="group relative shrink-0"
        >
          <AvatarIcon avatarId={avatarDraft ?? profile.avatarId} className="h-16 w-16 rounded-full" />
          {/* Hover hint for mouse users */}
          <span className="absolute inset-0 hidden items-center justify-center rounded-full bg-black/50 text-[10px] font-medium text-ink-100 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:hover)]:flex">
            Change
          </span>
          {/* Always-visible edit badge for touch screens, where hover hints never appear */}
          <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink-950 bg-ink-100 text-ink-950 [@media(hover:hover)]:hidden">
            <Pencil className="h-3 w-3" />
          </span>
        </button>

        <div className="min-w-0 flex-1">
          {editingUsername ? (
            <div>
              <UsernameInput
                value={usernameDraft}
                onChange={setUsernameDraft}
                onValidityChange={setUsernameDraftValid}
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={handleSaveUsername}
                  disabled={!usernameDraftValid || savingUsername}
                  className="rounded-md bg-ink-100 px-3 py-1.5 text-xs font-medium text-ink-950 hover:bg-white disabled:opacity-50"
                >
                  {savingUsername ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => {
                    setUsernameDraft(profile.username);
                    setEditingUsername(false);
                  }}
                  className="px-2 py-1.5 text-xs text-ink-500 hover:text-ink-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditingUsername(true)}
              className="group flex max-w-full items-center gap-1.5"
            >
              <h1 className="truncate font-[family-name:var(--font-display)] text-lg font-semibold text-ink-100 sm:text-xl">
                @{profile.username}
              </h1>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-ink-600 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100" />
            </button>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
            <span>
              Member since{" "}
              {new Date(profile.createdAt).toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </span>
            <span>·</span>
            <span>
              {rooms.length} room{rooms.length === 1 ? "" : "s"}
            </span>
            {profile.githubUsername && (
              <>
                <span>·</span>
                
                  href={`https://github.com/${profile.githubUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-1 text-ink-400 transition-colors hover:text-ink-100"
                <a>
                  <GithubIcon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{profile.githubUsername}</span>
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      {avatarDraft !== null && (
        <div className="mt-6 rounded-lg border border-ink-800 p-4">
          <AvatarPicker value={avatarDraft} onChange={setAvatarDraft} />
          <div className="mt-4 flex justify-end gap-2 border-t border-ink-800 pt-4">
            <button
              onClick={() => setAvatarDraft(null)}
              className="rounded-md px-3 py-1.5 text-sm text-ink-400 transition-colors hover:text-ink-100"
            >
              Cancel
            </button>
            <button
              onClick={handleAvatarSave}
              disabled={savingAvatar}
              className="rounded-md bg-ink-100 px-4 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-white disabled:opacity-50"
            >
              {savingAvatar ? "Saving…" : "Save avatar"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 rounded-lg border border-ink-800 p-4">
        {editingDetails ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-ink-500">Favorite language</label>
              <select
                value={languageDraft}
                onChange={(e) => setLanguageDraft(e.target.value)}
                className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 focus:border-ink-500 focus:outline-none"
              >
                <option value="">No preference</option>
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-500">GitHub username</label>
              <input
                value={githubDraft}
                onChange={(e) => setGithubDraft(e.target.value)}
                placeholder="octocat"
                maxLength={39}
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-600 focus:border-ink-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-500">Bio</label>
              <textarea
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value.slice(0, 160))}
                rows={2}
                className="w-full resize-none rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 focus:border-ink-500 focus:outline-none"
              />
              <p className="mt-1 text-right text-xs text-ink-600">{bioDraft.length}/160</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveDetails}
                disabled={savingDetails}
                className="rounded-md bg-ink-100 px-3 py-1.5 text-xs font-medium text-ink-950 hover:bg-white"
              >
                {savingDetails ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => {
                  setBioDraft(profile.bio);
                  setLanguageDraft(profile.favoriteLanguage);
                  setGithubDraft(profile.githubUsername);
                  setEditingDetails(false);
                }}
                className="px-2 py-1.5 text-xs text-ink-500 hover:text-ink-100"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words text-sm text-ink-300">{profile.bio || "No bio yet."}</p>
              {profile.favoriteLanguage && (
                <span
                  className={`mt-2 inline-block rounded border px-1.5 py-0.5 text-xs ${getLanguageBadgeClasses(profile.favoriteLanguage)}`}
                >
                  {profile.favoriteLanguage}
                </span>
              )}
            </div>
            <button
              onClick={() => setEditingDetails(true)}
              className="shrink-0 py-1 text-xs text-ink-500 transition-colors hover:text-ink-100"
            >
              Edit details
            </button>
          </div>
        )}
      </div>

      <div className="mt-10">
        <h2 className="text-xs font-medium uppercase tracking-wide text-ink-500">
          Your rooms — {rooms.length}
        </h2>
        {sortedRooms.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">
            No rooms yet.{" "}
            <Link href="/dashboard" className="text-ink-100 underline underline-offset-4">
              Create one
            </Link>
            .
          </p>
        ) : (
          <div className="mt-3 divide-y divide-ink-800 rounded-lg border border-ink-800">
            {sortedRooms.map((room) => (
              <div key={room._id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink-100">{room.name}</span>
                    <span className={`rounded border px-1.5 py-0.5 text-xs ${getLanguageBadgeClasses(room.language)}`}>
                      {room.language}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-500">
                    updated {new Date(room.updatedAt).toLocaleDateString()}
                  </p>
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
        )}
      </div>
    </main>
  );
}