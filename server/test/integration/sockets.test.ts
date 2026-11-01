import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Message } from "../../src/models/Message";
import { Profile } from "../../src/models/Profile";
import { Room } from "../../src/models/Room";
import {
  bearer,
  clearTestDb,
  collect,
  connectTestDb,
  createRoom,
  disconnectTestDb,
  eventually,
  eventWhere,
  joinRoom,
  nextEvent,
  pause,
  sharedCode,
  startServer,
  typed,
  users,
  type TestServer,
} from "../helpers";

type PresenceUser = { socketId: string; userId: string; name: string; role: string };
type ChatMessage = { text: string; senderId: string; senderName: string };

let server: TestServer;

beforeAll(async () => {
  // The server logs every connection; keep the test output readable.
  vi.spyOn(console, "log").mockImplementation(() => {});
  await connectTestDb();
  server = await startServer();
});
afterAll(async () => {
  await server.close();
  await disconnectTestDb();
  vi.restoreAllMocks();
});
beforeEach(clearTestDb);

const without = (userId: string) => (people: PresenceUser[]) => !people.some((person) => person.userId === userId);
const including = (userId: string) => (people: PresenceUser[]) => people.some((person) => person.userId === userId);

describe("signing in", () => {
  it("turns away connections without a valid token", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(server.connect(null)).rejects.toThrow("No token provided");
    await expect(server.connect("someone", "not-a-real-token")).rejects.toThrow("Invalid or expired token");
    quiet.mockRestore();
  });
});

describe("joining rooms", () => {
  it("gives the owner, editors and viewers their roles", async () => {
    const [owner, editor, viewer] = users("owner", "editor", "viewer");
    const room = await createRoom(server, owner);
    expect(await joinRoom(await server.connect(owner), room._id)).toBe("owner");
    expect(await joinRoom(await server.connect(editor), room._id, room.invites.edit)).toBe("editor");
    expect(await joinRoom(await server.connect(viewer), room._id, room.invites.view)).toBe("viewer");
  });

  it("turns away strangers, and ignores what they send to the room", async () => {
    const [owner, stranger] = users("owner", "stranger");
    const room = await createRoom(server, owner);
    const o = await server.connect(owner);
    await joinRoom(o, room._id);
    const s = await server.connect(stranger);

    let denied = nextEvent(s, "room:denied");
    s.emit("room:join", { roomId: room._id });
    expect(await denied).toEqual({ roomId: room._id });
    denied = nextEvent(s, "room:denied");
    s.emit("room:join", { roomId: room._id, invite: "A".repeat(16) });
    expect(await denied).toEqual({ roomId: room._id });

    const seen = [...["chat:message", "typing", "collab:update", "language:update", "run:result", "access:requests"]].map((event) =>
      collect(o, event),
    );
    s.emit("chat:message", { roomId: room._id, text: "let me in" });
    s.emit("typing", { roomId: room._id, isTyping: true });
    s.emit("collab:update", { roomId: room._id, update: typed("intruder") });
    s.emit("language:change", { roomId: room._id, language: "java" });
    s.emit("run:result", { roomId: room._id, language: "python", output: "fake", error: null, durationMs: 1 });
    s.emit("access:request", { roomId: room._id });
    await pause(400);
    expect(seen.flat()).toEqual([]);
    expect(await sharedCode(o, room._id)).not.toContain("intruder");
    expect(await Message.countDocuments({ roomId: room._id })).toBe(0);
  });
});

describe("shared editing", () => {
  it("sends an editor's changes to everyone else and keeps them", async () => {
    const [owner, editor] = users("owner", "editor");
    const room = await createRoom(server, owner);
    const o = await server.connect(owner);
    const e = await server.connect(editor);
    await joinRoom(o, room._id);
    await joinRoom(e, room._id, room.invites.edit);

    const update = typed("print('hi')\n");
    const received = nextEvent<{ roomId: string; update: Uint8Array }>(o, "collab:update");
    e.emit("collab:update", { roomId: room._id, update });
    const got = await received;
    expect(got.roomId).toBe(room._id);
    expect(new Uint8Array(got.update)).toEqual(update);
    expect(await sharedCode(o, room._id)).toContain("print('hi')");
  });

  it("refuses a viewer's changes (view-only) and doesn't pass them on", async () => {
    const [owner, viewer] = users("owner", "viewer");
    const room = await createRoom(server, owner);
    const o = await server.connect(owner);
    const v = await server.connect(viewer);
    await joinRoom(o, room._id);
    await joinRoom(v, room._id, room.invites.view);

    const updates = collect(o, "collab:update");
    const rejected = nextEvent(v, "collab:rejected");
    v.emit("collab:update", { roomId: room._id, update: typed("viewer edit") });
    expect(await rejected).toEqual({ roomId: room._id, reason: "view-only" });
    expect(await sharedCode(o, room._id)).not.toContain("viewer edit");
    expect(updates).toEqual([]);
  });

  it("refuses an edit that would make the code too long", async () => {
    const [owner] = users("owner");
    const room = await createRoom(server, owner);
    const o = await server.connect(owner);
    await joinRoom(o, room._id);
    const rejected = nextEvent(o, "collab:rejected");
    o.emit("collab:update", { roomId: room._id, update: typed("a".repeat(100_001)) });
    expect(await rejected).toEqual({ roomId: room._id, reason: "too-long" });
  });
});

describe("one room per connection (roles never carry over)", () => {
  // The bug this guards against: a connection kept every room it had joined,
  // with the role from the last one. A viewer of room A who then opened
  // their own room B became "owner" in A as well, and could edit A, switch
  // its language or post fake run results there.
  it("a viewer of one room who opens their own room can't change the first one", async () => {
    const [owner, viewer] = users("owner", "viewer");
    const roomA = await createRoom(server, owner);
    const roomB = await createRoom(server, viewer, { name: "Mine", language: "javascript" });
    const o = await server.connect(owner);
    const v = await server.connect(viewer);
    await joinRoom(o, roomA._id);
    expect(await joinRoom(v, roomA._id, roomA.invites.view)).toBe("viewer");

    // The same connection opens room B, where they're the owner. That takes
    // them out of room A, for everyone in A to see.
    const leftA = eventWhere(o, "presence:update", without(`user_${viewer}`));
    expect(await joinRoom(v, roomB._id)).toBe("owner");
    await leftA;

    const seenInA = ["collab:update", "language:update", "run:start", "run:result", "lens:session", "chat:message", "typing"].map(
      (event) => collect(o, event),
    );
    const rejections = collect(v, "collab:rejected");
    v.emit("collab:update", { roomId: roomA._id, update: typed("HACKED") });
    v.emit("language:change", { roomId: roomA._id, language: "java" });
    v.emit("run:start", { roomId: roomA._id, language: "python" });
    v.emit("run:result", { roomId: roomA._id, language: "python", output: "All tests passed", error: null, durationMs: 1 });
    v.emit("lens:start", { roomId: roomA._id, id: "lens-test-0001", title: "x", code: "x", trace: Buffer.from([1, 2, 3]) });
    v.emit("chat:message", { roomId: roomA._id, text: "am I still here?" });
    v.emit("typing", { roomId: roomA._id, isTyping: true });

    // Everything above has been handled once this answer arrives.
    await sharedCode(v, roomB._id);
    await pause(300);
    expect(seenInA.flat()).toEqual([]);
    expect(rejections).toEqual([]);
    expect(await sharedCode(o, roomA._id)).not.toContain("HACKED");
    const saved = await Room.findById(roomA._id).lean();
    expect(saved?.language).toBe("python");
    expect(await Message.countDocuments({ roomId: roomA._id })).toBe(0);

    // In their own room they're the owner, as they should be.
    v.emit("language:change", { roomId: roomB._id, language: "typescript" });
    await eventually(async () => expect((await Room.findById(roomB._id).lean())?.language).toBe("typescript"));
  });

  it("going back to the first room gives the first room's role again", async () => {
    const [owner, viewer] = users("owner", "viewer");
    const roomA = await createRoom(server, owner);
    const roomB = await createRoom(server, viewer, { name: "Mine" });
    const o = await server.connect(owner);
    const v = await server.connect(viewer);
    await joinRoom(o, roomA._id);
    await joinRoom(v, roomA._id, roomA.invites.view);
    await joinRoom(v, roomB._id);

    const backInA = eventWhere(o, "presence:update", including(`user_${viewer}`));
    expect(await joinRoom(v, roomA._id)).toBe("viewer");
    await backInA;
    const rejected = nextEvent(v, "collab:rejected");
    v.emit("collab:update", { roomId: roomA._id, update: typed("HACKED") });
    expect(await rejected).toEqual({ roomId: roomA._id, reason: "view-only" });
  });

  it("two tabs of the same person keep their own rooms and roles", async () => {
    const [owner, viewer] = users("owner", "viewer");
    const roomA = await createRoom(server, owner);
    const roomB = await createRoom(server, viewer, { name: "Mine" });
    const o = await server.connect(owner);
    const tabA = await server.connect(viewer);
    const tabB = await server.connect(viewer);
    await joinRoom(o, roomA._id);
    expect(await joinRoom(tabA, roomA._id, roomA.invites.view)).toBe("viewer");
    expect(await joinRoom(tabB, roomB._id)).toBe("owner");

    // The tab in B can't reach A, and the tab in A is still a viewer there.
    const updates = collect(o, "collab:update");
    tabB.emit("collab:update", { roomId: roomA._id, update: typed("from tab B") });
    const rejected = nextEvent(tabA, "collab:rejected");
    tabA.emit("collab:update", { roomId: roomA._id, update: typed("from tab A") });
    expect(await rejected).toEqual({ roomId: roomA._id, reason: "view-only" });
    await sharedCode(tabB, roomB._id);
    await pause(200);
    expect(updates).toEqual([]);
    expect(await sharedCode(o, roomA._id)).not.toMatch(/from tab/);
  });
});

describe("who's here", () => {
  it("drops a connection from the room when it closes", async () => {
    const [owner, viewer] = users("owner", "viewer");
    const room = await createRoom(server, owner);
    const o = await server.connect(owner);
    const v = await server.connect(viewer);
    await joinRoom(o, room._id);
    await joinRoom(v, room._id, room.invites.view);
    const gone = eventWhere(o, "presence:update", without(`user_${viewer}`));
    v.disconnect();
    await gone;
  });

  it("doesn't add a connection that closed while it was joining", async () => {
    const [owner, viewer, editor] = users("owner", "viewer", "editor");
    const room = await createRoom(server, owner);
    const o = await server.connect(owner);
    await joinRoom(o, room._id);

    // The viewer's join is held halfway (at its profile lookup) while their
    // connection closes, then allowed to finish.
    let reachedLookup!: () => void;
    const atLookup = new Promise<void>((resolve) => (reachedLookup = resolve));
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const findOne = Profile.findOne.bind(Profile);
    const lookup = vi.spyOn(Profile, "findOne").mockImplementation(((filter: { clerkUserId?: string }, ...rest: never[]) => {
      if (filter?.clerkUserId !== `user_${viewer}`) return findOne(filter as never, ...rest);
      reachedLookup();
      return held.then(() => findOne(filter as never));
    }) as never);
    try {
      const v = await server.connect(viewer);
      v.emit("room:join", { roomId: room._id, invite: room.invites.view });
      await atLookup;
      v.disconnect();
      const connected = () => [...server.io.of("/").sockets.values()].some((s) => s.data.userId === `user_${viewer}`);
      await eventually(() => expect(connected()).toBe(false));
      release();
      await pause(200);
    } finally {
      lookup.mockRestore();
    }

    // Someone new joins and sees who's in the room.
    const e = await server.connect(editor);
    const presence = nextEvent<PresenceUser[]>(e, "presence:update");
    await joinRoom(e, room._id, room.invites.edit);
    const people = await presence;
    expect(people.map((person) => person.userId).sort()).toEqual([`user_${editor}`, `user_${owner}`].sort());
  });

  it("stops sending a room's events after room:leave", async () => {
    const [owner, viewer] = users("owner", "viewer");
    const room = await createRoom(server, owner);
    const o = await server.connect(owner);
    const v = await server.connect(viewer);
    await joinRoom(o, room._id);
    await joinRoom(v, room._id, room.invites.view);

    const left = eventWhere(o, "presence:update", without(`user_${viewer}`));
    v.emit("room:leave", room._id);
    await left;

    const viewerSees = collect<ChatMessage>(v, "chat:message");
    const ownerSees = collect<ChatMessage>(o, "chat:message");
    v.emit("chat:message", { roomId: room._id, text: "ghost" });
    const own = eventWhere<ChatMessage>(o, "chat:message", (message) => message.text === "anyone?");
    o.emit("chat:message", { roomId: room._id, text: "anyone?" });
    await own;
    await pause(200);
    expect(ownerSees.map((message) => message.text)).toEqual(["anyone?"]);
    expect(viewerSees).toEqual([]);
  });
});

describe("chat", () => {
  it("saves messages under the sender's own name, and drops empty or overlong ones", async () => {
    const [owner] = users("owner");
    const username = `chat_${owner}`.toLowerCase().slice(0, 20);
    await Profile.create({ clerkUserId: `user_${owner}`, username, avatarId: "codeshare" });
    const room = await createRoom(server, owner);
    const o = await server.connect(owner);
    await joinRoom(o, room._id);

    const all = collect<ChatMessage>(o, "chat:message");
    o.emit("chat:message", { roomId: room._id, text: "   " });
    o.emit("chat:message", { roomId: room._id, text: "x".repeat(2001) });
    const hello = eventWhere<ChatMessage>(o, "chat:message", (message) => message.text === "hello");
    // The name comes from the sender's profile, whatever the message says.
    o.emit("chat:message", { roomId: room._id, text: "  hello  ", senderName: "someone_else", senderId: "user_x" });
    const message = await hello;
    expect(message.senderName).toBe(username);
    expect(message.senderId).toBe(`user_${owner}`);
    await pause(200);
    expect(all.map((m) => m.text)).toEqual(["hello"]);

    const history = await server.api().get(`/api/rooms/${room._id}/messages`).set(bearer(owner));
    expect(history.body.map((m: ChatMessage) => m.text)).toEqual(["hello"]);
  });
});

describe("roles changed by the owner", () => {
  it("lets a viewer edit straight after the owner makes them an editor", async () => {
    const [owner, viewer] = users("owner", "viewer");
    const room = await createRoom(server, owner);
    const o = await server.connect(owner);
    const v = await server.connect(viewer);
    await joinRoom(o, room._id);
    await joinRoom(v, room._id, room.invites.view);

    // Asking first: the owner sees the request.
    const request = eventWhere<{ requests: { userId: string }[] }>(o, "access:requests", (p) => p.requests.length > 0);
    const asked = nextEvent(v, "access:requested");
    v.emit("access:request", { roomId: room._id });
    expect(await asked).toEqual({ roomId: room._id, ownerHere: true });
    expect((await request).requests.map((r) => r.userId)).toEqual([`user_${viewer}`]);

    const promoted = nextEvent(v, "room:role");
    const res = await server.api().patch(`/api/rooms/${room._id}/people/user_${viewer}`).set(bearer(owner)).send({ role: "editor" });
    expect(res.status).toBe(200);
    expect(await promoted).toEqual({ roomId: room._id, role: "editor" });

    const received = nextEvent(o, "collab:update");
    v.emit("collab:update", { roomId: room._id, update: typed("now I can edit") });
    await received;
    expect(await sharedCode(o, room._id)).toContain("now I can edit");
  });

  it("takes a removed person out of the room at once", async () => {
    const [owner, editor] = users("owner", "editor");
    const room = await createRoom(server, owner);
    const o = await server.connect(owner);
    const e = await server.connect(editor);
    await joinRoom(o, room._id);
    await joinRoom(e, room._id, room.invites.edit);

    const removed = nextEvent(e, "room:removed");
    const res = await server.api().delete(`/api/rooms/${room._id}/people/user_${editor}`).set(bearer(owner));
    expect(res.status).toBe(204);
    expect(await removed).toEqual({ roomId: room._id });

    const updates = collect(o, "collab:update");
    e.emit("collab:update", { roomId: room._id, update: typed("after removal") });
    await pause(300);
    expect(updates).toEqual([]);
    // And without an invite link they can't come back.
    const denied = nextEvent(e, "room:denied");
    e.emit("room:join", { roomId: room._id });
    expect(await denied).toEqual({ roomId: room._id });
  });
});
