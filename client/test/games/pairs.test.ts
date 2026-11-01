import { expect, it } from "vitest";
import { PAIRS } from "@/lib/games/content/pairs";
import { TURN_MS, deal, pairCount, pairsStandings, pairsState, revealMs, soloPoints } from "@/lib/games/logic/pairs";
import type { MatchEvent, MatchInfo } from "@/lib/games/types";

// ---------- The deck ----------
const texts = PAIRS.flatMap((p) => [p.a.text, p.b.text]);
it("every card's text is unique", () => {
  expect(new Set(texts).size === texts.length, `every card's text is unique (${texts.length} cards, ${PAIRS.length} pairs)`).toBe(true);
  expect(new Set(PAIRS.map((p) => p.id)).size === PAIRS.length, "pair ids are unique").toBe(true);
});
it("enough groups for 12 pairs and variety", () => {
  const groups = new Set(PAIRS.map((p) => p.group));
  expect(groups.size >= 24, `enough groups for 12 pairs and variety (${groups.size})`).toBe(true);
});

it("300 seeds × 3 sizes: right count, one pair per group, two cards per pair", () => {
  let dealOk = true;
  for (let seed = 1; seed <= 300; seed++) {
    for (const n of [6, 8, 12]) {
      const { pairs, cards } = deal(seed, n);
      if (pairs.length !== n || cards.length !== n * 2) dealOk = false;
      if (new Set(pairs.map((p) => p.group)).size !== n) dealOk = false;
      for (let i = 0; i < n; i++) if (cards.filter((c) => c.pair === i).length !== 2) dealOk = false;
    }
  }
  expect(dealOk, "300 seeds × 3 sizes: right count, one pair per group, two cards per pair").toBe(true);
  expect(JSON.stringify(deal(42, 8)) === JSON.stringify(deal(42, 8)), "the same seed deals the same board").toBe(true);
});

// ---------- Play ----------
const solo: MatchInfo = { id: "m", number: 1, seed: 7, settings: { pairs: 6 }, players: [{ id: "you", name: "You", avatarId: "x", seat: 0 }], startAt: 0 };
it("pair count from settings (8 by default)", () => {
  expect(pairCount(solo) === 6 && pairCount({ ...solo, settings: { pairs: 99 } }) === 8, "pair count from settings (8 by default)").toBe(true);
});
let seq = 0;
const ev = (by: string, type: string, data: unknown, t: number): MatchEvent => ({ seq: seq++, by, type, data, t });
const { cards } = deal(solo.seed, 6);
const partner = (i: number) => cards.findIndex((c, j) => j !== i && c.pair === cards[i].pair);
const stranger = (i: number) => cards.findIndex((c, j) => j !== i && c.pair !== cards[i].pair);

it("two that belong together are found", () => {
  const a = 0;
  const b = partner(0);
  const s = pairsState(solo, [ev("you", "flip", { i: a }, 100), ev("you", "flip", { i: b }, 300)]);
  expect(s.foundBy[a] === "you" && s.foundBy[b] === "you" && s.players.get("you")!.pairs === 1 && s.open.length === 0, "two that belong together are found").toBe(true);
});
it("a miss stays on show for a moment", () => {
  const a = 0;
  const x = stranger(0);
  const e = [ev("you", "flip", { i: a }, 100), ev("you", "flip", { i: x }, 300)];
  const showing = pairsState(solo, e, 500);
  expect(showing.open.length === 2 && showing.hideAt === 300 + revealMs(solo) && showing.players.get("you")!.misses === 1, "a miss stays on show for a moment").toBe(true);
  const later = pairsState(solo, e, 300 + revealMs(solo) + 1);
  expect(later.open.length === 0 && later.hideAt === null, "then flips back").toBe(true);
  const tooSoon = pairsState(solo, [...e, ev("you", "flip", { i: partner(0) }, 600)], 2000);
  expect(tooSoon.open.length === 0 && tooSoon.players.get("you")!.flips === 2, "flips while a miss is on show are ignored").toBe(true);
  const after = pairsState(solo, [...e, ev("you", "flip", { i: partner(0) }, 300 + revealMs(solo) + 50)], 3000);
  expect(after.open.length === 1 && after.open[0] === partner(0), "flipping works again after").toBe(true);
});
it("the same card twice, or bad cards, are ignored", () => {
  const s = pairsState(solo, [ev("you", "flip", { i: 0 }, 100), ev("you", "flip", { i: 0 }, 200), ev("you", "flip", { i: 999 }, 250), ev("you", "flip", { i: "1" }, 260)]);
  expect(s.open.length === 1 && s.players.get("you")!.flips === 1, "the same card twice, or bad cards, are ignored").toBe(true);
});
it("Perfect play: every pair at the first try", () => {
  const e: MatchEvent[] = [];
  let t = 100;
  const done = new Set<number>();
  for (let i = 0; i < cards.length; i++) {
    if (done.has(i)) continue;
    const j = partner(i);
    done.add(i);
    done.add(j);
    e.push(ev("you", "flip", { i }, (t += 300)), ev("you", "flip", { i: j }, (t += 300)));
  }
  const s = pairsState(solo, e);
  expect(s.over && s.endedAt === t, "finding every pair ends the game").toBe(true);
  const [st] = pairsStandings(solo, s);
  const expected = soloPoints(6, 0, Math.round(t / 1000));
  expect(st.stat === expected && st.score === expected && /6 pairs in \d+s · 0 misses/.test(st.detail ?? ""), `solo points (${st.label}, ${st.detail})`).toBe(true);
});
it("the best possible solo score fits the server's limit", () => {
  expect(soloPoints(12, 0, 1) <= 10_000, "the best possible solo score fits the server's limit").toBe(true);
});

// ---------- With friends ----------
const players = ["ann", "bob", "cy"].map((id, seat) => ({ id, name: id, avatarId: "x", seat }));
const trio: MatchInfo = { id: "t", number: 1, seed: 11, settings: { pairs: 8 }, players, startAt: 0 };
const deck = deal(trio.seed, 8).cards;
const mate = (i: number) => deck.findIndex((c, j) => j !== i && c.pair === deck[i].pair);
const other = (i: number) => deck.findIndex((c, j) => j !== i && c.pair !== deck[i].pair);
it("the first player starts", () => {
  const s0 = pairsState(trio, []);
  expect(s0.turn === 0, "the first player starts").toBe(true);
  expect(pairsState({ ...trio, number: 2 }, []).turn === 1 && pairsState({ ...trio, number: 4 }, []).turn === 0, "who starts rotates each match").toBe(true);
  const out = pairsState(trio, [ev("bob", "flip", { i: 0 }, 100)]);
  expect(out.open.length === 0, "out of turn flips are ignored").toBe(true);
  const found = pairsState(trio, [ev("ann", "flip", { i: 0 }, 100), ev("ann", "flip", { i: mate(0) }, 200)]);
  expect(found.turn === 0 && found.turnStart === 200 && found.players.get("ann")!.pairs === 1, "a match: go again, with a fresh clock").toBe(true);
  const missed = pairsState(trio, [ev("ann", "flip", { i: 0 }, 100), ev("ann", "flip", { i: other(0) }, 200)], 300);
  expect(missed.turn === 1 && missed.turnNo === 1 && missed.turnStart === 200 + revealMs(trio), "a miss passes the turn (after the show)").toBe(true);
});
it("Time-outs", () => {
  const base = [ev("ann", "flip", { i: 0 }, 1000)];
  const early = pairsState(trio, [...base, ev("bob", "skip", { m: 0 }, TURN_MS - 3000)]);
  expect(early.turn === 0, "an early skip is ignored").toBe(true);
  const self = pairsState(trio, [...base, ev("ann", "skip", { m: 0 }, TURN_MS + 10)]);
  expect(self.turn === 0, "you can't skip yourself").toBe(true);
  const ok = pairsState(trio, [...base, ev("cy", "skip", { m: 0 }, TURN_MS + 10)]);
  expect(ok.turn === 1 && ok.open.length === 0 && ok.turnNo === 1, "a skip after the limit passes the turn and closes the open card").toBe(true);
  const twice = pairsState(trio, [...base, ev("cy", "skip", { m: 0 }, TURN_MS + 10), ev("bob", "skip", { m: 0 }, TURN_MS + 20)]);
  expect(twice.turn === 1, "a second skip for the same turn is ignored").toBe(true);
});
it("Leaving", () => {
  const left = pairsState(trio, [ev("ann", "flip", { i: 0 }, 100), ev("system", "left", { id: "ann" }, 500)]);
  expect(left.turn === 1 && left.open.length === 0 && left.players.get("ann")!.left, "the mover leaving passes the turn").toBe(true);
  const two = pairsState(trio, [ev("system", "left", { id: "bob" }, 100), ev("ann", "flip", { i: 0 }, 200), ev("ann", "flip", { i: other(0) }, 300)], 5000);
  expect(two.turn === 2, "turns skip players who left").toBe(true);
  const alone = pairsState(trio, [ev("system", "left", { id: "bob" }, 100), ev("system", "left", { id: "cy" }, 200)]);
  expect(alone.over && alone.endedAt === 200, "the game ends when one player is left").toBe(true);
  const st = pairsStandings(trio, alone);
  expect(st.find((x) => x.id === "bob")!.score === -1 && st.find((x) => x.id === "ann")!.score === 0, "players who left rank last").toBe(true);
});
