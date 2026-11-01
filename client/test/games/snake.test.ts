import { expect, it } from "vitest";
import { CELLS, RESPAWN_MS, SIZE, SnakeCache, SnakeSim, cellOf, multiplier, snakeStandings, snakeWorld, stepMs, turnsBy, xOf, yOf } from "@/lib/games/logic/snake";
import type { MatchEvent, MatchInfo } from "@/lib/games/types";

it("longer snakes are faster, down to 70 ms a step", () => {
  expect(stepMs(3) === 135 && stepMs(100) === 70 && stepMs(13) < stepMs(4), "longer snakes are faster, down to 70 ms a step").toBe(true);
  expect(multiplier(3) === 1 && multiplier(11) === 2 && multiplier(19) === 3, "the bonus grows every 8 segments").toBe(true);
});

// A seed whose first byte isn't on row 10, so a straight run eats nothing.
function seedWhere(pred: (sim: SnakeSim) => boolean) {
  for (let seed = 1; seed < 100000; seed++) if (pred(new SnakeSim("you", seed, true, null))) return seed;
  throw new Error("no seed");
}
const quiet = seedWhere((s) => yOf(s.food.cell) !== 10 && xOf(s.food.cell) > 3);

it("Straight into the right wall: 14 steps to x = 19, the 15th crashes", () => {
  const sim = new SnakeSim("you", quiet, true, null);
  sim.advance(100000);
  expect(sim.over && sim.step === 15 && sim.deaths === 1 && sim.crash !== null, `solo: straight into the wall ends the run at step ${sim.step}`).toBe(true);
  expect(sim.crash!.t === 15 * stepMs(3), "the crash time is step 15 × 135 ms").toBe(true);
  expect(sim.length === 3 && xOf(sim.body[0]) === 19, "a crashed snake keeps its whole body (head at the wall)").toBe(true);
});

it("Turns apply at the step they're sent for", () => {
  const sim = new SnakeSim("you", quiet, true, null);
  sim.feed({ d: 0, k: 3, t: 100 });
  sim.advance(stepMs(3) * 4 + 1);
  expect(sim.step === 4 && sim.dir === 0 && xOf(sim.body[0]) === 7 && yOf(sim.body[0]) === 8, "up at step 3: two right, then up").toBe(true);
});
it("a reverse turn is ignored, the next one is taken", () => {
  const sim = new SnakeSim("you", quiet, true, null);
  sim.feed({ d: 3, k: 1, t: 10 }); // reverse: ignored
  sim.feed({ d: 2, k: 1, t: 10 }); // down: taken at step 1
  sim.advance(stepMs(3) + 1);
  expect(sim.dir === 2 && yOf(sim.body[0]) === 11, "a reverse turn is ignored, the next one is taken").toBe(true);
});
it("two turns for one step: one per step, the second waits a step", () => {
  const sim = new SnakeSim("you", quiet, true, null);
  sim.feed({ d: 0, k: 2, t: 10 });
  sim.feed({ d: 3, k: 2, t: 20 });
  sim.advance(stepMs(3) * 3 + 1);
  expect(sim.step === 3 && sim.dir === 3 && xOf(sim.body[0]) === 5 && yOf(sim.body[0]) === 9, "two turns for one step: one per step, the second waits a step").toBe(true);
});
it("Sent for step 2 but arriving 2 s late: it counts from when it arrived", () => {
  const sim = new SnakeSim("you", quiet, true, null);
  sim.feed({ d: 2, k: 2, t: 2000 });
  sim.advance(2500);
  const turnedAt = 2000 - 400;
  const stepsBefore = Math.ceil(turnedAt / stepMs(3));
  expect(sim.dir === 2 && xOf(sim.body[0]) === 5 + stepsBefore - 1, `a very late turn applies when it arrived (step ${stepsBefore})`).toBe(true);
});

it("Eating", () => {
  const seed = seedWhere((s) => yOf(s.food.cell) === 10 && xOf(s.food.cell) > 6 && xOf(s.food.cell) < 15);
  const sim = new SnakeSim("you", seed, true, null);
  const foodX = xOf(sim.food.cell);
  sim.advance((foodX - 5) * stepMs(3) + 1);
  expect(sim.eaten === 1 && sim.points === 10 && sim.lastEat?.cell === cellOf(foodX, 10), `eating a byte scores 10 (at x = ${foodX})`).toBe(true);
  sim.advance((foodX - 5) * stepMs(3) + stepMs(4) + 1);
  expect(sim.length === 4, "and grows the snake by one").toBe(true);
  expect(sim.food.cell !== cellOf(foodX, 10), "a new byte appears").toBe(true);
});

it("Online: crashing costs your length, then you're back", () => {
  const sim = new SnakeSim("p", quiet, false, 120000);
  sim.advance(15 * stepMs(3) + 10);
  expect(!sim.alive && sim.deaths === 1 && sim.respawnAt === 15 * stepMs(3) + RESPAWN_MS, "online: a crash, then a wait").toBe(true);
  sim.advance(15 * stepMs(3) + RESPAWN_MS + 1);
  expect(sim.alive && sim.length === 3 && xOf(sim.body[0]) === 5, "back at the start after 1.5 s").toBe(true);
  const end = new SnakeSim("p", quiet, false, 60000);
  end.advance(1e9);
  expect(end.lastAt <= 60000 && end.nextAt > 60000 - 1, "nothing happens after time's up").toBe(true);
});

it("The same moves give the same game, fed all at once or bit by bit", () => {
  const players = [{ id: "a", name: "a", avatarId: "x", seat: 0 }, { id: "b", name: "b", avatarId: "x", seat: 1 }];
  const match: MatchInfo = { id: "m", number: 1, seed: 99, settings: { seconds: 60 }, players, startAt: 0 };
  const events: MatchEvent[] = [];
  let seq = 0;
  const random = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  // Random but legal-ish turns for both.
  for (let k = 2; k < 400; k += 1 + Math.floor(random() * 4)) {
    for (const id of ["a", "b"]) events.push({ seq: seq++, by: id, type: "turn", data: { d: Math.floor(random() * 4), k }, t: k * 100 - 50 });
  }
  events.push({ seq: seq++, by: "system", type: "left", data: { id: "b" }, t: 30000 });
  const all = snakeWorld(match, events, 70000);
  // Incremental: feed turns as they "arrive", advancing in between.
  const sims = new Map(players.map((p) => [p.id, new SnakeSim(p.id, 99, false, 60000)]));
  const turns = turnsBy(events);
  for (let now = 0; now <= 70000; now += 37) {
    for (const [id, sim] of sims) {
      const list = turns.get(id) ?? [];
      while (sim.fed < list.length && list[sim.fed].t <= now) sim.feed(list[sim.fed]);
      if (id === "b" && now >= 30000 && sim.leftAt === null) sim.leave(30000);
      sim.advance(now);
    }
  }
  const same = players.every((p) => {
    const x = all.get(p.id)!;
    const y = sims.get(p.id)!;
    return x.points === y.points && x.deaths === y.deaths && x.step === y.step && x.body.join() === y.body.join();
  });
  expect(same, `all at once = bit by bit (a: ${all.get("a")!.points} pts, ${all.get("a")!.deaths} crashes; b: ${all.get("b")!.points} pts)`).toBe(true);
  expect(all.get("b")!.lastAt <= 30000, "nothing happens after leaving").toBe(true);
  const st = snakeStandings(match, all);
  expect(st.find((s) => s.id === "b")!.score === -1 && st.find((s) => s.id === "a")!.stat === all.get("a")!.points, "standings: points; leavers last").toBe(true);
});

it("Bytes land in the same spot for everyone (unless it's under their snake)", () => {
  const a = new SnakeSim("a", 5, false, null);
  const b = new SnakeSim("b", 5, false, null);
  expect(a.food.cell === b.food.cell, "everyone's first byte is in the same place").toBe(true);
  let ok = true;
  for (let seed = 1; seed < 2000; seed++) {
    const s = new SnakeSim("x", seed, true, null);
    if (s.food.cell < 0 || s.food.cell >= CELLS || s.body.includes(s.food.cell)) ok = false;
  }
  expect(ok, "a byte never starts under the snake").toBe(true);
});
it("20 × 20 board", () => {
  expect(SIZE === 20, "20 × 20 board").toBe(true);
});

it("The cache gives the same answer as replaying, even when turns arrive late", () => {
  const players = [{ id: "a", name: "a", avatarId: "x", seat: 0 }, { id: "b", name: "b", avatarId: "x", seat: 1 }];
  const match: MatchInfo = { id: "m2", number: 1, seed: 4242, settings: { seconds: 60 }, players, startAt: 0 };
  const all: MatchEvent[] = [];
  let seq = 0;
  let s = 11;
  const random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // b's turns arrive 0–300 ms after their step (as if over a slow line).
  for (let k = 2; k < 380; k += 2 + Math.floor(random() * 5)) {
    all.push({ seq: seq++, by: "a", type: "turn", data: { d: Math.floor(random() * 4), k }, t: k * 90 });
    all.push({ seq: seq++, by: "b", type: "turn", data: { d: Math.floor(random() * 4), k }, t: k * 110 + Math.floor(random() * 300) });
  }
  all.sort((x, y) => x.t - y.t);
  const cache = new SnakeCache();
  let ok = true;
  for (let now = 0; now <= 62000; now += 16) {
    const arrived = all.filter((e) => e.t <= now);
    cache.update(match, arrived, now);
    const fresh = snakeWorld(match, arrived, now);
    const cached = cache.update(match, arrived, now);
    for (const p of players) {
      const x = fresh.get(p.id)!;
      const y = cached.get(p.id)!;
      if (x.body.join() !== y.body.join() || x.points !== y.points || x.deaths !== y.deaths) ok = false;
    }
  }
  expect(ok, "frame by frame, the cache always matches a full replay").toBe(true);
});
