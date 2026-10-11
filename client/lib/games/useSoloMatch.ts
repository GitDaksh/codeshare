"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { randomSeed } from "@/lib/games/rng";
import type { MatchEvent, MatchInfo, Player, Settings } from "@/lib/games/types";

// The countdown before a solo game: 3, 2, 1, go.
export const SOLO_COUNTDOWN_MS = 3000;

// A match played in this browser alone (you, plus any computer players).
// Moves are numbered and timed here, the same way the server does online,
// so every game works the same in both modes.
export function useSoloMatch(settings: Settings, players: Player[]) {
  const make = useCallback(
    (number: number): MatchInfo => ({
      id: `solo-${number}-${Date.now().toString(36)}`,
      number,
      seed: randomSeed(),
      settings,
      players,
      startAt: Date.now() + SOLO_COUNTDOWN_MS,
    }),
    [settings, players]
  );

  const [match, setMatch] = useState<MatchInfo>(() => make(1));
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const startAtRef = useRef(match.startAt);
  const countRef = useRef(0);

  const append = useCallback((by: string, type: string, data: unknown) => {
    const t = Date.now() - startAtRef.current;
    if (t < 0) return;
    const event: MatchEvent = { seq: countRef.current++, by, type, data: data ?? null, t };
    setEvents((prev) => [...prev, event]);
  }, []);

  const me = players[0]?.id ?? "you";
  const send = useCallback((type: string, data?: unknown) => append(me, type, data), [append, me]);
  const sendAs = useCallback(
    (playerId: string, type: string, data?: unknown) => {
      if (players.some((p) => p.id === playerId && p.bot)) append(playerId, type, data);
    },
    [append, players]
  );

  const restart = useCallback(() => {
    setMatch((previous) => {
      const next = make(previous.number + 1);
      startAtRef.current = next.startAt;
      return next;
    });
    countRef.current = 0;
    setEvents([]);
  }, [make]);

  const now = useCallback(() => Date.now() - startAtRef.current, []);

  return useMemo(() => ({ match, events, me, send, sendAs, restart, now }), [match, events, me, send, sendAs, restart, now]);
}
