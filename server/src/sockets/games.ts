import type { Server, Socket } from "socket.io";
import { randomBytes, randomInt } from "crypto";
import { Profile } from "../models/Profile";
import { limiter, type Limiter } from "../lib/rateLimit";
import { GAMES, LOBBY_CODE, newLobbyCode, normalizeSettings, type Settings } from "../lib/games";
import { saveResult, type SavedResult } from "../lib/gameResults";

// Games with friends. A lobby is a short code people join; the host starts
// a match, and from then on the server's job is small and strict: it puts
// every move from every player into one shared, numbered list stamped with
// the match's own clock, and sends it to everyone. The games run in the
// browsers, and since they all apply the same moves in the same order, they
// all compute the same game. When a match ends, the server saves everyone's
// result, but only if every player still in it reported the same outcome.
// Lobbies live in memory (there's one server); nothing about them needs to
// survive a restart.

const DEFAULT_AVATAR_ID = "codeshare";
// From "Start" to the first move: the 3-2-1 countdown.
const COUNTDOWN_MS = 3600;
// Someone who drops out (a refresh, a flaky connection) keeps their seat
// this long.
const RECONNECT_GRACE_MS = 45_000;
// Lobbies nobody ever joined go after a couple of minutes, lobbies nobody
// is in after ten, and every lobby after half a day.
const UNJOINED_LOBBY_MS = 2 * 60_000;
const EMPTY_LOBBY_MS = 10 * 60_000;
const MAX_LOBBY_AGE_MS = 12 * 60 * 60_000;
const MAX_LOBBIES = 5000;
// Open lobbies one person can host at a time.
const MAX_LOBBIES_PER_HOST = 4;
// Per match: plenty for a long race (progress is sent a few times a second).
const MAX_EVENTS = 12_000;
// Moves kept across every match at once, so memory stays bounded however
// many matches are going.
const MAX_STORED_EVENTS = 100_000;
const EVENT_TYPE = /^[a-z][a-z0-9-]{0,23}$/;
const CLIENT_ID = /^[A-Za-z0-9]{4,16}$/;
// A move's details: a few short, flat fields (numbers, words), never nested.
const DATA_KEY = /^[A-Za-z][A-Za-z0-9]{0,11}$/;
const MAX_DATA_KEYS = 6;
const MAX_DATA_TEXT = 64;
const REACTIONS = new Set(["👏", "🔥", "😂", "😮", "🎉", "💀", "👀", "❤️"]);

const LIMITS: Record<string, Limiter> = {
  "games:join": limiter(10, 1),
  "games:leave": limiter(10, 1),
  "games:settings": limiter(20, 4),
  "games:start": limiter(6, 0.5),
  "games:act": limiter(80, 30),
  "games:done": limiter(10, 2),
  "games:end": limiter(6, 0.5),
  "games:reset": limiter(10, 1),
  "games:react": limiter(10, 2),
  "games:kick": limiter(10, 1),
  "games:ping": limiter(20, 5),
};

type Member = {
  userId: string;
  name: string;
  avatarId: string;
  seat: number;
  sockets: Set<string>;
  offlineSince: number | null;
};

type MatchPlayer = { id: string; name: string; avatarId: string; seat: number };

type EventData = Record<string, string | number | boolean | null>;

type MatchEvent = { seq: number; by: string; type: string; data: EventData | null; t: number; cid?: string };

// `score` orders the players; `stat` is what counts toward a personal best.
type Standing = { id: string; score: number; stat?: number };

type Match = {
  id: string;
  number: number;
  seed: number;
  settings: Settings;
  players: MatchPlayer[];
  startAt: number;
  events: MatchEvent[];
  status: "playing" | "finished";
  // What each player's browser says the outcome was.
  reports: Map<string, { key: string; standings: Standing[] }>;
  // Players who left mid-match.
  left: Set<string>;
  standings: Standing[] | null;
  timer: NodeJS.Timeout | null;
};

type Lobby = {
  code: string;
  game: string;
  hostId: string;
  settings: Settings;
  members: Map<string, Member>;
  match: Match | null;
  matches: number;
  // Matches won in this lobby, for the "this session" scoreboard.
  wins: Map<string, number>;
  // People the host removed; they can't come back in.
  banned: Set<string>;
  createdAt: number;
  joinedOnce: boolean;
  emptySince: number | null;
};

const lobbies = new Map<string, Lobby>();
let storedEvents = 0;
let server: Server | null = null;

export function setGameServer(io: Server) {
  server = io;
}

function allowed(socket: Socket, event: string): boolean {
  return LIMITS[event].take(socket.data.userId as string);
}

function payloadOf<T extends object>(data: unknown): Partial<T> {
  return data && typeof data === "object" && !Array.isArray(data) ? (data as Partial<T>) : {};
}

const has = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);

// Acknowledgements are optional for clients; never call one that isn't there.
function reply(ack: unknown, body: Record<string, unknown>) {
  if (typeof ack === "function") ack(body);
}

const channel = (code: string) => `game:${code}`;

function onlineMembers(lobby: Lobby): Member[] {
  return [...lobby.members.values()].filter((m) => m.sockets.size > 0).sort((a, b) => a.seat - b.seat);
}

// A move's details, copied field by field (or `undefined` if they aren't a
// few short, flat fields). Stops at the first bad field, so a huge payload
// costs almost nothing to turn away.
function cleanData(body: unknown): EventData | null | undefined {
  if (body === undefined || body === null) return null;
  if (typeof body !== "object" || Array.isArray(body)) return undefined;
  const data: EventData = {};
  let count = 0;
  for (const key in body as Record<string, unknown>) {
    if (!has(body, key)) continue;
    if (++count > MAX_DATA_KEYS || !DATA_KEY.test(key)) return undefined;
    const value = (body as Record<string, unknown>)[key];
    if (value === null || typeof value === "boolean") data[key] = value;
    else if (typeof value === "number" && Number.isFinite(value)) data[key] = value;
    else if (typeof value === "string" && value.length <= MAX_DATA_TEXT) data[key] = value;
    else return undefined;
  }
  return data;
}

// ---------- Lobbies ----------

// A match's moves stop counting toward the limit once it's replaced.
function dropMatch(lobby: Lobby) {
  const match = lobby.match;
  if (!match) return;
  storedEvents -= match.events.length;
  if (match.timer) clearTimeout(match.timer);
  match.timer = null;
  lobby.match = null;
}

function deleteLobby(lobby: Lobby) {
  dropMatch(lobby);
  lobbies.delete(lobby.code);
}

// Called by the API (POST /api/games/lobbies): the host joins it right after.
export function createLobby(hostId: string, game: string, settings: unknown): { code: string } | { error: "busy" | "too-many" } {
  const hosted = [...lobbies.values()].filter((l) => l.hostId === hostId).sort((a, b) => a.createdAt - b.createdAt);
  if (hosted.length >= MAX_LOBBIES_PER_HOST) {
    // Make room by closing their oldest lobby nobody is in.
    const idle = hosted.find((l) => onlineMembers(l).length === 0 && l.match?.status !== "playing");
    if (!idle) return { error: "too-many" };
    deleteLobby(idle);
  }
  if (lobbies.size >= MAX_LOBBIES) return { error: "busy" };
  let code = newLobbyCode();
  while (lobbies.has(code)) code = newLobbyCode();
  lobbies.set(code, {
    code,
    game,
    hostId,
    settings: normalizeSettings(game, settings),
    members: new Map(),
    match: null,
    matches: 0,
    wins: new Map(),
    banned: new Set(),
    createdAt: Date.now(),
    joinedOnce: false,
    emptySince: Date.now(),
  });
  return { code };
}

function status(lobby: Lobby): "lobby" | "playing" | "finished" {
  return lobby.match ? lobby.match.status : "lobby";
}

function matchHeader(match: Match) {
  return {
    id: match.id,
    number: match.number,
    seed: match.seed,
    settings: match.settings,
    players: match.players,
    startAt: match.startAt,
    status: match.status,
    standings: match.standings,
  };
}

function snapshot(lobby: Lobby) {
  return {
    code: lobby.code,
    game: lobby.game,
    hostId: lobby.hostId,
    settings: lobby.settings,
    status: status(lobby),
    members: [...lobby.members.values()]
      .sort((a, b) => a.seat - b.seat)
      .map((m) => ({ id: m.userId, name: m.name, avatarId: m.avatarId, seat: m.seat, online: m.sockets.size > 0 })),
    match: lobby.match ? matchHeader(lobby.match) : null,
    wins: Object.fromEntries(lobby.wins),
    now: Date.now(),
  };
}

function broadcastLobby(lobby: Lobby) {
  server?.to(channel(lobby.code)).emit("games:lobby", snapshot(lobby));
}

// The host's seat passes to whoever has been here longest (online first).
function ensureHost(lobby: Lobby) {
  const host = lobby.members.get(lobby.hostId);
  if (host && (host.sockets.size > 0 || host.offlineSince !== null)) return;
  const next = onlineMembers(lobby)[0] ?? [...lobby.members.values()].sort((a, b) => a.seat - b.seat)[0];
  if (next) lobby.hostId = next.userId;
}

function freeSeat(lobby: Lobby): number {
  const taken = new Set([...lobby.members.values()].map((m) => m.seat));
  let seat = 0;
  while (taken.has(seat)) seat++;
  return seat;
}

function pushEvent(lobby: Lobby, match: Match, event: MatchEvent) {
  match.events.push(event);
  storedEvents += 1;
  server?.to(channel(lobby.code)).emit("games:event", { matchId: match.id, event });
}

// A move from the server itself (someone left), in the same list.
function systemEvent(lobby: Lobby, type: string, data: EventData) {
  const match = lobby.match;
  if (!match || match.status !== "playing" || match.events.length >= MAX_EVENTS) return;
  pushEvent(lobby, match, { seq: match.events.length, by: "system", type, data, t: Math.max(0, Date.now() - match.startAt) });
}

function removeMember(lobby: Lobby, userId: string) {
  const member = lobby.members.get(userId);
  if (!member) return;
  lobby.members.delete(userId);
  const match = lobby.match;
  if (match?.status === "playing" && match.players.some((p) => p.id === userId)) {
    match.left.add(userId);
    systemEvent(lobby, "left", { id: userId });
    maybeFinish(lobby);
  }
  ensureHost(lobby);
  if (lobby.members.size === 0) lobby.emptySince = Date.now();
}

// The outcome every player still in the match agrees on (null if they
// don't agree, or nobody said).
function agreedStandings(match: Match): Standing[] | null {
  let agreed: { key: string; standings: Standing[] } | null = null;
  for (const player of match.players) {
    if (match.left.has(player.id)) continue;
    const report = match.reports.get(player.id);
    if (!report) continue;
    if (agreed && agreed.key !== report.key) return null;
    agreed = report;
  }
  return agreed ? [...agreed.standings].sort((a, b) => b.score - a.score) : null;
}

// Saves everyone's result once the match is over, then tells the lobby
// (your new personal best, if it is one).
async function recordMatch(lobby: Lobby, match: Match, standings: Standing[]) {
  const winner = standings.length > 1 && standings[0].score > standings[1].score ? standings[0].id : null;
  const results: Record<string, SavedResult> = {};
  await Promise.all(
    standings.map(async (s) => {
      try {
        results[s.id] = await saveResult(s.id, lobby.game, s.stat ?? null, s.id === winner);
      } catch (err) {
        console.error("Could not save a game result:", err);
      }
    })
  );
  server?.to(channel(lobby.code)).emit("games:recorded", { matchId: match.id, results });
}

type EndReason = "done" | "timeout" | "host";

function finish(lobby: Lobby, reason: EndReason) {
  const match = lobby.match;
  if (!match || match.status !== "playing") return;
  match.status = "finished";
  if (match.timer) clearTimeout(match.timer);
  match.timer = null;
  const standings = reason === "host" ? null : agreedStandings(match);
  match.standings = standings;
  if (standings) {
    // A clear winner (no tie for first) gets a win for this session.
    if (standings.length > 1 && standings[0].score > standings[1].score) {
      const winner = standings[0].id;
      lobby.wins.set(winner, (lobby.wins.get(winner) ?? 0) + 1);
    }
    void recordMatch(lobby, match, standings);
  }
  broadcastLobby(lobby);
}

// The match is over once every player still in it has said so (someone who
// dropped out is waited for until they're back or their seat goes).
function maybeFinish(lobby: Lobby) {
  const match = lobby.match;
  if (!match || match.status !== "playing") return;
  const waiting = match.players.some((p) => {
    const member = lobby.members.get(p.id);
    return member && !match.left.has(p.id) && !match.reports.has(p.id) && (member.sockets.size > 0 || member.offlineSince !== null);
  });
  if (!waiting) finish(lobby, "done");
}

// A full, valid set of standings for this match (every player once).
function validStandings(lobby: Lobby, match: Match, value: unknown): Standing[] | null {
  if (!Array.isArray(value) || value.length !== match.players.length) return null;
  const ids = new Set(match.players.map((p) => p.id));
  const max = GAMES[lobby.game].maxScore;
  const seen = new Set<string>();
  const standings: Standing[] = [];
  for (const entry of value) {
    const { id, score, stat } = payloadOf<Standing>(entry);
    if (typeof id !== "string" || !ids.has(id) || seen.has(id)) return null;
    if (typeof score !== "number" || !Number.isFinite(score)) return null;
    if (stat !== undefined && stat !== null && (typeof stat !== "number" || !Number.isFinite(stat) || stat < 0 || stat > max)) return null;
    seen.add(id);
    standings.push(typeof stat === "number" ? { id, score, stat } : { id, score });
  }
  return standings;
}

async function identify(socket: Socket) {
  if (socket.data.userName) return;
  try {
    const profile = await Profile.findOne({ clerkUserId: socket.data.userId });
    socket.data.userName = profile?.username || "Anonymous";
    socket.data.userAvatarId = profile?.avatarId || DEFAULT_AVATAR_ID;
  } catch {
    socket.data.userName = "Anonymous";
    socket.data.userAvatarId = DEFAULT_AVATAR_ID;
  }
}

// This socket's lobby, if the socket is (still) a member of it.
function lobbyOf(socket: Socket): { lobby: Lobby; member: Member } | null {
  const code = socket.data.gameCode as string | undefined;
  const lobby = code ? lobbies.get(code) : undefined;
  const member = lobby?.members.get(socket.data.userId as string);
  if (!lobby || !member || !member.sockets.has(socket.id)) return null;
  return { lobby, member };
}

function leaveLobby(socket: Socket, explicit: boolean) {
  const code = socket.data.gameCode as string | undefined;
  socket.data.gameCode = undefined;
  if (!code) return;
  socket.leave(channel(code));
  const lobby = lobbies.get(code);
  const member = lobby?.members.get(socket.data.userId as string);
  if (!lobby || !member) return;
  member.sockets.delete(socket.id);
  if (explicit) {
    // Leaving on purpose (in any tab) gives the seat up right away; the
    // person's other tabs are told.
    for (const id of member.sockets) {
      const other = server?.sockets.sockets.get(id);
      if (!other) continue;
      other.leave(channel(code));
      other.data.gameCode = undefined;
      other.emit("games:kicked", { code, reason: "left" });
    }
    member.sockets.clear();
    removeMember(lobby, member.userId);
  } else if (member.sockets.size === 0) {
    member.offlineSince = Date.now();
    const userId = member.userId;
    setTimeout(() => {
      const current = lobbies.get(code);
      const gone = current?.members.get(userId);
      if (!current || !gone || gone.sockets.size > 0 || gone.offlineSince === null) return;
      if (Date.now() - gone.offlineSince < RECONNECT_GRACE_MS) return;
      removeMember(current, userId);
      broadcastLobby(current);
    }, RECONNECT_GRACE_MS + 50).unref();
    ensureHost(lobby);
  }
  broadcastLobby(lobby);
}

// The socket disconnected (closed the tab, lost the connection).
export function leaveGames(socket: Socket) {
  leaveLobby(socket, false);
}

export function registerGameEvents(socket: Socket) {
  socket.on("games:ping", (_data: unknown, ack: unknown) => {
    if (!allowed(socket, "games:ping")) return;
    reply(ack, { now: Date.now() });
  });

  // Joining (or rejoining). Someone who already has the start of the match's
  // moves sends `since` (how many they have) and gets only the rest.
  socket.on("games:join", async (data: unknown, ack: unknown) => {
    if (!allowed(socket, "games:join")) return reply(ack, { ok: false, error: "slow-down" });
    const { code, matchId, since } = payloadOf<{ code: string; matchId: string; since: number }>(data);
    if (typeof code !== "string" || !LOBBY_CODE.test(code)) return reply(ack, { ok: false, error: "not-found" });
    await identify(socket);
    // The tab may have closed while we looked them up.
    if (!socket.connected) return;
    const lobby = lobbies.get(code);
    if (!lobby) return reply(ack, { ok: false, error: "not-found" });

    const userId = socket.data.userId as string;
    if (lobby.banned.has(userId)) return reply(ack, { ok: false, error: "removed" });
    let member = lobby.members.get(userId);
    if (!member) {
      if (lobby.members.size >= GAMES[lobby.game].maxPlayers) return reply(ack, { ok: false, error: "full" });
      member = {
        userId,
        name: socket.data.userName as string,
        avatarId: socket.data.userAvatarId as string,
        seat: freeSeat(lobby),
        sockets: new Set(),
        offlineSince: null,
      };
      lobby.members.set(userId, member);
    }
    if (socket.data.gameCode && socket.data.gameCode !== code) leaveLobby(socket, false);
    member.sockets.add(socket.id);
    member.offlineSince = null;
    lobby.joinedOnce = true;
    lobby.emptySince = null;
    socket.data.gameCode = code;
    socket.join(channel(code));
    ensureHost(lobby);

    reply(ack, { ok: true });
    const match = lobby.match;
    if (match) {
      const from = matchId === match.id && typeof since === "number" && Number.isInteger(since) && since >= 0 && since <= match.events.length ? since : 0;
      socket.emit("games:sync", { match: matchHeader(match), events: from ? match.events.slice(from) : match.events, from });
    }
    broadcastLobby(lobby);
  });

  socket.on("games:leave", () => {
    if (!allowed(socket, "games:leave")) return;
    leaveLobby(socket, true);
  });

  socket.on("games:settings", (data: unknown, ack: unknown) => {
    if (!allowed(socket, "games:settings")) return;
    const here = lobbyOf(socket);
    if (!here || here.lobby.hostId !== here.member.userId) return reply(ack, { ok: false, error: "not-host" });
    if (status(here.lobby) === "playing") return reply(ack, { ok: false, error: "playing" });
    const { settings } = payloadOf<{ settings: unknown }>(data);
    const given = payloadOf<Record<string, unknown>>(settings);
    // Only the game's own settings are read; nothing else is copied.
    const next: Record<string, unknown> = { ...here.lobby.settings };
    for (const key of Object.keys(GAMES[here.lobby.game].settings)) if (has(given, key)) next[key] = given[key];
    here.lobby.settings = normalizeSettings(here.lobby.game, next);
    reply(ack, { ok: true });
    broadcastLobby(here.lobby);
  });

  socket.on("games:start", (_data: unknown, ack: unknown) => {
    if (!allowed(socket, "games:start")) return;
    const here = lobbyOf(socket);
    if (!here) return reply(ack, { ok: false, error: "not-found" });
    const { lobby, member } = here;
    if (lobby.hostId !== member.userId) return reply(ack, { ok: false, error: "not-host" });
    if (status(lobby) === "playing") return reply(ack, { ok: false, error: "playing" });
    const rules = GAMES[lobby.game];
    const players = onlineMembers(lobby).slice(0, rules.maxPlayers);
    if (players.length < rules.minPlayers) return reply(ack, { ok: false, error: "need-players" });

    dropMatch(lobby);
    const match: Match = {
      id: randomBytes(6).toString("hex"),
      number: ++lobby.matches,
      seed: randomInt(1, 2 ** 31 - 1),
      settings: { ...lobby.settings },
      players: players.map((m) => ({ id: m.userId, name: m.name, avatarId: m.avatarId, seat: m.seat })),
      startAt: Date.now() + COUNTDOWN_MS,
      events: [],
      status: "playing",
      reports: new Map(),
      left: new Set(),
      standings: null,
      timer: null,
    };
    match.timer = setTimeout(() => {
      if (lobby.match === match) finish(lobby, "timeout");
    }, COUNTDOWN_MS + rules.maxMinutes * 60_000);
    match.timer.unref();
    lobby.match = match;
    reply(ack, { ok: true });
    server?.to(channel(lobby.code)).emit("games:sync", { match: matchHeader(match), events: [], from: 0 });
    broadcastLobby(lobby);
  });

  socket.on("games:act", (data: unknown) => {
    if (!allowed(socket, "games:act")) return;
    const here = lobbyOf(socket);
    const match = here?.lobby.match;
    if (!here || !match || match.status !== "playing") return;
    const { matchId, type, data: body, cid } = payloadOf<{ matchId: string; type: string; data: unknown; cid: string }>(data);
    if (matchId !== match.id || typeof type !== "string" || !EVENT_TYPE.test(type)) return;
    if (!match.players.some((p) => p.id === here.member.userId)) return;
    if (match.events.length >= MAX_EVENTS || storedEvents >= MAX_STORED_EVENTS) return;
    const t = Date.now() - match.startAt;
    // Nothing happens before "Go" (allowing for a little clock difference).
    if (t < -300) return;
    const clean = cleanData(body);
    if (clean === undefined) return;

    const event: MatchEvent = { seq: match.events.length, by: here.member.userId, type, data: clean, t: Math.max(0, t) };
    if (typeof cid === "string" && CLIENT_ID.test(cid)) event.cid = cid;
    pushEvent(here.lobby, match, event);
  });

  // A player's browser says the match is over, with the final standings
  // (the same in every browser, since they all ran the same moves).
  socket.on("games:done", (data: unknown) => {
    if (!allowed(socket, "games:done")) return;
    const here = lobbyOf(socket);
    const match = here?.lobby.match;
    if (!here || !match || match.status !== "playing" || Date.now() < match.startAt) return;
    const userId = here.member.userId;
    const { matchId, standings } = payloadOf<{ matchId: string; standings: unknown }>(data);
    if (matchId !== match.id || !match.players.some((p) => p.id === userId) || match.reports.has(userId)) return;
    const valid = validStandings(here.lobby, match, standings);
    if (!valid) return;
    const key = JSON.stringify([...valid].sort((a, b) => (a.id < b.id ? -1 : 1)).map((s) => [s.id, s.score, s.stat ?? null]));
    match.reports.set(userId, { key, standings: valid });
    maybeFinish(here.lobby);
  });

  // The host ends the match. If everyone still connected has finished (the
  // host is only waiting for someone who dropped out), their results count;
  // otherwise it's called off.
  socket.on("games:end", () => {
    if (!allowed(socket, "games:end")) return;
    const here = lobbyOf(socket);
    if (!here || here.lobby.hostId !== here.member.userId) return;
    const { lobby } = here;
    const match = lobby.match;
    const finishedHere =
      !!match &&
      match.players.every((p) => {
        const member = lobby.members.get(p.id);
        return !member || member.sockets.size === 0 || match.left.has(p.id) || match.reports.has(p.id);
      });
    finish(lobby, finishedHere ? "done" : "host");
  });

  // The host takes everyone back to the lobby (to change the settings).
  socket.on("games:reset", () => {
    if (!allowed(socket, "games:reset")) return;
    const here = lobbyOf(socket);
    if (!here || here.lobby.hostId !== here.member.userId || status(here.lobby) === "playing") return;
    dropMatch(here.lobby);
    broadcastLobby(here.lobby);
  });

  socket.on("games:react", (data: unknown) => {
    if (!allowed(socket, "games:react")) return;
    const here = lobbyOf(socket);
    const { emoji } = payloadOf<{ emoji: string }>(data);
    if (!here || typeof emoji !== "string" || !REACTIONS.has(emoji)) return;
    server?.to(channel(here.lobby.code)).emit("games:reaction", {
      id: randomBytes(4).toString("hex"),
      by: here.member.userId,
      emoji,
    });
  });

  socket.on("games:kick", (data: unknown) => {
    if (!allowed(socket, "games:kick")) return;
    const here = lobbyOf(socket);
    const { userId } = payloadOf<{ userId: string }>(data);
    if (!here || here.lobby.hostId !== here.member.userId || typeof userId !== "string" || userId === here.member.userId) return;
    const target = here.lobby.members.get(userId);
    if (!target) return;
    for (const id of target.sockets) {
      const other = server?.sockets.sockets.get(id);
      if (!other) continue;
      other.leave(channel(here.lobby.code));
      other.data.gameCode = undefined;
      other.emit("games:kicked", { code: here.lobby.code, reason: "removed" });
    }
    here.lobby.banned.add(userId);
    removeMember(here.lobby, userId);
    broadcastLobby(here.lobby);
  });
}

// Lobbies nobody joined, nobody is in, or that have been around for half a
// day, go away.
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const lobby of [...lobbies.values()]) {
    const unjoined = !lobby.joinedOnce && now - lobby.createdAt > UNJOINED_LOBBY_MS;
    const empty = lobby.emptySince !== null && now - lobby.emptySince > EMPTY_LOBBY_MS;
    if (unjoined || empty || now - lobby.createdAt > MAX_LOBBY_AGE_MS) deleteLobby(lobby);
  }
}, 60_000);
sweeper.unref();
