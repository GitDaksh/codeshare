import { rng, shuffled } from "@/lib/games/rng";
import { PAIRS, type ConceptPair, type PairTopic } from "@/lib/games/content/pairs";
import type { MatchEvent, MatchInfo, Standing } from "@/lib/games/types";

// Pair Programming's rules: a memory game. Cards are dealt face down; flip
// two at a time. A pair that belongs together stays face up and is yours,
// and you go again. Otherwise both are shown for a moment, flip back, and
// (with friends) the turn passes on. Online, a turn has a time limit: when
// it runs out, another player's browser says so and the turn moves on.

export const PAIR_OPTIONS = [6, 8, 12] as const;
export const TURN_MS = 15_000;
// A time-out may be claimed this much early (clocks differ a little).
const CLAIM_SLACK_MS = 1000;

export type Card = { pair: number; side: 0 | 1; text: string; code: boolean; topic: PairTopic };

export function pairCount(match: MatchInfo): number {
  const n = Number(match.settings.pairs);
  return (PAIR_OPTIONS as readonly number[]).includes(n) ? n : 8;
}

// How long a missed pair stays face up.
export function revealMs(match: MatchInfo): number {
  return match.players.length > 1 ? 1300 : 850;
}

const decks = new Map<string, { pairs: ConceptPair[]; cards: Card[] }>();

// The pairs in a match and the cards in their places (the same for everyone).
export function deal(seed: number, count: number): { pairs: ConceptPair[]; cards: Card[] } {
  const key = `${seed}:${count}`;
  const cached = decks.get(key);
  if (cached) return cached;
  const random = rng(seed);
  const groups = new Set<string>();
  const pairs: ConceptPair[] = [];
  for (const pair of shuffled(random, PAIRS)) {
    if (groups.has(pair.group)) continue;
    groups.add(pair.group);
    pairs.push(pair);
    if (pairs.length === count) break;
  }
  const cards = shuffled(
    random,
    pairs.flatMap((pair, i): Card[] => [
      { pair: i, side: 0, text: pair.a.text, code: !!pair.a.code, topic: pair.topic },
      { pair: i, side: 1, text: pair.b.text, code: !!pair.b.code, topic: pair.topic },
    ])
  );
  if (decks.size > 40) decks.clear();
  const deck = { pairs, cards };
  decks.set(key, deck);
  return deck;
}

// `streak`: pairs found in a row without a miss.
export type PairsPlayer = { pairs: number; misses: number; flips: number; streak: number; left: boolean };

export type PairsState = {
  cards: Card[];
  // Who found each card (null: not found yet), and when.
  foundBy: (string | null)[];
  foundAt: (number | null)[];
  // Face-up cards not yet found: the first pick, or a missed pair on show.
  open: number[];
  // When the missed pair on show flips back (match time).
  hideAt: number | null;
  // Whose turn it is (an index into the match's players), and since when.
  turn: number;
  turnNo: number;
  turnStart: number;
  players: Map<string, PairsPlayer>;
  lastFound: { by: string; cards: [number, number]; t: number } | null;
  lastMiss: { by: string; cards: [number, number]; t: number } | null;
  over: boolean;
  endedAt: number | null;
};

// The game after these moves, as it looks at match time `t`.
export function pairsState(match: MatchInfo, events: MatchEvent[], t = Infinity): PairsState {
  const { cards } = deal(match.seed, pairCount(match));
  const ids = match.players.map((p) => p.id);
  const reveal = revealMs(match);
  const state: PairsState = {
    cards,
    foundBy: Array(cards.length).fill(null),
    foundAt: Array(cards.length).fill(null),
    open: [],
    hideAt: null,
    turn: (match.number - 1) % ids.length,
    turnNo: 0,
    turnStart: 0,
    players: new Map(ids.map((id) => [id, { pairs: 0, misses: 0, flips: 0, streak: 0, left: false }])),
    lastFound: null,
    lastMiss: null,
    over: false,
    endedAt: null,
  };
  const here = () => ids.filter((id) => !state.players.get(id)!.left);
  const passTurn = (at: number) => {
    for (let k = 1; k <= ids.length; k++) {
      const next = (state.turn + k) % ids.length;
      if (!state.players.get(ids[next])!.left) {
        state.turn = next;
        break;
      }
    }
    state.turnNo += 1;
    state.turnStart = at;
  };
  // A missed pair flips back once its time is up.
  const settle = (at: number) => {
    if (state.hideAt !== null && at >= state.hideAt) {
      state.open = [];
      state.hideAt = null;
    }
  };

  for (const event of events) {
    if (state.over) break;
    settle(event.t);
    if (event.by === "system" && event.type === "left") {
      const id = (event.data as { id?: string })?.id ?? "";
      const player = state.players.get(id);
      if (!player || player.left) continue;
      player.left = true;
      if (ids.length > 1 && here().length < 2) {
        state.over = true;
        state.endedAt = event.t;
        break;
      }
      if (ids[state.turn] === id) {
        if (state.hideAt === null) state.open = [];
        passTurn(Math.max(event.t, state.hideAt ?? 0));
      }
      continue;
    }
    const mover = ids[state.turn];
    if (event.type === "flip") {
      const i = (event.data as { i?: unknown })?.i;
      if (event.by !== mover || state.hideAt !== null) continue;
      if (typeof i !== "number" || !Number.isInteger(i) || i < 0 || i >= cards.length) continue;
      if (state.foundBy[i] || state.open.includes(i)) continue;
      const player = state.players.get(mover)!;
      player.flips += 1;
      if (state.open.length === 0) {
        state.open = [i];
        continue;
      }
      const first = state.open[0];
      if (cards[first].pair === cards[i].pair) {
        state.foundBy[first] = mover;
        state.foundBy[i] = mover;
        state.foundAt[first] = event.t;
        state.foundAt[i] = event.t;
        player.pairs += 1;
        player.streak += 1;
        state.open = [];
        state.lastFound = { by: mover, cards: [first, i], t: event.t };
        // Found one: go again, with a fresh clock.
        state.turnStart = event.t;
        if (state.foundBy.every(Boolean)) {
          state.over = true;
          state.endedAt = event.t;
        }
      } else {
        player.misses += 1;
        player.streak = 0;
        state.open = [first, i];
        state.hideAt = event.t + reveal;
        state.lastMiss = { by: mover, cards: [first, i], t: event.t };
        passTurn(state.hideAt);
      }
    } else if (event.type === "skip") {
      // Someone else says the mover's time is up.
      const claimer = state.players.get(event.by);
      const m = (event.data as { m?: unknown })?.m;
      if (event.by === mover || !claimer || claimer.left || m !== state.turnNo) continue;
      if (event.t < state.turnStart + TURN_MS - CLAIM_SLACK_MS) continue;
      if (state.hideAt === null) state.open = [];
      passTurn(event.t);
    }
  }
  if (!state.over) settle(t);
  return state;
}

// Solo score: points for every pair, more for few misses and for speed.
export function soloPoints(pairs: number, misses: number, seconds: number): number {
  return pairs * 100 + Math.max(0, pairs * 2 - misses) * 30 + Math.max(0, pairs * 6 - seconds) * 10;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : word.endsWith("s") ? "es" : "s"}`;

export function pairsStandings(match: MatchInfo, state: PairsState): Standing[] {
  const count = pairCount(match);
  const solo = match.players.length === 1;
  return match.players.map((p) => {
    const player = state.players.get(p.id)!;
    if (solo) {
      const seconds = Math.max(1, Math.round((state.endedAt ?? 0) / 1000));
      const points = soloPoints(count, player.misses, seconds);
      return {
        id: p.id,
        score: points,
        label: `${points.toLocaleString()} pts`,
        detail: `${count} pairs in ${seconds}s · ${plural(player.misses, "miss")}`,
        stat: points,
      };
    }
    return {
      id: p.id,
      score: player.left ? -1 : player.pairs,
      label: plural(player.pairs, "pair"),
      detail: player.left ? "Left the game" : plural(player.misses, "miss"),
      stat: 0,
    };
  });
}
