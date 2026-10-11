"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { AxiosInstance } from "axios";
import { useApi } from "@/lib/api";
import { readJson, useStoredJson, writeJson } from "@/lib/games/storage";
import type { GameId } from "@/lib/games/types";

// Personal bests, plays and wins. Signed in, they're saved to your account
// (and count for the leaderboards); signed out, they stay on this device.

export type GameStat = { best: number; plays: number; wins: number };
export type GameStats = Partial<Record<GameId, GameStat>>;

export type LeaderboardEntry = { rank: number; username: string; avatarId: string; value: number; you: boolean };
export type Leaderboard = { rankBy: "best" | "wins"; entries: LeaderboardEntry[] };

const LOCAL_KEY = "codeshare:games:stats";
const NONE: GameStats = {};

export function useGameStats() {
  const api = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const [local] = useStoredJson<GameStats>(LOCAL_KEY, NONE);
  const [remote, setRemote] = useState<GameStats | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    api
      .get<GameStats>("/api/games/stats")
      .then((res) => {
        if (!cancelled) setRemote(res.data);
      })
      .catch(() => {
        if (!cancelled) setRemote({});
      });
    return () => {
      cancelled = true;
    };
  }, [api, isLoaded, isSignedIn, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const stats = !isLoaded ? null : isSignedIn ? remote : local;
  return { stats, refresh };
}

export type RecordedResult = { best: number; newBest: boolean };

// Saves one finished game. `stat` is in the game's unit (WPM, points…).
export async function recordResult(
  api: AxiosInstance,
  signedIn: boolean,
  game: GameId,
  stat: number,
  won: boolean
): Promise<RecordedResult | null> {
  const score = Math.max(0, Math.round(stat));
  if (!signedIn) {
    const stats = { ...readJson<GameStats>(LOCAL_KEY, NONE) };
    const row = stats[game] ?? { best: 0, plays: 0, wins: 0 };
    const newBest = score > row.best;
    stats[game] = { best: Math.max(row.best, score), plays: row.plays + 1, wins: row.wins + (won ? 1 : 0) };
    writeJson(LOCAL_KEY, stats);
    return { best: stats[game]!.best, newBest };
  }
  try {
    // Solo games: wins only count online, where the server sees them end.
    const res = await api.post<RecordedResult>("/api/games/results", { game, score });
    return res.data;
  } catch {
    return null;
  }
}

export function useLeaderboard(game: GameId, refreshKey = 0) {
  const api = useApi();
  const { isLoaded } = useAuth();
  const [board, setBoard] = useState<Leaderboard | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    api
      .get<Leaderboard>(`/api/games/leaderboard/${game}`)
      .then((res) => {
        if (!cancelled) setBoard(res.data);
      })
      .catch(() => {
        if (!cancelled) setBoard({ rankBy: "best", entries: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [api, game, isLoaded, refreshKey]);

  return board;
}
