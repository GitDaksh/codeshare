"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { AvatarIcon } from "@/components/AvatarIcon";
import { AVATAR_IDS, DEFAULT_AVATAR_ID } from "@/lib/avatars";
import type { Profile } from "@/types/profile";

export default function ProfilePage() {
  const api = useApi();
  const { toast } = useToast();

  const [avatarId, setAvatarId] = useState(DEFAULT_AVATAR_ID);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Profile — CodeShare";
  }, []);

  useEffect(() => {
    api
      .get<Profile>("/api/profile")
      .then((res) => setAvatarId(res.data.avatarId))
      .catch(() => toast("Could not load your profile.", "error"))
      .finally(() => setLoading(false));
  }, [api]);

  async function handleSelect(id: string) {
    if (id === avatarId || saving) return;
    const previous = avatarId;
    setAvatarId(id);
    setSaving(true);
    try {
      await api.put<Profile>("/api/profile", { avatarId: id });
      toast("Avatar updated");
    } catch {
      setAvatarId(previous);
      toast("Could not update your avatar.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-ink-500">Loading profile…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 flex items-center gap-4">
        <AvatarIcon avatarId={avatarId} className="h-16 w-16 shrink-0 rounded-full" />
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink-100">
            Your avatar
          </h1>
          <p className="text-sm text-ink-500">
            Shows up next to your name in presence and chat.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3 sm:grid-cols-8">
        {AVATAR_IDS.map((id) => (
          <button
            key={id}
            onClick={() => handleSelect(id)}
            aria-label={`Select avatar ${id}`}
            aria-pressed={id === avatarId}
            className={`relative rounded-full transition-transform hover:scale-105 ${
              id === avatarId ? "ring-2 ring-ink-100 ring-offset-2 ring-offset-ink-950" : ""
            }`}
          >
            <AvatarIcon avatarId={id} className="h-full w-full rounded-full" />
          </button>
        ))}
      </div>
    </main>
  );
}