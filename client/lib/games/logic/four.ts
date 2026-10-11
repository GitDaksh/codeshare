import { rng } from "@/lib/games/rng";
import type { MatchEvent, MatchInfo, Standing } from "@/lib/games/types";

// Four in a Row's rules: a 7 × 6 grid, discs fall to the lowest free space,
// four in a line wins. The players take turns; who goes first alternates
// from one match to the next. Online, each turn has a time limit: when it
// runs out, the waiting player's browser says so and a random disc is
// dropped for the slow player.

export const COLS = 7;
export const ROWS = 6;

// How long each turn may take online.
export const TURN_MS = 30_000;
// A time-out may be claimed this much early (clocks differ a little).
const CLAIM_SLACK_MS = 1000;

// 0 = empty, 1 = the first player's disc, 2 = the second player's.
export type Cell = 0 | 1 | 2;

export type Move = {
  col: number;
  row: number;
  disc: 1 | 2;
  t: number;
  // Dropped for the player because their time ran out.
  auto?: boolean;
};

export type FourState = {
  board: Cell[];
  moves: Move[];
  // Whose turn it is: 1 or 2 (the disc they play).
  turn: 1 | 2;
  // When the current turn started (match time).
  turnStart: number;
  winner: 1 | 2 | null;
  // The four (or more) winning cells, as [row, col].
  line: [number, number][] | null;
  draw: boolean;
  // The player who left mid-game (the other one wins).
  forfeit: string | null;
  // When the game ended (match time).
  endedAt: number | null;
};

export const at = (row: number, col: number) => row * COLS + col;

// Player ids in disc order: [disc 1, disc 2].
export function seating(match: MatchInfo): [string, string] {
  const [a, b] = match.players;
  const swap = (match.number - 1) % 2 === 1;
  return swap ? [b.id, a.id] : [a.id, b.id];
}

export function dropRow(board: Cell[], col: number): number {
  for (let row = ROWS - 1; row >= 0; row--) if (board[at(row, col)] === 0) return row;
  return -1;
}

const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export function winningLine(board: Cell[], row: number, col: number): [number, number][] | null {
  const disc = board[at(row, col)];
  if (!disc) return null;
  for (const [dr, dc] of DIRECTIONS) {
    const cells: [number, number][] = [[row, col]];
    for (const sign of [1, -1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[at(r, c)] === disc) {
        cells.push([r, c]);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}

// Which columns are full, one bit per column.
export function fullColumns(board: Cell[]): number {
  let mask = 0;
  for (let col = 0; col < COLS; col++) if (board[at(0, col)] !== 0) mask |= 1 << col;
  return mask;
}

// The column a timed-out player's disc goes in: random, but the same in
// every browser.
export function autoColumn(seed: number, board: Cell[], moveCount: number): number {
  const legal: number[] = [];
  for (let col = 0; col < COLS; col++) if (dropRow(board, col) >= 0) legal.push(col);
  return legal[Math.floor(rng((seed ^ Math.imul(moveCount + 1, 0x9e3779b1)) >>> 0)() * legal.length)];
}

export function fourState(match: MatchInfo, events: MatchEvent[]): FourState {
  const [first, second] = seating(match);
  const state: FourState = {
    board: Array(ROWS * COLS).fill(0),
    moves: [],
    turn: 1,
    turnStart: 0,
    winner: null,
    line: null,
    draw: false,
    forfeit: null,
    endedAt: null,
  };

  const play = (col: number, t: number, auto: boolean) => {
    const row = dropRow(state.board, col);
    if (row < 0) return;
    state.board[at(row, col)] = state.turn;
    state.moves.push(auto ? { col, row, disc: state.turn, t, auto } : { col, row, disc: state.turn, t });
    const line = winningLine(state.board, row, col);
    if (line) {
      state.winner = state.turn;
      state.line = line;
      state.endedAt = t;
    } else if (state.moves.length === ROWS * COLS) {
      state.draw = true;
      state.endedAt = t;
    } else {
      state.turn = state.turn === 1 ? 2 : 1;
      state.turnStart = t;
    }
  };

  for (const event of events) {
    if (state.winner || state.draw) break;
    if (event.by === "system" && event.type === "left") {
      const id = (event.data as { id?: string })?.id;
      if (id === first || id === second) {
        state.forfeit = id;
        state.winner = id === first ? 2 : 1;
        state.endedAt = event.t;
      }
      continue;
    }
    const mover = state.turn === 1 ? first : second;
    if (event.type === "drop") {
      const col = (event.data as { c?: unknown })?.c;
      if (event.by !== mover || typeof col !== "number" || !Number.isInteger(col) || col < 0 || col >= COLS) continue;
      play(col, event.t, false);
    } else if (event.type === "timeout") {
      // The waiting player says the mover's time is up.
      const waiting = state.turn === 1 ? second : first;
      const m = (event.data as { m?: unknown })?.m;
      if (event.by !== waiting || m !== state.moves.length || event.t < state.turnStart + TURN_MS - CLAIM_SLACK_MS) continue;
      play(autoColumn(match.seed, state.board, state.moves.length), event.t, true);
    }
  }
  return state;
}

export function isOver(state: FourState): boolean {
  return state.winner !== null || state.draw;
}

// The last "aim" (the column a player is hovering over) each player sent
// during the current turn, so others can watch their disc move.
export function aimOf(events: MatchEvent[], state: FourState, player: string): number | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.t < state.turnStart) break;
    if (event.by !== player || event.type !== "aim") continue;
    const col = (event.data as { c?: unknown })?.c;
    return typeof col === "number" && Number.isInteger(col) && col >= 0 && col < COLS ? col : null;
  }
  return null;
}

const LEVELS: Record<string, number> = { easy: 1, medium: 2, hard: 3 };

export function fourStandings(match: MatchInfo, state: FourState, solo: boolean): Standing[] {
  const [first, second] = seating(match);
  const level = LEVELS[String(match.settings.level)] ?? 2;
  return match.players.map((p) => {
    const disc = p.id === first ? 1 : p.id === second ? 2 : 0;
    const won = state.winner !== null && state.winner === disc;
    const lost = state.winner !== null && !won;
    const moves = state.moves.filter((m) => m.disc === disc).length;
    return {
      id: p.id,
      score: won ? 2 : state.draw ? 1 : 0,
      label: won ? "Winner" : state.draw ? "Draw" : "Lost",
      detail: state.forfeit && won ? "The other player left" : `${moves} move${moves === 1 ? "" : "s"}`,
      // Solo, your best is the hardest computer you've beaten (1–3).
      stat: p.bot ? undefined : solo ? (won ? level : 0) : 0,
      won: lost ? false : won,
    };
  });
}
