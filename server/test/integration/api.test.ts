import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GameScore } from "../../src/models/GameScore";
import { Message } from "../../src/models/Message";
import { Profile } from "../../src/models/Profile";
import { bearer, clearTestDb, connectTestDb, createRoom as newRoom, disconnectTestDb, startServer, users, type TestServer } from "../helpers";

let server: TestServer;

beforeAll(async () => {
  await connectTestDb();
  server = await startServer();
});
afterAll(async () => {
  await server.close();
  await disconnectTestDb();
});
beforeEach(clearTestDb);

const createRoom = (owner: string, body?: Record<string, unknown>) => newRoom(server, owner, body);

describe("health", () => {
  it("answers on / and reports the database on /health", async () => {
    expect((await server.api().get("/")).status).toBe(200);
    const health = await server.api().get("/health");
    expect(health.status).toBe(200);
    expect(health.body).toMatchObject({ status: "ok", database: "up" });
  });
});

describe("rooms API", () => {
  it("needs a signed-in user", async () => {
    expect((await server.api().get("/api/rooms")).status).toBe(401);
    expect((await server.api().post("/api/rooms").send({ name: "x" })).status).toBe(401);
  });

  it("creates a room for its owner, with both invite links", async () => {
    const [owner] = users("owner");
    const room = await createRoom(owner);
    expect(room.role).toBe("owner");
    expect(room.invites.edit).toMatch(/^[A-Za-z0-9]{16}$/);
    expect(room.invites.view).toMatch(/^[A-Za-z0-9]{16}$/);
    const mine = await server.api().get("/api/rooms").set(bearer(owner));
    expect(mine.body.map((r: { _id: string }) => r._id)).toContain(room._id);
  });

  it("validates new rooms", async () => {
    const [owner] = users("owner");
    expect((await server.api().post("/api/rooms").set(bearer(owner)).send({})).status).toBe(400);
    expect((await server.api().post("/api/rooms").set(bearer(owner)).send({ name: "x", language: "cobol" })).status).toBe(400);
    expect((await server.api().post("/api/rooms").set(bearer(owner)).send({ name: "x", code: "a".repeat(100_001) })).status).toBe(400);
  });

  it("hides a room from strangers, and lets invited viewers in without the invite links", async () => {
    const [owner, stranger, viewer] = users("owner", "stranger", "viewer");
    const room = await createRoom(owner);
    expect((await server.api().get(`/api/rooms/${room._id}`).set(bearer(stranger))).status).toBe(404);
    const viaLink = await server.api().get(`/api/rooms/${room._id}?invite=${room.invites.view}`).set(bearer(viewer));
    expect(viaLink.status).toBe(200);
    expect(viaLink.body.role).toBe("viewer");
    expect(viaLink.body.invites).toBeUndefined();
    // Remembered from then on, without the link.
    expect((await server.api().get(`/api/rooms/${room._id}`).set(bearer(viewer))).status).toBe(200);
  });

  it("answers 404 to strangers and 403 to members who try to rename or delete", async () => {
    const [owner, stranger, viewer] = users("owner", "stranger", "viewer");
    const room = await createRoom(owner);
    await server.api().get(`/api/rooms/${room._id}?invite=${room.invites.view}`).set(bearer(viewer));

    expect((await server.api().patch(`/api/rooms/${room._id}`).set(bearer(stranger)).send({ name: "x" })).status).toBe(404);
    expect((await server.api().delete(`/api/rooms/${room._id}`).set(bearer(stranger))).status).toBe(404);
    expect((await server.api().patch(`/api/rooms/${room._id}`).set(bearer(viewer)).send({ name: "x" })).status).toBe(403);
    expect((await server.api().delete(`/api/rooms/${room._id}`).set(bearer(viewer))).status).toBe(403);

    const renamed = await server.api().patch(`/api/rooms/${room._id}`).set(bearer(owner)).send({ name: "Trees" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe("Trees");
    expect((await server.api().delete(`/api/rooms/${room._id}`).set(bearer(owner))).status).toBe(204);
    expect((await server.api().get(`/api/rooms/${room._id}`).set(bearer(owner))).status).toBe(404);
  });

  it("returns the newest chat messages to people in the room only", async () => {
    const [owner, stranger] = users("owner", "stranger");
    const room = await createRoom(owner);
    await Message.create([
      { roomId: room._id, senderId: `user_${owner}`, senderName: owner, text: "first" },
      { roomId: room._id, senderId: `user_${owner}`, senderName: owner, text: "second" },
    ]);
    const res = await server.api().get(`/api/rooms/${room._id}/messages`).set(bearer(owner));
    expect(res.status).toBe(200);
    expect(res.body.map((m: { text: string }) => m.text).sort()).toEqual(["first", "second"]);
    expect((await server.api().get(`/api/rooms/${room._id}/messages`).set(bearer(stranger))).status).toBe(404);
  });

  it("rate-limits room creation (10 at once) with a 429 and Retry-After", async () => {
    const [owner] = users("owner");
    for (let i = 0; i < 10; i++) await createRoom(owner, { name: `Room ${i}` });
    const res = await server.api().post("/api/rooms").set(bearer(owner)).send({ name: "One too many" });
    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBe("10");
  });
});

describe("usernames", () => {
  it("turns away offensive and site-like usernames", async () => {
    const [user] = users("user");
    const check = await server.api().get("/api/profile/username-available?username=admin").set(bearer(user));
    expect(check.body).toEqual({ available: false, reason: "not-allowed" });
    const save = await server.api().put("/api/profile").set(bearer(user)).send({ username: "sh1t_lord" });
    expect(save.status).toBe(400);
    const fine = await server.api().put("/api/profile").set(bearer(user)).send({ username: `ok_${user}`.toLowerCase().slice(0, 20) });
    expect(fine.status).toBe(200);
  });
});

describe("leaderboards", () => {
  it("marks solo bests unverified and bests from games with friends verified", async () => {
    const [solo, friend] = users("solo", "friend");
    await Profile.create({ clerkUserId: `user_${solo}`, username: `solo_${solo}`.toLowerCase().slice(0, 20), avatarId: "codeshare" });
    await Profile.create({ clerkUserId: `user_${friend}`, username: `pal_${friend}`.toLowerCase().slice(0, 20), avatarId: "codeshare" });
    const posted = await server.api().post("/api/games/results").set(bearer(solo)).send({ game: "byte-snake", score: 500 });
    expect(posted.status).toBe(200);
    await GameScore.create({ userId: `user_${friend}`, game: "byte-snake", best: 900, bestVerified: true, bestAt: new Date(), plays: 1 });

    const board = await server.api().get("/api/games/leaderboard/byte-snake");
    expect(board.status).toBe(200);
    const byValue = Object.fromEntries(board.body.entries.map((e: { value: number; verified: boolean }) => [e.value, e.verified]));
    expect(byValue).toEqual({ 900: true, 500: false });
  });

  it("refuses solo scores above the game's maximum", async () => {
    const [player] = users("player");
    const res = await server.api().post("/api/games/results").set(bearer(player)).send({ game: "code-racer", score: 100_000 });
    expect(res.status).toBe(400);
  });

  it("shows a name the username filter would refuse as anonymous", async () => {
    const [player] = users("player");
    await Profile.collection.insertOne({ clerkUserId: `user_${player}`, username: "fuck_this", avatarId: "codeshare", createdAt: new Date(), updatedAt: new Date() });
    await GameScore.create({ userId: `user_${player}`, game: "bit-flip", best: 42, bestAt: new Date(), plays: 1 });
    const board = await server.api().get("/api/games/leaderboard/bit-flip");
    expect(board.body.entries.map((e: { username: string }) => e.username)).toEqual(["anonymous"]);
  });
});
