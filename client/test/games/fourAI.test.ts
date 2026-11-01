import { expect, it } from "vitest";
import { chooseMove, type Level } from "@/lib/games/logic/fourAI";
import { COLS, ROWS, at, dropRow, winningLine, type Cell } from "@/lib/games/logic/four";

// One whole game between two computer players. Returns the winner (1 or 2,
// 0 for a draw) and the slowest move in milliseconds.
function play(a: Level, b: Level, seed: number) {
  const board: Cell[] = Array(ROWS * COLS).fill(0);
  let disc: 1 | 2 = 1;
  let slowest = 0;
  for (let move = 0; move < ROWS * COLS; move++) {
    const started = Date.now();
    const col = chooseMove(board, disc, disc === 1 ? a : b, seed * 100 + move);
    slowest = Math.max(slowest, Date.now() - started);
    const row = dropRow(board, col);
    if (row < 0) throw new Error("illegal move");
    board[at(row, col)] = disc;
    if (winningLine(board, row, col)) return { winner: disc, slowest };
    disc = disc === 1 ? 2 : 1;
  }
  return { winner: 0, slowest };
}

// `games` games between levels a and b, taking turns to start.
function tally(a: Level, b: Level, games: number) {
  const wins = { 1: 0, 2: 0, 0: 0 } as Record<number, number>;
  let slowest = 0;
  for (let g = 0; g < games; g++) {
    const first = g % 2 === 0;
    const r = first ? play(a, b, g + 1) : play(b, a, g + 1);
    const winnerIsA = first ? r.winner === 1 : r.winner === 2;
    const winnerIsB = first ? r.winner === 2 : r.winner === 1;
    wins[winnerIsA ? 1 : winnerIsB ? 2 : 0]++;
    slowest = Math.max(slowest, r.slowest);
  }
  return { a: wins[1], b: wins[2], draws: wins[0], slowest };
}

it("takes a win and blocks a loss", () => {
  const board: Cell[] = Array(42).fill(0);
  for (const c of [0, 1, 2]) board[at(5, c)] = 1;
  for (const c of [0, 1, 2]) board[at(4, c)] = 2;
  expect(chooseMove(board, 1, "hard", 1) === 3, "hard takes an immediate win").toBe(true);
  expect(chooseMove(board, 2, "hard", 1) === 3, "hard blocks the opponent's win").toBe(true);
  expect(chooseMove(board, 1, "medium", 1) === 3, "medium takes an immediate win").toBe(true);
});

it("medium beats easy most of the time", () => {
  const me = tally("medium", "easy", 10);
  expect(me.a >= 8, `medium beats easy most of the time (${me.a}-${me.b}, ${me.draws} draws)`).toBe(true);
});

it("answers within its time limit on hard", () => {
  const started = Date.now();
  const col = chooseMove(Array(42).fill(0), 1, "hard", 1);
  expect(col >= 0 && col < COLS).toBe(true);
  expect(Date.now() - started).toBeLessThan(800);
});

// Hard thinks for a fixed time, so how strong it is depends on the computer
// running the test, and the games take about a minute. Run them with
// SLOW_TESTS=1 npm test.
it.skipIf(!process.env.SLOW_TESTS)("plays hard as strong as it says, quickly", { timeout: 300_000 }, () => {
  const he = tally("hard", "easy", 10);
  expect(he.a >= 9, `hard beats easy almost every time (${he.a}-${he.b}, ${he.draws} draws)`).toBe(true);
  const hm = tally("hard", "medium", 6);
  expect(hm.a > hm.b, `hard beats medium more often than not (${hm.a}-${hm.b}, ${hm.draws} draws)`).toBe(true);
  expect(Math.max(he.slowest, hm.slowest) < 800, `every hard move takes under 0.8 s (slowest ${Math.max(he.slowest, hm.slowest)} ms)`).toBe(true);
});
