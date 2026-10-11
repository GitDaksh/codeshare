import { ANSWERS, isAllowed } from "@/lib/games/content/keywords";
import { rng, seedFrom, shuffled } from "@/lib/games/rng";
import type { MatchEvent, MatchInfo, Standing } from "@/lib/games/types";

// Keyword's rules: the words, the colors a guess gets, each player's boards
// and scores, and when it's over.

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;
// Online, each word gets this long (the whole match: words × this).
export const WORD_TIME_MS = 3 * 60_000;

// hit: right letter, right spot (green); near: in the word, elsewhere
// (yellow); miss: not in the word.
export type Mark = "hit" | "near" | "miss";
export type KeywordMode = "online" | "daily" | "endless";

export function marksFor(guess: string, answer: string): Mark[] {
  const result: Mark[] = Array(WORD_LENGTH).fill("miss");
  const unmatched = new Map<string, number>();
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answer[i]) result[i] = "hit";
    else unmatched.set(answer[i], (unmatched.get(answer[i]) ?? 0) + 1);
  }
  // Yellow only as many times as the letter is still unmatched in the answer.
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === "hit") continue;
    const left = unmatched.get(guess[i]) ?? 0;
    if (left > 0) {
      result[i] = "near";
      unmatched.set(guess[i], left - 1);
    }
  }
  return result;
}

export function validGuess(word: string): boolean {
  return /^[a-z]{5}$/.test(word) && isAllowed(word);
}

// The same word for everyone on the same day.
export function dailyAnswer(day: string): string {
  return ANSWERS[seedFrom(`keyword:${day}`) % ANSWERS.length];
}

const orders = new Map<number, string[]>();
function answerAt(seed: number, index: number): string {
  if (!orders.has(seed)) orders.set(seed, shuffled(rng(seed), ANSWERS));
  const order = orders.get(seed)!;
  return order[index % order.length];
}

export function wordCount(match: MatchInfo, mode: KeywordMode): number {
  if (mode === "daily") return 1;
  if (mode === "endless") return Infinity;
  return Number(match.settings.words) || 3;
}

export type Round = {
  answer: string;
  guesses: string[];
  // When each guess was made (match time), for the reveal animation.
  times: number[];
  solved: boolean;
  done: boolean;
  startedAt: number;
  doneAt: number | null;
};

export type KeywordPlayer = { rounds: Round[]; left: boolean; score: number; finished: boolean };

// A solved word scores 100 for every guess to spare (600 for a first-try
// hit), plus a point for every second under two minutes.
export function roundScore(round: Round): number {
  if (!round.solved || round.doneAt === null) return 0;
  const seconds = Math.floor((round.doneAt - round.startedAt) / 1000);
  return 100 * (MAX_GUESSES + 1 - round.guesses.length) + Math.max(0, 120 - seconds);
}

export function keywordState(match: MatchInfo, events: MatchEvent[], mode: KeywordMode, day: string): Map<string, KeywordPlayer> {
  const total = wordCount(match, mode);
  const answer = (index: number) => (mode === "daily" ? dailyAnswer(day) : answerAt(match.seed, index));
  const players = new Map<string, KeywordPlayer>();
  for (const p of match.players) {
    players.set(p.id, {
      rounds: [{ answer: answer(0), guesses: [], times: [], solved: false, done: false, startedAt: 0, doneAt: null }],
      left: false,
      score: 0,
      finished: false,
    });
  }
  for (const event of events) {
    if (event.by === "system" && event.type === "left") {
      const player = players.get((event.data as { id?: string })?.id ?? "");
      if (player) player.left = true;
      continue;
    }
    const player = players.get(event.by);
    const word = (event.data as { w?: unknown })?.w;
    if (event.type !== "guess" || !player || player.finished || typeof word !== "string" || !validGuess(word)) continue;
    // Online, guesses after time's up don't count.
    if (mode === "online" && event.t > total * WORD_TIME_MS) continue;
    const round = player.rounds[player.rounds.length - 1];
    round.guesses.push(word);
    round.times.push(event.t);
    if (word === round.answer || round.guesses.length >= MAX_GUESSES) {
      round.solved = word === round.answer;
      round.done = true;
      round.doneAt = event.t;
      player.score += roundScore(round);
      // Endless ends at the first miss; otherwise on to the next word.
      const more = player.rounds.length < total && (mode !== "endless" || round.solved);
      if (more) {
        const index = player.rounds.length;
        player.rounds.push({ answer: answer(index), guesses: [], times: [], solved: false, done: false, startedAt: event.t, doneAt: null });
      } else player.finished = true;
    }
  }
  return players;
}

export function keywordOver(match: MatchInfo, players: Map<string, KeywordPlayer>, t: number, mode: KeywordMode): boolean {
  const people = match.players.filter((p) => !p.bot).map((p) => players.get(p.id)!);
  if (mode !== "online") return people.every((p) => p.finished);
  if (t >= wordCount(match, mode) * WORD_TIME_MS) return true;
  return people.every((p) => p.finished || p.left);
}

export function keywordStandings(match: MatchInfo, players: Map<string, KeywordPlayer>, mode: KeywordMode): Standing[] {
  const total = wordCount(match, mode);
  return match.players.map((p) => {
    const player = players.get(p.id)!;
    const solved = player.rounds.filter((r) => r.solved).length;
    const lastSolve = Math.max(0, ...player.rounds.filter((r) => r.solved).map((r) => r.doneAt ?? 0));
    let detail: string;
    if (mode === "endless") detail = `${solved} word${solved === 1 ? "" : "s"} in a row`;
    else if (mode === "daily") detail = solved ? `Solved in ${player.rounds[0].guesses.length}` : `The word was ${player.rounds[0].answer.toUpperCase()}`;
    else detail = `${solved} of ${total} solved${player.left ? " · left" : ""}`;
    return {
      id: p.id,
      // Ties on points go to whoever solved their last word first.
      score: player.score * 1e7 - lastSolve,
      label: `${player.score.toLocaleString()} pts`,
      detail,
      stat: player.score,
      won: mode === "online" ? undefined : solved > 0,
    };
  });
}

// The best color each letter has earned so far (for the keyboard).
export function letterMarks(round: Round | undefined): Map<string, Mark> {
  const best = new Map<string, Mark>();
  const rank: Record<Mark, number> = { miss: 0, near: 1, hit: 2 };
  for (const guess of round?.guesses ?? []) {
    marksFor(guess, round!.answer).forEach((mark, i) => {
      const letter = guess[i];
      const current = best.get(letter);
      if (!current || rank[mark] > rank[current]) best.set(letter, mark);
    });
  }
  return best;
}
