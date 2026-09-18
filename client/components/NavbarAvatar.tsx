"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/api";
import { AvatarIcon } from "@/components/AvatarIcon";
import { DEFAULT_AVATAR_ID } from "@/lib/avatars";
import type { Profile } from "@/types/profile";

export function NavbarAvatar() {
  const api = useApi();
  const [avatarId, setAvatarId] = useState(DEFAULT_AVATAR_ID);

  useEffect(() => {
    api
      .get<Profile>("/api/profile")
      .then((res) => setAvatarId(res.data.avatarId))
      .catch(() => {});
  }, [api]);

  return (
    <Link href="/profile" aria-label="Your profile" className="shrink-0">
      <AvatarIcon
        avatarId={avatarId}
        className="h-7 w-7 rounded-full transition-opacity hover:opacity-80"
      />
    </Link>
  );
}