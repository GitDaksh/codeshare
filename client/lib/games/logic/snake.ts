import { rng } from "@/lib/games/rng";
import type { MatchEvent, MatchInfo, Standing } from "@/lib/games/types";

// Byte Snake's rules. Every player steers their own snake on their own copy
// of the same 20 × 20 board (same start, same bytes), so friends race side
// by side without getting in each other's way; you see their snakes as
// ghosts. Solo, a crash ends the game. Online, a crash costs you your length
// (and the bonus that comes with it), and you're back after a moment; most
// points when time runs out wins.
//
// A turn is sent with the step it's meant for (`k`), so your snake turns
// exactly where you pressed, even if the move takes a moment to travel.
// Turns that arrive too late (more than MAX_LATE_MS after their step) count
// from when they arrived instead.

export const SIZE = 20;
export const CELLS = SIZE * SIZE;
// Directions: 0 up, 1 right, 2 down, 3 left.
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
const MAX_LATE_MS = 400;
export const RESPAWN_MS = 1500;
// A golden byte disappears after this many steps.
export const GOLDEN_STEPS = 45;
const START_X = 5;
const START_Y = 10;
const START_DIR = 1;
const START_LENGTH = 3;

export const cellOf = (x: number, y: number) => y * SIZE + x;
export const xOf = (cell: number) => cell % SIZE;
export const yOf = (cell: number) => Math.floor(cell / SIZE);

// Longer snakes move faster.
export function stepMs(length: number): number {
  return Math.max(70, 135 - (length - START_LENGTH) * 3);
}
// ... and score more for each byte: ×2 from 11 long, ×3 from 19, and so on.
export function multiplier(length: number): number {
  return 1 + Math.floor((length - START_LENGTH) / 8);
}

export function durationMs(match: MatchInfo): number | null {
  if (match.players.length === 1) return null;
  const seconds = Number(match.settings.seconds);
  return ([60, 120, 180].includes(seconds) ? seconds : 120) * 1000;
}

export type Turn = { d: number; k: number; t: number };
export type Food = { cell: number; golden: boolean; until: number | null };

// One player's run, step by step. Deterministic: the same turns give the
// same game in every browser.
export class SnakeSim {
  readonly id: string;
  private readonly seed: number;
  private readonly solo: boolean;
  private readonly endsAt: number;
  body: number[] = [];
  private occupied = new Uint8Array(CELLS);
  dir = START_DIR;
  // Steps taken so far, and when the last one and the next one happen.
  step = 0;
  lastAt = 0;
  nextAt = 0;
  private grow = 0;
  food: Food = { cell: 0, golden: false, until: null };
  private foodNo = 0;
  points = 0;
  eaten = 0;
  deaths = 0;
  longest = START_LENGTH;
  alive = true;
  respawnAt: number | null = null;
  // Solo: the run is over (crashed).
  over = false;
  crash: { t: number; cell: number } | null = null;
  lastEat: { t: number; cell: number; points: number; golden: boolean } | null = null;
  leftAt: number | null = null;
  private queue: Turn[] = [];
  // How many turns have been handed to the simulation.
  fed = 0;

  constructor(id: string, seed: number, solo: boolean, endsAt: number | null) {
    this.id = id;
    this.seed = seed;
    this.solo = solo;
    this.endsAt = endsAt ?? Infinity;
    this.spawn(0);
    this.food = this.newFood();
  }

  get length() {
    return this.body.length;
  }

  // The direction the snake will be going once the queued turns are taken.
  plannedDir(): number {
    let dir = this.dir;
    for (const turn of this.queue) if (turn.d !== dir && turn.d !== (dir + 2) % 4) dir = turn.d;
    return dir;
  }

  // The direction the next step will take (for drawing the head gliding
  // into its next space).
  upcomingDir(): number {
    const turn = this.queue[0];
    if (turn && turn.k <= this.step + 1 && turn.d !== this.dir && turn.d !== (this.dir + 2) % 4) return turn.d;
    return this.dir;
  }

  // Whether the snake grows on its next step (its tail stays put).
  get growing(): boolean {
    return this.grow > 0;
  }

  // The step a new turn should be sent for.
  nextFreeStep(): number {
    let k = this.step + 1;
    for (const turn of this.queue) k = Math.max(k, turn.k + 1);
    return k;
  }

  // Would this turn have changed steps already taken?
  wouldRewrite(turn: Turn): boolean {
    return turn.k <= this.step && this.lastAt >= turn.t - MAX_LATE_MS;
  }

  feed(turn: Turn) {
    this.queue.push(turn);
    this.fed += 1;
  }

  leave(at: number) {
    this.leftAt = at;
  }

  private spawn(at: number) {
    this.occupied.fill(0);
    this.body = [];
    for (let i = 0; i < START_LENGTH; i++) {
      const cell = cellOf(START_X - i, START_Y);
      this.body.push(cell);
      this.occupied[cell] = 1;
    }
    this.dir = START_DIR;
    this.grow = 0;
    this.alive = true;
    this.respawnAt = null;
    this.lastAt = at;
    this.nextAt = at + stepMs(START_LENGTH);
  }

  private newFood(): Food {
    this.foodNo += 1;
    const random = rng((this.seed ^ Math.imul(this.foodNo, 0x9e3779b1)) >>> 0);
    // The same spot for everyone, unless it's under your own snake (then the
    // next free space along).
    let cell = Math.floor(random() * CELLS);
    while (this.occupied[cell]) cell = (cell + 1) % CELLS;
    const golden = this.foodNo > 2 && random() < 1 / 6;
    return { cell, golden, until: golden ? this.step + GOLDEN_STEPS : null };
  }

  // Plays the game forward to match time `t`.
  advance(t: number) {
    const limit = Math.min(t, this.endsAt);
    for (;;) {
      if (this.over) return;
      // Nothing more happens once the player has left.
      if (this.leftAt !== null && (this.alive ? this.nextAt : (this.respawnAt ?? Infinity)) >= this.leftAt) return;
      if (!this.alive) {
        if (this.respawnAt === null || this.respawnAt > limit) return;
        // Turns made while crashed don't carry over.
        const back = this.respawnAt;
        this.queue = this.queue.filter((turn) => turn.t >= back);
        this.spawn(back);
        if (this.occupied[this.food.cell]) this.food = this.newFood();
        continue;
      }
      if (this.nextAt > limit) return;
      this.takeStep();
    }
  }

  private takeStep() {
    const at = this.nextAt;
    const n = this.step + 1;
    // At most one turn per step: the first one that's due (and allowed).
    while (this.queue.length) {
      const turn = this.queue[0];
      if (turn.k > n || at < turn.t - MAX_LATE_MS) break;
      this.queue.shift();
      if (turn.d !== this.dir && turn.d !== (this.dir + 2) % 4 && turn.d >= 0 && turn.d < 4) {
        this.dir = turn.d;
        break;
      }
    }
    this.step = n;
    this.lastAt = at;
    const head = this.body[0];
    const x = xOf(head) + DX[this.dir];
    const y = yOf(head) + DY[this.dir];
    const outside = x < 0 || x >= SIZE || y < 0 || y >= SIZE;
    const cell = outside ? -1 : cellOf(x, y);
    // The tail moves out of the way this step (unless the snake is growing),
    // so following it closely is fine.
    const tail = this.body[this.body.length - 1];
    const freed = this.grow > 0 ? -1 : tail;
    if (outside || (this.occupied[cell] && cell !== freed)) {
      this.crash = { t: at, cell: outside ? head : cell };
      this.deaths += 1;
      if (this.solo) {
        this.over = true;
        return;
      }
      this.alive = false;
      this.respawnAt = at + RESPAWN_MS;
      this.queue = [];
      return;
    }
    if (this.grow > 0) this.grow -= 1;
    else {
      this.body.pop();
      this.occupied[tail] = 0;
    }
    this.body.unshift(cell);
    this.occupied[cell] = 1;
    if (cell === this.food.cell) {
      const value = (this.food.golden ? 50 : 10) * multiplier(this.body.length);
      this.points += value;
      this.eaten += 1;
      this.grow += 1;
      this.lastEat = { t: at, cell, points: value, golden: this.food.golden };
      this.longest = Math.max(this.longest, this.body.length + this.grow);
      this.food = this.newFood();
    } else if (this.food.until !== null && n >= this.food.until) {
      // The golden byte got away.
      this.food = this.newFood();
    }
    this.nextAt = at + stepMs(this.body.length + this.grow);
  }
}

// Each player's turns, in the order they were made.
export function turnsBy(events: MatchEvent[]): Map<string, Turn[]> {
  const turns = new Map<string, Turn[]>();
  for (const event of events) {
    if (event.type !== "turn") continue;
    const data = event.data as { d?: unknown; k?: unknown };
    if (typeof data?.d !== "number" || typeof data.k !== "number" || !Number.isInteger(data.d) || !Number.isInteger(data.k)) continue;
    const list = turns.get(event.by) ?? [];
    list.push({ d: data.d, k: data.k, t: event.t });
    turns.set(event.by, list);
  }
  return turns;
}

export function leftTimes(events: MatchEvent[]): Map<string, number> {
  const left = new Map<string, number>();
  for (const event of events) {
    if (event.by === "system" && event.type === "left") {
      const id = (event.data as { id?: string })?.id;
      if (id && !left.has(id)) left.set(id, event.t);
    }
  }
  return left;
}

// Everyone's game at match time `t`, worked out from the start.
export function snakeWorld(match: MatchInfo, events: MatchEvent[], t: number): Map<string, SnakeSim> {
  const solo = match.players.length === 1;
  const ends = durationMs(match);
  const turns = turnsBy(events);
  const left = leftTimes(events);
  const world = new Map<string, SnakeSim>();
  for (const p of match.players) {
    const sim = new SnakeSim(p.id, match.seed, solo, ends);
    for (const turn of turns.get(p.id) ?? []) sim.feed(turn);
    const gone = left.get(p.id);
    if (gone !== undefined && (ends === null || gone < ends)) sim.leave(gone);
    sim.advance(t);
    world.set(p.id, sim);
  }
  return world;
}

export function snakeStandings(match: MatchInfo, world: Map<string, SnakeSim>): Standing[] {
  const solo = match.players.length === 1;
  return match.players.map((p) => {
    const sim = world.get(p.id)!;
    const crashes = `${sim.deaths} crash${sim.deaths === 1 ? "" : "es"}`;
    const bytes = `${sim.eaten} byte${sim.eaten === 1 ? "" : "s"}`;
    return {
      id: p.id,
      score: sim.leftAt !== null && !solo ? -1 : sim.points,
      label: `${sim.points.toLocaleString()} pts`,
      detail: sim.leftAt !== null && !solo ? "Left the game" : solo ? `${bytes} · ${sim.longest} long` : `${bytes} · ${crashes}`,
      stat: sim.points,
    };
  });
}

// Keeps everyone's game up to date as time passes and moves arrive, without
// replaying from the start every frame. A player's game is replayed only
// when a move arrives that should already have happened (other players'
// turns, which take a moment to travel), or one is taken back.
export class SnakeCache {
  private matchId = "";
  private sims = new Map<string, SnakeSim>();

  // `local`: turns this browser just made that may not be in `events` yet
  // (so your snake answers before the move has been recorded).
  update(match: MatchInfo, events: MatchEvent[], t: number, local?: { id: string; turns: Turn[] }): Map<string, SnakeSim> {
    if (match.id !== this.matchId) {
      this.matchId = match.id;
      this.sims = new Map();
    }
    const solo = match.players.length === 1;
    const ends = durationMs(match);
    const turns = turnsBy(events);
    const left = leftTimes(events);
    for (const p of match.players) {
      let list = turns.get(p.id) ?? [];
      if (local && local.id === p.id && local.turns.length) {
        const lastK = list.length ? list[list.length - 1].k : -1;
        const extra = local.turns.filter((turn) => turn.k > lastK);
        if (extra.length) list = [...list, ...extra];
      }
      const leftAt = left.get(p.id);
      // Leaving after time's up changes nothing.
      const gone = leftAt !== undefined && (ends === null || leftAt < ends) ? leftAt : undefined;
      let sim = this.sims.get(p.id);
      const stale =
        !sim ||
        list.length < sim.fed ||
        list.slice(sim.fed).some((turn) => sim!.wouldRewrite(turn)) ||
        (gone !== undefined && sim.leftAt === null && sim.lastAt >= gone);
      if (stale) {
        sim = new SnakeSim(p.id, match.seed, solo, ends);
        this.sims.set(p.id, sim);
      }
      while (sim!.fed < list.length) sim!.feed(list[sim!.fed]);
      if (gone !== undefined && sim!.leftAt === null) sim!.leave(gone);
      sim!.advance(t);
    }
    return this.sims;
  }
}
