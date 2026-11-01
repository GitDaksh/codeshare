// Games with friends, start to finish: lobbies, matches, the shared move
// list, results and leaderboards. The tests run in order and share their
// players, like one long session.
import type { Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Profile } from "../../src/models/Profile";
import { bearer, clearTestDb, connectTestDb, disconnectTestDb, eventually, pause, startServer, type TestServer } from "../helpers";

type Member = { id: string; name: string; seat: number; online: boolean };
type Standing = { id: string; score: number; stat?: number };
type Match = { id: string; number: number; seed: number; startAt: number; settings: Record<string, unknown>; players: { id: string; name: string }[]; standings?: Standing[] | null };
type Lobby = { hostId: string; status: string; settings: Record<string, unknown>; members: Member[]; wins: Record<string, number>; match: Match | null };
type Move = { seq: number; by: string; type: string; t: number; cid?: string };
type Recorded = { matchId: string; results: Record<string, { best: number; newBest: boolean }> };

// A connected player and everything their browser has been told.
type Player = Socket & {
  lobby: Lobby | null;
  match: Match | null;
  events: Move[];
  reactions: { emoji: string; by: string }[];
  recorded: Recorded[];
  kicked: boolean;
  kickReason: string | null;
  lastFrom: number | null;
};

let server: TestServer;

async function player(user: string): Promise<Player> {
  const s = (await server.connect(user)) as Player;
  Object.assign(s, { lobby: null, match: null, events: [], reactions: [], recorded: [], kicked: false, kickReason: null, lastFrom: null });
  s.on("games:lobby", (lobby: Lobby) => (s.lobby = lobby));
  s.on("games:sync", ({ match, events, from = 0 }: { match: Match; events: Move[]; from?: number }) => {
    s.lastFrom = from;
    s.match = match;
    s.events = from ? [...s.events.slice(0, from), ...events] : [...events];
  });
  s.on("games:event", ({ matchId, event }: { matchId: string; event: Move }) => {
    if (s.match?.id === matchId) s.events.push(event);
  });
  s.on("games:recorded", (recorded: Recorded) => s.recorded.push(recorded));
  s.on("games:reaction", (reaction: { emoji: string; by: string }) => s.reactions.push(reaction));
  s.on("games:kicked", (payload: { reason?: string } | undefined) => {
    s.kicked = true;
    s.kickReason = payload?.reason ?? null;
  });
  return s;
}

// An event the server answers (Socket.IO acknowledgement).
const ask = <T = { ok?: boolean; error?: string }>(s: Socket, event: string, data: unknown) =>
  new Promise<T>((resolve) => s.emit(event, data, resolve));

function api(user: string | null, method: "get" | "post" | "put", path: string, body?: unknown) {
  const req = server.api()[method](path);
  if (user) req.set(bearer(user));
  return body === undefined ? req : req.send(body as object);
}

const until = (check: () => boolean, ms = 3000) => eventually(() => expect(check()).toBe(true), ms);
const untilGo = (match: Match) => pause(Math.max(0, match.startAt - Date.now()) + 50);
const stats = async (user: string, game: string) => (await api(user, "get", "/api/games/stats")).body[game];

beforeAll(async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  await connectTestDb();
  await clearTestDb();
  server = await startServer();
  for (const name of ["alice", "bob", "carol", "dave", "erin"]) {
    await Profile.create({ clerkUserId: `user_${name}`, username: name, avatarId: "codeshare" });
  }
});
afterAll(async () => {
  await server.close();
  await disconnectTestDb();
  vi.restoreAllMocks();
});

describe("games with friends", () => {
  let code = "";
  let alice: Player, bob: Player, carol: Player;

  it("makes a lobby with a short code and cleaned-up settings", async () => {
    expect((await api(null, "post", "/api/games/lobbies", { game: "code-racer" })).status).toBe(401);
    expect((await api("alice", "post", "/api/games/lobbies", { game: "chess" })).status).toBe(400);
    const created = await api("alice", "post", "/api/games/lobbies", {
      game: "code-racer",
      settings: { language: "python", length: "nope", extra: 1 },
    });
    expect(created.status).toBe(201);
    code = created.body.code;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    alice = await player("alice");
    bob = await player("bob");
    const ping = await ask<{ now: number }>(alice, "games:ping", {});
    expect(Math.abs(ping.now - Date.now())).toBeLessThan(1000);
    expect((await ask(alice, "games:join", { code: "ZZZZZZ" })).error).toBe("not-found");
    expect((await ask(alice, "games:join", { code })).ok).toBe(true);
    await until(() => alice.lobby?.members.length === 1);
    // A bad value goes back to the default; unknown keys are dropped.
    expect(alice.lobby!.settings).toEqual({ language: "python", length: "medium" });
    expect(alice.lobby!.hostId).toBe("user_alice");
    expect((await ask(alice, "games:start", {})).error).toBe("need-players");
  });

  it("lets friends join, and only the host changes settings or starts", async () => {
    expect((await ask(bob, "games:join", { code })).ok).toBe(true);
    await until(() => alice.lobby?.members.length === 2 && bob.lobby?.members.length === 2);
    expect(bob.lobby!.members.map((m) => `${m.name}:${m.seat}:${m.online}`)).toEqual(["alice:0:true", "bob:1:true"]);

    expect((await ask(bob, "games:settings", { settings: { length: "long" } })).error).toBe("not-host");
    expect((await ask(alice, "games:settings", { settings: { length: "long" } })).ok).toBe(true);
    await until(() => bob.lobby?.settings.length === "long");
    expect(bob.lobby!.settings.language).toBe("python");
    expect((await ask(bob, "games:start", {})).error).toBe("not-host");
  });

  it("starts a match for everyone after a countdown and shares moves in one order", async () => {
    const startedAt = Date.now();
    expect((await ask(alice, "games:start", {})).ok).toBe(true);
    await until(() => !!alice.match && !!bob.match);
    const match = alice.match!;
    expect(bob.match!.id).toBe(match.id);
    expect(bob.match!.seed).toBe(match.seed);
    expect(bob.match!.settings.length).toBe("long");
    expect(bob.match!.players).toHaveLength(2);
    expect(Math.abs(match.startAt - (startedAt + 3600))).toBeLessThan(400);
    await until(() => alice.lobby?.status === "playing" && bob.lobby?.status === "playing");
    expect((await ask(alice, "games:settings", { settings: { length: "short" } })).error).toBe("playing");

    // Moves before "Go" don't count.
    alice.emit("games:act", { matchId: match.id, type: "progress", data: { i: 3 } });
    await pause(300);
    expect(alice.events).toHaveLength(0);

    await untilGo(match);
    alice.emit("games:act", { matchId: match.id, type: "progress", data: { i: 5 }, cid: "abc123" });
    bob.emit("games:act", { matchId: match.id, type: "progress", data: { i: 2 } });
    // Each of these is refused: a bad type, too big, nested, a list, too
    // many fields, or the wrong match.
    alice.emit("games:act", { matchId: match.id, type: "Bad Type", data: {} });
    alice.emit("games:act", { matchId: match.id, type: "big", data: { x: "y".repeat(2000) } });
    alice.emit("games:act", { matchId: match.id, type: "nested", data: { x: { y: 1 } } });
    alice.emit("games:act", { matchId: match.id, type: "list", data: [1, 2, 3] });
    alice.emit("games:act", { matchId: match.id, type: "objects", data: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, {}])) });
    alice.emit("games:act", { matchId: match.id, type: "wide", data: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 } });
    alice.emit("games:act", { matchId: "nope", type: "progress", data: {} });
    await until(() => alice.events.length >= 2 && bob.events.length >= 2);
    await pause(200);
    expect(alice.events.map((e) => e.seq)).toEqual([0, 1]);
    expect(bob.events).toEqual(alice.events);
    expect(alice.events.every((e) => e.by.startsWith("user_") && e.t >= 0 && e.t < 2000)).toBe(true);
    expect(alice.events.find((e) => e.by === "user_alice")?.cid).toBe("abc123");
    expect(alice.events.every((e) => e.type === "progress")).toBe(true);
  });

  it("catches up someone who joins mid-match, without letting them play", async () => {
    carol = await player("carol");
    await ask(carol, "games:join", { code });
    await until(() => carol.match?.id === alice.match?.id && carol.events.length === 2);
    carol.emit("games:act", { matchId: carol.match!.id, type: "progress", data: { i: 9 } });
    await pause(250);
    expect(alice.events).toHaveLength(2);

    // Rejoining with what you already have sends only the rest...
    await ask(carol, "games:join", { code, matchId: carol.match!.id, since: 1 });
    await until(() => carol.lastFrom === 1);
    expect(carol.events).toHaveLength(2);
    expect(carol.events[1].seq).toBe(1);
    // ...and everything if that doesn't add up.
    await ask(carol, "games:join", { code, matchId: carol.match!.id, since: 99 });
    await until(() => carol.lastFrom === 0);
    expect(carol.events).toHaveLength(2);
  });

  it("passes on allowed emoji reactions only", async () => {
    alice.emit("games:react", { emoji: "🔥" });
    alice.emit("games:react", { emoji: "<script>" });
    await until(() => bob.reactions.length >= 1);
    await pause(150);
    expect(bob.reactions).toEqual([expect.objectContaining({ emoji: "🔥", by: "user_alice" })]);
  });

  it("finishes when every player agrees, then saves results as verified", async () => {
    const matchId = alice.match!.id;
    const standings = [
      { id: "user_bob", score: 40, stat: 35 },
      { id: "user_alice", score: 90, stat: 80 },
    ];
    // Incomplete, or with an impossible stat: ignored.
    alice.emit("games:done", { matchId, standings: [standings[0]] });
    await pause(150);
    alice.emit("games:done", { matchId, standings: [{ id: "user_alice", score: 90, stat: 9999 }, standings[0]] });
    await pause(150);
    alice.emit("games:done", { matchId, standings });
    await pause(200);
    expect(alice.lobby!.status).toBe("playing");

    bob.emit("games:done", { matchId, standings: [...standings].reverse() });
    await until(() => alice.lobby?.status === "finished");
    expect(alice.lobby!.wins).toEqual({ user_alice: 1 });
    expect(alice.lobby!.match?.standings?.[0]?.id).toBe("user_alice");

    await until(() => alice.recorded.length === 1 && bob.recorded.length === 1);
    const saved = alice.recorded[0].results;
    expect(saved.user_alice).toMatchObject({ best: 80, newBest: true });
    expect(saved.user_bob).toMatchObject({ best: 35 });
    expect(await stats("alice", "code-racer")).toEqual({ best: 80, plays: 1, wins: 1 });
    expect(await stats("bob", "code-racer")).toEqual({ best: 35, plays: 1, wins: 0 });

    // Both browsers agreed, so both scores are verified on the leaderboard.
    const board = await api(null, "get", "/api/games/leaderboard/code-racer");
    expect(board.body.entries.map((e: { username: string; value: number; verified: boolean }) => [e.username, e.value, e.verified])).toEqual([
      ["alice", 80, true],
      ["bob", 35, true],
    ]);
  });

  it("ends a match without a result when the reports disagree", async () => {
    expect((await ask(alice, "games:start", {})).ok).toBe(true);
    await until(() => carol.match?.number === 2);
    const three = carol.match!;
    expect(three.players).toHaveLength(3);

    alice.emit("games:done", { matchId: three.id, standings: [{ id: "user_alice", score: 1 }, { id: "user_bob", score: 0 }, { id: "user_carol", score: 0 }] });
    await pause(200);
    expect(alice.lobby!.status).toBe("playing"); // reports during the countdown are ignored

    await untilGo(three);
    const honest = [{ id: "user_alice", score: 1, stat: 10 }, { id: "user_bob", score: 2, stat: 20 }, { id: "user_carol", score: 0, stat: 5 }];
    const cheat = [{ id: "user_alice", score: 9, stat: 90 }, { id: "user_bob", score: 2, stat: 20 }, { id: "user_carol", score: 0, stat: 5 }];
    alice.emit("games:done", { matchId: three.id, standings: cheat });
    bob.emit("games:done", { matchId: three.id, standings: honest });
    carol.emit("games:done", { matchId: three.id, standings: honest });
    await until(() => alice.lobby?.status === "finished");
    expect(alice.lobby!.match?.standings).toBeNull();
    expect(alice.lobby!.wins).toEqual({ user_alice: 1 });
    await pause(300);
    expect(await stats("alice", "code-racer")).toEqual({ best: 80, plays: 1, wins: 1 });
  });

  it("lets the host call a match off, reset the lobby and change settings", async () => {
    expect((await ask(alice, "games:start", {})).ok).toBe(true);
    await until(() => alice.match?.number === 3);
    alice.emit("games:end", {});
    await until(() => alice.lobby?.status === "finished");
    alice.emit("games:reset", {});
    await until(() => alice.lobby?.status === "lobby");
    expect(alice.lobby!.match).toBeNull();

    // Only the game's own keys are read (not junk, and not "__proto__").
    const settings = JSON.parse(`{"length":"short","junk":[${Array(1000).fill(1).join(",")}],"__proto__":{"x":1}}`);
    expect((await ask(alice, "games:settings", { settings })).ok).toBe(true);
    await until(() => alice.lobby?.settings.length === "short");
    expect(Object.keys(alice.lobby!.settings).sort()).toEqual(["language", "length"]);
  });

  it("lets the host remove someone, and passes the host role on when the host leaves", async () => {
    alice.emit("games:kick", { userId: "user_carol" });
    await until(() => carol.kicked && alice.lobby?.members.length === 2);
    expect((await ask(carol, "games:join", { code })).error).toBe("removed");

    const aliceTab = await player("alice");
    await ask(aliceTab, "games:join", { code });
    await pause(150);
    alice.emit("games:leave", {});
    await until(() => aliceTab.kicked);
    expect(aliceTab.kickReason).toBe("left");
    await until(() => bob.lobby?.members.length === 1);
    expect(bob.lobby!.hostId).toBe("user_bob");
    aliceTab.disconnect();
    alice.disconnect();
  });

  it("seats two in Four in a Row and saves an online win", async () => {
    alice = await player("alice");
    const duel = (await api("bob", "post", "/api/games/lobbies", { game: "four-in-a-row" })).body.code;
    await ask(bob, "games:join", { code: duel });
    expect((await ask(alice, "games:join", { code: duel })).ok).toBe(true);
    const dave = await player("dave");
    expect((await ask(dave, "games:join", { code: duel })).error).toBe("full");

    expect((await ask(bob, "games:start", {})).ok).toBe(true);
    await until(() => alice.match?.players.length === 2 && bob.match?.id === alice.match?.id);
    const match = bob.match!;
    await untilGo(match);
    const result = [{ id: "user_alice", score: 2, stat: 0 }, { id: "user_bob", score: 0, stat: 0 }];
    alice.emit("games:done", { matchId: match.id, standings: result });
    bob.emit("games:done", { matchId: match.id, standings: result });
    await until(() => bob.recorded.some((r) => r.matchId === match.id));
    expect(await stats("alice", "four-in-a-row")).toMatchObject({ wins: 1, plays: 1 });

    // A dropped connection keeps its seat, and is back on reconnecting.
    alice.disconnect();
    await until(() => bob.lobby?.members.find((m) => m.id === "user_alice")?.online === false);
    expect(bob.lobby!.members).toHaveLength(2);
    alice = await player("alice");
    await ask(alice, "games:join", { code: duel });
    await until(() => bob.lobby?.members.find((m) => m.id === "user_alice")?.online === true);
    expect(bob.lobby!.members).toHaveLength(2);
    dave.disconnect();
  });

  it("marks a score unverified when only one browser reported it", async () => {
    // Dave leaves mid-match, so Alice's browser is the only one that says
    // how it went.
    const keyword = (await api("alice", "post", "/api/games/lobbies", { game: "keyword" })).body.code;
    const dave = await player("dave");
    await ask(alice, "games:join", { code: keyword });
    await ask(dave, "games:join", { code: keyword });
    await until(() => alice.lobby?.members.length === 2);
    expect((await ask(alice, "games:start", {})).ok).toBe(true);
    await until(() => alice.match?.players.length === 2 && dave.match?.id === alice.match?.id);
    const match = alice.match!;
    await untilGo(match);
    dave.emit("games:leave", {});
    await until(() => alice.lobby?.members.length === 1);
    alice.emit("games:done", { matchId: match.id, standings: [{ id: "user_alice", score: 5, stat: 500 }, { id: "user_dave", score: 0, stat: 0 }] });
    await until(() => alice.recorded.some((r) => r.matchId === match.id));

    const board = await api(null, "get", "/api/games/leaderboard/keyword");
    const row = board.body.entries.find((e: { username: string }) => e.username === "alice");
    expect(row).toMatchObject({ value: 500, verified: false });
    dave.disconnect();
  });
});

describe("solo results and leaderboards", () => {
  it("keeps personal bests from solo games, unverified", async () => {
    expect((await api(null, "post", "/api/games/results", { game: "bit-flip", score: 10 })).status).toBe(401);
    expect((await api("alice", "post", "/api/games/results", { game: "bit-flip", score: 9999 })).status).toBe(400);
    const r1 = await api("alice", "post", "/api/games/results", { game: "bit-flip", score: 21, won: false });
    const r2 = await api("alice", "post", "/api/games/results", { game: "bit-flip", score: 17, won: true });
    const r3 = await api("alice", "post", "/api/games/results", { game: "bit-flip", score: 30, won: false });
    expect(r1.body).toMatchObject({ newBest: true, best: 21 });
    expect(r2.body).toMatchObject({ newBest: false, best: 21 });
    expect(r3.body).toMatchObject({ newBest: true, best: 30 });
    await api("bob", "post", "/api/games/results", { game: "bit-flip", score: 25 });
    // Solo games never add wins, whatever the browser says.
    expect(await stats("alice", "bit-flip")).toEqual({ best: 30, plays: 3, wins: 0 });

    const board = await api(null, "get", "/api/games/leaderboard/bit-flip");
    expect(board.status).toBe(200);
    expect(board.body.entries.map((e: { username: string; value: number; verified: boolean }) => [e.username, e.value, e.verified])).toEqual([
      ["alice", 30, false],
      ["bob", 25, false],
    ]);
    const mine = await api("bob", "get", "/api/games/leaderboard/bit-flip");
    expect(mine.body.entries.map((e: { username: string; you: boolean }) => [e.username, e.you])).toEqual([
      ["alice", false],
      ["bob", true],
    ]);
  });

  it("ranks Four in a Row by online wins only", async () => {
    await api("bob", "post", "/api/games/results", { game: "four-in-a-row", score: 3, won: true });
    await api("bob", "post", "/api/games/results", { game: "four-in-a-row", score: 3, won: true });
    const board = await api(null, "get", "/api/games/leaderboard/four-in-a-row");
    expect(board.body.rankBy).toBe("wins");
    expect(board.body.entries.map((e: { username: string; value: number; verified: boolean }) => [e.username, e.value, e.verified])).toEqual([
      ["alice", 1, true],
    ]);
    expect((await api(null, "get", "/api/games/leaderboard/nope")).status).toBe(404);
  });

  it("limits how many lobbies one person hosts at once", async () => {
    const tabs: Player[] = [];
    for (let i = 0; i < 4; i++) {
      const lobby = (await api("erin", "post", "/api/games/lobbies", { game: "bit-flip" })).body.code;
      const tab = await player("erin");
      await ask(tab, "games:join", { code: lobby });
      tabs.push(tab);
    }
    expect((await api("erin", "post", "/api/games/lobbies", { game: "bit-flip" })).status).toBe(429);
    tabs[0].disconnect();
    await pause(200);
    expect((await api("erin", "post", "/api/games/lobbies", { game: "bit-flip" })).status).toBe(201);
    for (const tab of tabs) tab.disconnect();
  });
});
