import { rng } from "@/lib/games/rng";
import { COLS, ROWS, at, dropRow, winningLine, type Cell } from "@/lib/games/logic/four";

// The computer player for Four in a Row. It looks ahead with negamax and
// alpha–beta pruning (trying the center columns first), and scores
// positions by the open lines each side has. Easy plays mostly at random
// (but takes most wins), medium looks 4 moves ahead with a little noise,
// and hard looks as far ahead as it can in about half a second.

export type Level = "easy" | "medium" | "hard";

const ORDER = [3, 2, 4, 1, 5, 0, 6];
const WIN = 1_000_000;

// Every line of four cells on the board (69 of them).
const WINDOWS: number[][] = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    for (const [dr, dc] of [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ]) {
      const cells: number[] = [];
      for (let k = 0; k < 4; k++) {
        const rr = r + dr * k;
        const cc = c + dc * k;
        if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) break;
        cells.push(at(rr, cc));
      }
      if (cells.length === 4) WINDOWS.push(cells);
    }
  }
}

function evaluate(board: Cell[], disc: Cell): number {
  const other = disc === 1 ? 2 : 1;
  let score = 0;
  for (let r = 0; r < ROWS; r++) {
    if (board[at(r, 3)] === disc) score += 3;
    else if (board[at(r, 3)] === other) score -= 3;
  }
  for (const cells of WINDOWS) {
    let mine = 0;
    let theirs = 0;
    for (const i of cells) {
      if (board[i] === disc) mine++;
      else if (board[i] === other) theirs++;
    }
    if (theirs === 0) score += mine === 3 ? 6 : mine === 2 ? 2 : 0;
    else if (mine === 0) score -= theirs === 3 ? 7 : theirs === 2 ? 2 : 0;
  }
  return score;
}

class OutOfTime extends Error {}

function negamax(board: Cell[], depth: number, alpha: number, beta: number, disc: 1 | 2, ply: number, deadline: number): number {
  if (Date.now() > deadline) throw new OutOfTime();
  const other: 1 | 2 = disc === 1 ? 2 : 1;
  let any = false;
  for (const col of ORDER) {
    const row = dropRow(board, col);
    if (row < 0) continue;
    any = true;
    board[at(row, col)] = disc;
    const wins = winningLine(board, row, col) !== null;
    board[at(row, col)] = 0;
    if (wins) return WIN - ply;
  }
  if (!any) return 0;
  if (depth === 0) return evaluate(board, disc);
  let best = -Infinity;
  for (const col of ORDER) {
    const row = dropRow(board, col);
    if (row < 0) continue;
    board[at(row, col)] = disc;
    const score = -negamax(board, depth - 1, -beta, -alpha, other, ply + 1, deadline);
    board[at(row, col)] = 0;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

// Each legal column's score for `disc`, searching `depth` moves ahead.
function scoreMoves(board: Cell[], disc: 1 | 2, depth: number, deadline: number): Map<number, number> {
  const other: 1 | 2 = disc === 1 ? 2 : 1;
  const scores = new Map<number, number>();
  for (const col of ORDER) {
    const row = dropRow(board, col);
    if (row < 0) continue;
    board[at(row, col)] = disc;
    const score = winningLine(board, row, col) ? WIN : -negamax(board, depth - 1, -Infinity, Infinity, other, 1, deadline);
    board[at(row, col)] = 0;
    scores.set(col, score);
  }
  return scores;
}

function immediate(board: Cell[], disc: 1 | 2): number | null {
  for (const col of ORDER) {
    const row = dropRow(board, col);
    if (row < 0) continue;
    board[at(row, col)] = disc;
    const wins = winningLine(board, row, col) !== null;
    board[at(row, col)] = 0;
    if (wins) return col;
  }
  return null;
}

export function chooseMove(position: Cell[], disc: 1 | 2, level: Level, seed: number): number {
  const board = [...position];
  const random = rng(seed);
  const legal = ORDER.filter((col) => dropRow(board, col) >= 0);
  const other: 1 | 2 = disc === 1 ? 2 : 1;

  if (level === "easy") {
    const win = immediate(board, disc);
    if (win !== null && random() < 0.85) return win;
    const block = immediate(board, other);
    if (block !== null && random() < 0.5) return block;
    return legal[Math.floor(random() * legal.length)];
  }

  if (level === "medium") {
    const scores = scoreMoves(board, disc, 4, Infinity);
    // A little noise on ordinary moves (never on wins or losses) keeps it human.
    let best = legal[0];
    let bestScore = -Infinity;
    for (const [col, score] of scores) {
      const noisy = Math.abs(score) >= WIN - 100 ? score : score + random() * 6;
      if (noisy > bestScore) {
        bestScore = noisy;
        best = col;
      }
    }
    return best;
  }

  // Hard: deeper and deeper until time runs out; the last full search decides.
  const deadline = Date.now() + 450;
  let best = immediate(board, disc) ?? legal[0];
  if (immediate(board, disc) !== null) return best;
  for (let depth = 2; depth <= 12; depth += 2) {
    try {
      const scores = scoreMoves(board, disc, depth, deadline);
      let bestScore = -Infinity;
      for (const [col, score] of scores) {
        if (score > bestScore) {
          bestScore = score;
          best = col;
        }
      }
      if (bestScore >= WIN - 100 || bestScore <= -(WIN - 100)) break;
    } catch (error) {
      if (error instanceof OutOfTime) break;
      throw error;
    }
  }
  return best;
}
