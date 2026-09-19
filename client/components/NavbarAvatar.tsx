"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/api";
import { AvatarIcon } from "@/components/AvatarIcon";
import type { Profile } from "@/types/profile";

export function NavbarAvatar() {
  const api = useApi();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    api
      .get<Profile>("/api/profile")
      .then((res) => setProfile(res.data))
      .catch(() => {});
  }, [api]);

  if (!profile || !profile.username) return null;

  return (
    <Link
      href="/profile"
      className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-ink-900"
    >
      <AvatarIcon avatarId={profile.avatarId} className="h-7 w-7 rounded-full" />
      <span className="hidden text-sm text-ink-300 sm:inline">{profile.username}</span>
    </Link>
  );
}