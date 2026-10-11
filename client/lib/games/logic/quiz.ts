import { rng, shuffled } from "@/lib/games/rng";
import type { MatchEvent, MatchInfo, Standing } from "@/lib/games/types";

// The engine behind the three quiz games (Output Oracle, Big-O Blitz, Bug
// Hunt). A match is a series of rounds. Each round is open for a while
// (or until everyone has answered), then shows the answer, then the next
// one starts. Everything is worked out from the match's moves and their
// times, so every browser agrees on when each round started and ended.

export type QuizTiming = {
  // How long a question is open.
  questionMs: number;
  // How long the answer stays on screen before the next question.
  revealMs: number;
};

export const MAX_POINTS = 1000;
// Each correct answer in a row after the first adds this (up to 5 times).
export const STREAK_BONUS = 100;

export function pickItems<T extends { id: string }>(seed: number, deck: T[], count: number): T[] {
  return shuffled(rng(seed), deck).slice(0, Math.min(count, deck.length));
}

export type QuizAnswer = { choice: number; t: number; correct: boolean; points: number };

export type QuizRound = {
  index: number;
  start: number;
  // When answers stopped being accepted (null: still open at the time asked).
  closedAt: number | null;
  answers: Map<string, QuizAnswer>;
};

export type QuizPlayer = { score: number; streak: number; correct: number; left: boolean };

export type QuizState = {
  rounds: QuizRound[];
  players: Map<string, QuizPlayer>;
  // The round on screen and whether it's showing the answer.
  current: number;
  phase: "question" | "reveal" | "over";
  // When the current phase ends (match time), if known.
  phaseEndsAt: number | null;
};

export function quizState(
  match: MatchInfo,
  events: MatchEvent[],
  t: number,
  timing: QuizTiming,
  roundCount: number,
  isCorrect: (round: number, choice: number) => boolean
): QuizState {
  const players = new Map<string, QuizPlayer>(match.players.map((p) => [p.id, { score: 0, streak: 0, correct: 0, left: false }]));
  const people = match.players.filter((p) => !p.bot).map((p) => p.id);
  const rounds: QuizRound[] = [];
  let cursor = 0;
  let start = 0;

  for (let index = 0; index < roundCount; index++) {
    const round: QuizRound = { index, start, closedAt: null, answers: new Map() };
    rounds.push(round);
    const deadline = start + timing.questionMs;
    // Answers for this round, in order, until everyone (still here) has answered.
    while (cursor < events.length && events[cursor].t <= deadline) {
      const event = events[cursor++];
      if (event.by === "system" && event.type === "left") {
        const player = players.get((event.data as { id?: string })?.id ?? "");
        if (player) player.left = true;
      } else if (event.type === "answer") {
        const data = event.data as { r?: unknown; a?: unknown };
        const player = players.get(event.by);
        if (player && data?.r === index && typeof data.a === "number" && event.t >= start && !round.answers.has(event.by)) {
          const correct = isCorrect(index, data.a);
          const speed = 1 - (event.t - start) / timing.questionMs;
          const points = correct ? Math.round(MAX_POINTS / 2 + (MAX_POINTS / 2) * Math.max(0, speed)) : 0;
          round.answers.set(event.by, { choice: data.a, t: event.t, correct, points });
        }
      }
      const everyone = people.every((id) => round.answers.has(id) || players.get(id)!.left);
      if (everyone) {
        round.closedAt = event.t;
        break;
      }
    }
    if (round.closedAt === null) {
      if (t < deadline) break;
      round.closedAt = deadline;
      // Skip anything else timed inside this round (late answers).
      while (cursor < events.length && events[cursor].t <= deadline) {
        const event = events[cursor++];
        if (event.by === "system" && event.type === "left") {
          const player = players.get((event.data as { id?: string })?.id ?? "");
          if (player) player.left = true;
        }
      }
    }
    // Score the round once it's closed.
    for (const [id, player] of players) {
      const answer = round.answers.get(id);
      if (answer?.correct) {
        player.streak += 1;
        player.correct += 1;
        answer.points += STREAK_BONUS * Math.min(player.streak - 1, 5);
        player.score += answer.points;
      } else player.streak = 0;
    }
    start = round.closedAt + timing.revealMs;
    if (t < start) break;
  }

  const last = rounds[rounds.length - 1];
  let phase: QuizState["phase"];
  let phaseEndsAt: number | null;
  if (last.closedAt === null) {
    phase = "question";
    phaseEndsAt = last.start + timing.questionMs;
  } else if (t < last.closedAt + timing.revealMs) {
    phase = "reveal";
    phaseEndsAt = last.closedAt + timing.revealMs;
  } else {
    phase = "over";
    phaseEndsAt = null;
  }
  return { rounds, players, current: last.index, phase, phaseEndsAt };
}

export function quizStandings(match: MatchInfo, state: QuizState, roundCount: number): Standing[] {
  return match.players.map((p) => {
    const player = state.players.get(p.id)!;
    return {
      id: p.id,
      score: player.score,
      label: `${player.score.toLocaleString()} pts`,
      detail: `${player.correct} of ${roundCount} right${player.left ? " · left" : ""}`,
      stat: player.score,
    };
  });
}
