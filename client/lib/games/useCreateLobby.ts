"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useApi } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import type { GameId, Settings } from "@/lib/games/types";

// "Play with friends": makes a lobby and opens it (sign in first if needed).
export function useCreateLobby() {
  const api = useApi();
  const router = useRouter();
  const { toast } = useToast();
  const { isSignedIn } = useAuth();
  const [creating, setCreating] = useState<GameId | null>(null);

  const create = useCallback(
    async (game: GameId, settings: Settings = {}) => {
      if (!isSignedIn) {
        router.push(`/sign-in?redirect_url=${encodeURIComponent(`/games/${game}`)}`);
        return;
      }
      setCreating(game);
      try {
        const res = await api.post<{ code: string }>("/api/games/lobbies", { game, settings });
        router.push(`/games/play/${res.data.code}`);
      } catch {
        toast("Couldn't start a game with friends. Try again.", "error");
        setCreating(null);
      }
    },
    [api, isSignedIn, router, toast]
  );

  return { create, creating };
}
