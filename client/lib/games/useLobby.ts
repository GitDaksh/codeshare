"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { io, type Socket } from "socket.io-client";
import type { GameId, MatchEvent, MatchInfo, Player, Settings, Standing } from "@/lib/games/types";

// A lobby with friends, live (server: sockets/games.ts). The server keeps
// everyone's moves in one numbered list; this hook mirrors it, and shows
// your own moves instantly (marked pending) until the server confirms them.

export type LobbyMember = { id: string; name: string; avatarId: string; seat: number; online: boolean };

type ServerMatch = {
  id: string;
  number: number;
  seed: number;
  settings: Settings;
  players: Player[];
  startAt: number;
  status: "playing" | "finished";
  standings: { id: string; score: number }[] | null;
};

export type LobbyState = {
  code: string;
  game: GameId;
  hostId: string;
  settings: Settings;
  status: "lobby" | "playing" | "finished";
  members: LobbyMember[];
  match: ServerMatch | null;
  wins: Record<string, number>;
};

export type Reaction = { id: string; by: string; emoji: string };

// How long a reaction floats up the screen.
const REACTION_MS = 2700;

export type LobbyError = "not-found" | "full" | "removed" | "left" | "slow-down" | "connection";

// Your saved result for a finished match (the server saves it once everyone
// agrees how it went).
export type Recorded = { matchId: string; best: number; newBest: boolean };

const PENDING_TTL_MS = 6000;

// One of your moves the server hasn't confirmed yet.
type PendingEvent = MatchEvent & { sentAt: number };

function clientId(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(8, "0");
}

export function useLobby(code: string) {
  const { getToken, userId } = useAuth();
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<LobbyError | null>(null);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [confirmed, setConfirmed] = useState<MatchEvent[]>([]);
  const [pending, setPending] = useState<PendingEvent[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [recorded, setRecorded] = useState<Recorded | null>(null);

  const socketRef = useRef<Socket | null>(null);
  // Server clock minus this browser's clock.
  const offsetRef = useRef(0);
  const matchRef = useRef<MatchInfo | null>(null);
  const confirmedRef = useRef<MatchEvent[]>([]);
  const getTokenRef = useRef(getToken);
  const userIdRef = useRef(userId);

  useEffect(() => {
    getTokenRef.current = getToken;
    userIdRef.current = userId;
  });

  useEffect(() => {
    let cancelled = false;
    const socket = io(process.env.NEXT_PUBLIC_API_URL!, {
      // A fresh sign-in token on every (re)connection, so a long session
      // reconnects fine after the first token expires.
      auth: (cb) => {
        getTokenRef
          .current({ skipCache: true })
          .then((token) => cb({ token }))
          .catch(() => cb({ token: null }));
      },
    });
    socketRef.current = socket;

    // Measures the gap between this browser's clock and the server's: the
    // reply with the shortest round trip is the most trustworthy.
    async function syncClock() {
      let best = { rtt: Infinity, offset: 0 };
      for (let i = 0; i < 5 && !cancelled; i++) {
        const sent = Date.now();
        const reply = await new Promise<{ now: number } | null>((resolve) => {
          const timer = setTimeout(() => resolve(null), 3000);
          socket.emit("games:ping", {}, (res: { now: number }) => {
            clearTimeout(timer);
            resolve(res);
          });
        });
        const received = Date.now();
        if (reply && received - sent < best.rtt) best = { rtt: received - sent, offset: reply.now - (sent + received) / 2 };
      }
      if (best.rtt < Infinity) offsetRef.current = best.offset;
    }

    // Joins the lobby. To catch up on a match it's already following, it
    // asks only for the moves it's missing.
    function join(catchUp = false) {
      const current = matchRef.current;
      const since = catchUp && current ? { matchId: current.id, since: confirmedRef.current.length } : {};
      socket.emit("games:join", { code, ...since }, (res: { ok: boolean; error?: LobbyError }) => {
        if (cancelled) return;
        if (res?.ok) {
          setJoined(true);
          setError(null);
        } else {
          setError(res?.error ?? "not-found");
        }
      });
    }

    socket.on("connect", async () => {
      setConnected(true);
      await syncClock();
      if (!cancelled) join();
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    socket.on("games:lobby", (snapshot: LobbyState) => {
      setLobby(snapshot);
    });

    socket.on("games:sync", ({ match: header, events, from = 0 }: { match: ServerMatch; events: MatchEvent[]; from?: number }) => {
      // The rest of a match this browser already has the start of.
      if (from > 0) {
        if (matchRef.current?.id !== header.id || from > confirmedRef.current.length) {
          join();
          return;
        }
        const next = [...confirmedRef.current.slice(0, from), ...events];
        confirmedRef.current = next;
        setConfirmed(next);
        const arrived = new Set(events.map((e) => e.cid).filter(Boolean));
        setPending((prev) => prev.filter((p) => !arrived.has(p.cid)));
        return;
      }
      const info: MatchInfo = {
        id: header.id,
        number: header.number,
        seed: header.seed,
        settings: header.settings,
        players: header.players,
        startAt: header.startAt - offsetRef.current,
      };
      matchRef.current = info;
      confirmedRef.current = events;
      setMatch(info);
      setConfirmed(events);
      setPending([]);
    });

    socket.on("games:event", ({ matchId, event }: { matchId: string; event: MatchEvent }) => {
      if (matchRef.current?.id !== matchId) return;
      const list = confirmedRef.current;
      if (event.seq < list.length) return;
      if (event.seq > list.length) {
        // A move went missing (a connection hiccup): ask for what's missing.
        join(true);
        return;
      }
      const next = [...list, event];
      confirmedRef.current = next;
      setConfirmed(next);
      if (event.cid) setPending((prev) => (prev.some((p) => p.cid === event.cid) ? prev.filter((p) => p.cid !== event.cid) : prev));
    });

    socket.on("games:reaction", (reaction: Reaction) => {
      setReactions((prev) => [...prev.slice(-30), reaction]);
      setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== reaction.id)), REACTION_MS);
    });

    socket.on("games:kicked", (payload: { reason?: string } | undefined) => {
      setError(payload?.reason === "left" ? "left" : "removed");
      setJoined(false);
    });

    socket.on("games:recorded", ({ matchId, results }: { matchId: string; results: Record<string, { best: number; newBest: boolean }> }) => {
      const mine = userIdRef.current ? results?.[userIdRef.current] : undefined;
      if (mine) setRecorded({ matchId, best: mine.best, newBest: mine.newBest });
    });

    return () => {
      cancelled = true;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code]);

  // Pending moves the server never confirmed are dropped after a while.
  useEffect(() => {
    if (pending.length === 0) return;
    const timer = setTimeout(() => {
      const cutoff = Date.now() - PENDING_TTL_MS;
      setPending((prev) => prev.filter((p) => p.sentAt > cutoff));
    }, PENDING_TTL_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  const now = useCallback(() => (matchRef.current ? Date.now() - matchRef.current.startAt : 0), []);

  const send = useCallback(
    (type: string, data?: unknown) => {
      const current = matchRef.current;
      const socket = socketRef.current;
      if (!current || !socket || !userId || !current.players.some((p) => p.id === userId)) return;
      const t = Date.now() - current.startAt;
      if (t < 0) return;
      const cid = clientId();
      const event: PendingEvent = { seq: -1, by: userId, type, data: data ?? null, t, cid, sentAt: Date.now() };
      setPending((prev) => [...prev, event]);
      socket.emit("games:act", { matchId: current.id, type, data: data ?? null, cid });
    },
    [userId]
  );

  const sendAs = useCallback(() => {}, []);

  const ask = useCallback(
    (event: string, data: unknown = {}) =>
      new Promise<{ ok: boolean; error?: string }>((resolve) => {
        const socket = socketRef.current;
        if (!socket) return resolve({ ok: false, error: "connection" });
        const timer = setTimeout(() => resolve({ ok: false, error: "connection" }), 5000);
        socket.emit(event, data, (res: { ok: boolean; error?: string }) => {
          clearTimeout(timer);
          resolve(res ?? { ok: false });
        });
      }),
    []
  );

  const start = useCallback(() => ask("games:start"), [ask]);
  const changeSettings = useCallback((settings: Settings) => ask("games:settings", { settings }), [ask]);
  const react = useCallback((emoji: string) => socketRef.current?.emit("games:react", { emoji }), []);
  const kick = useCallback((id: string) => socketRef.current?.emit("games:kick", { userId: id }), []);
  const endMatch = useCallback(() => socketRef.current?.emit("games:end", {}), []);
  const backToLobby = useCallback(() => socketRef.current?.emit("games:reset", {}), []);
  const leave = useCallback(() => {
    socketRef.current?.emit("games:leave", {});
  }, []);
  const done = useCallback((standings: Standing[]) => {
    const current = matchRef.current;
    if (!current) return;
    socketRef.current?.emit("games:done", {
      matchId: current.id,
      standings: standings.map((s) => (s.stat === undefined ? { id: s.id, score: s.score } : { id: s.id, score: s.score, stat: s.stat })),
    });
  }, []);

  const events = useMemo(() => (pending.length ? [...confirmed, ...pending] : confirmed), [confirmed, pending]);

  return {
    connected,
    joined,
    error,
    lobby,
    match,
    events,
    reactions,
    recorded,
    me: userId ?? null,
    isHost: !!lobby && !!userId && lobby.hostId === userId,
    now,
    send,
    sendAs,
    start,
    changeSettings,
    react,
    kick,
    endMatch,
    backToLobby,
    leave,
    done,
  };
}
