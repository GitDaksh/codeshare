import { expect, it } from "vitest";
import { COLS, ROWS, TURN_MS, aimOf, at, autoColumn, dropRow, fourStandings, fourState, isOver, seating, type Cell } from "@/lib/games/logic/four";
import type { MatchEvent, MatchInfo } from "@/lib/games/types";

const players = [
  { id: "a", name: "Ann", avatarId: "x", seat: 0 },
  { id: "b", name: "Bob", avatarId: "x", seat: 1 },
];
const match = (number = 1, settings = {}): MatchInfo => ({ id: "m", number, seed: 12345, settings, players, startAt: 0 });
let seq = 0;
const ev = (by: string, type: string, data: unknown, t: number): MatchEvent => ({ seq: seq++, by, type, data, t });

it("Seating alternates", () => {
  expect(seating(match(1)).join() === "a,b", "match 1: first player goes first").toBe(true);
  expect(seating(match(2)).join() === "b,a", "match 2: second player goes first").toBe(true);
  expect(seating(match(3)).join() === "a,b", "match 3: back to the first player").toBe(true);
});

it("Out-of-turn and bad moves are ignored", () => {
  const s = fourState(match(), [ev("b", "drop", { c: 3 }, 100), ev("a", "drop", { c: 9 }, 200), ev("a", "drop", { c: 2.5 }, 250), ev("a", "drop", { c: "3" }, 260), ev("a", "drop", { c: 3 }, 300)]);
  expect(s.moves.length === 1 && s.moves[0].disc === 1 && s.moves[0].col === 3 && s.turn === 2 && s.turnStart === 300, "only the right player's valid move counts").toBe(true);
});

it("A vertical win", () => {
  const e = [ev("a", "drop", { c: 0 }, 1), ev("b", "drop", { c: 1 }, 2), ev("a", "drop", { c: 0 }, 3), ev("b", "drop", { c: 1 }, 4), ev("a", "drop", { c: 0 }, 5), ev("b", "drop", { c: 1 }, 6), ev("a", "drop", { c: 0 }, 7), ev("b", "drop", { c: 1 }, 8)];
  const s = fourState(match(), e);
  expect(s.winner === 1 && s.line?.length === 4 && s.endedAt === 7 && s.moves.length === 7 && isOver(s), "vertical four wins, later moves ignored").toBe(true);
  const st = fourStandings(match(), s, false);
  expect(st[0].won === true && st[0].score === 2 && st[1].won === false && st[1].label === "Lost", "standings: winner and loser").toBe(true);
  expect(st[0].stat === 0, "online wins don't set a level best").toBe(true);
});

it("A diagonal win (anti-diagonal)", () => {
  // Build: a plays (5,3),(4,2),(3,1),(2,0) as a diagonal with b fillers.
  const cols = [3, 2, 2, 1, 1, 0, 1, 0, 0, 6, 0];
  const e = cols.map((c, i) => ev(i % 2 === 0 ? "a" : "b", "drop", { c }, 10 + i));
  const s = fourState(match(), e);
  expect(s.winner === 1 && !!s.line && s.line.length >= 4, "diagonal four wins").toBe(true);
});

it("A full board with no winner is a draw", () => {
  // A known drawn filling: columns in a pattern that never makes four.
  const order = [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 2, 3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 2, 4, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 4, 6, 6, 6, 6, 6, 6];
  const e = order.map((c, i) => ev(i % 2 === 0 ? "a" : "b", "drop", { c }, 10 + i));
  const s = fourState(match(), e);
  expect(s.moves.length === 42 && s.draw && s.winner === null && s.endedAt === 51 && isOver(s), "a full board is a draw").toBe(true);
  const st = fourStandings(match(), s, false);
  expect(st.every((x) => x.score === 1 && x.label === "Draw" && x.won === false), "draw standings").toBe(true);
});

it("Leaving forfeits", () => {
  const s = fourState(match(), [ev("a", "drop", { c: 3 }, 100), ev("system", "left", { id: "a" }, 500), ev("b", "drop", { c: 3 }, 600)]);
  expect(s.winner === 2 && s.forfeit === "a" && s.endedAt === 500 && s.moves.length === 1, "leaving hands the win to the other player").toBe(true);
  expect(fourStandings(match(), s, false)[1].detail === "The other player left", "forfeit detail").toBe(true);
  const spectator = fourState(match(), [ev("system", "left", { id: "z" }, 50)]);
  expect(spectator.winner === null, "someone else leaving changes nothing").toBe(true);
});

it("Time-outs", () => {
  const base = [ev("a", "drop", { c: 3 }, 1000)];
  // b's turn started at 1000. a claims after the limit.
  const early = fourState(match(), [...base, ev("a", "timeout", { m: 1 }, 1000 + TURN_MS - 5000)]);
  expect(early.moves.length === 1, "an early claim is ignored").toBe(true);
  const wrongClaimer = fourState(match(), [...base, ev("b", "timeout", { m: 1 }, 1000 + TURN_MS + 10)]);
  expect(wrongClaimer.moves.length === 1, "the slow player can't claim their own time-out").toBe(true);
  const stale = fourState(match(), [...base, ev("a", "timeout", { m: 0 }, 1000 + TURN_MS + 10)]);
  expect(stale.moves.length === 1, "a claim about an earlier turn is ignored").toBe(true);
  const ok = fourState(match(), [...base, ev("a", "timeout", { m: 1 }, 1000 + TURN_MS + 10)]);
  expect(ok.moves.length === 2 && ok.moves[1].disc === 2 && ok.moves[1].auto === true && ok.turn === 1, "a valid claim drops a disc for the slow player").toBe(true);
  const slack = fourState(match(), [...base, ev("a", "timeout", { m: 1 }, 1000 + TURN_MS - 600)]);
  expect(slack.moves.length === 2, "a claim a moment early still counts").toBe(true);
  const raced = fourState(match(), [...base, ev("b", "drop", { c: 4 }, 1000 + TURN_MS - 100), ev("a", "timeout", { m: 1 }, 1000 + TURN_MS + 10)]);
  expect(raced.moves.length === 2 && raced.moves[1].col === 4 && !raced.moves[1].auto, "a move that got in first beats the claim").toBe(true);
  const lateMove = fourState(match(), [...base, ev("a", "timeout", { m: 1 }, 1000 + TURN_MS + 10), ev("b", "drop", { c: 4 }, 1000 + TURN_MS + 50)]);
  expect(lateMove.moves.length === 2 && lateMove.moves[1].auto === true && lateMove.turn === 1, "a move after the claim is ignored").toBe(true);
  // First turn: the clock starts at 0.
  const first = fourState(match(), [ev("b", "timeout", { m: 0 }, TURN_MS + 10)]);
  expect(first.moves.length === 1 && first.moves[0].disc === 1 && first.moves[0].auto === true, "the first turn can time out too").toBe(true);
});

it("The automatic column is always legal and the same everywhere", () => {
  const board: Cell[] = Array(ROWS * COLS).fill(0);
  for (let r = 0; r < ROWS; r++) for (const c of [0, 1, 2, 4, 5, 6]) board[at(r, c)] = 1;
  let ok = true;
  for (let m = 0; m < 50; m++) if (autoColumn(99, board, m) !== 3) ok = false;
  expect(ok, "only one free column: always that one").toBe(true);
  const empty: Cell[] = Array(ROWS * COLS).fill(0);
  const seen = new Set<number>();
  for (let m = 0; m < 200; m++) {
    const c = autoColumn(7, empty, m);
    if (dropRow(empty, c) < 0) ok = false;
    seen.add(c);
  }
  expect(ok && seen.size === COLS, "spreads over every column").toBe(true);
  expect(autoColumn(7, empty, 5) === autoColumn(7, empty, 5), "deterministic").toBe(true);
});

it("Aims: the mover's last aim this turn", () => {
  const e = [ev("a", "drop", { c: 3 }, 1000), ev("b", "aim", { c: 1 }, 1100), ev("b", "aim", { c: 5 }, 1200), ev("a", "aim", { c: 2 }, 1250)];
  const s = fourState(match(), e);
  expect(aimOf(e, s, "b") === 5, "the latest aim wins").toBe(true);
  expect(aimOf([ev("b", "aim", { c: 4 }, 900), ...e.slice(0, 1)], fourState(match(), e.slice(0, 1)), "b") === null, "aims from before the turn don't count").toBe(true);
  expect(aimOf([...e, ev("b", "aim", { c: 99 }, 1300)], s, "b") === null, "a bad aim is ignored").toBe(true);
});

it("Solo standings: the level beaten is the best", () => {
  const solo = { ...match(1, { level: "hard" }), players: [players[0], { id: "bot:cpu", name: "Computer", avatarId: "bot", seat: 3, bot: true }] };
  const e = [0, 1, 0, 1, 0, 1, 0].map((c, i) => ev(i % 2 === 0 ? "a" : "bot:cpu", "drop", { c }, i + 1));
  const s = fourState(solo, e);
  const st = fourStandings(solo, s, true);
  expect(st[0].stat === 3 && st[0].won === true && st[1].stat === undefined, "beating hard records level 3").toBe(true);
});
