"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/api";
import type { Profile } from "@/types/profile";

export function useOnboardingGate() {
  const api = useApi();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let cancelled = false;

    api
      .get<Profile>("/api/profile")
      .then((res) => {
        if (cancelled) return;
        if (!res.data.username) {
          router.replace("/onboarding");
        } else {
          setProfile(res.data);
          setChecking(false);
        }
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [api, router]);

  return { checking, profile };
}