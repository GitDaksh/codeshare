"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useApi } from "@/lib/api";
import { DEFAULT_AVATAR_ID } from "@/lib/avatars";
import type { Profile } from "@/types/profile";

// Your name and avatar for solo games: your profile's when you're signed
// in, "You" otherwise.
export function useMe(): { name: string; avatarId: string } {
  const api = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const [me, setMe] = useState({ name: "You", avatarId: DEFAULT_AVATAR_ID });

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    api
      .get<Profile>("/api/profile")
      .then((res) => {
        if (!cancelled) setMe({ name: res.data.username || "You", avatarId: res.data.avatarId || DEFAULT_AVATAR_ID });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [api, isLoaded, isSignedIn]);

  return me;
}
