import { rng } from "@/lib/games/rng";
import { SNIPPETS, type RacerLanguage, type RacerLength, type Snippet } from "@/lib/games/content/snippets";
import type { MatchEvent, MatchInfo, Standing } from "@/lib/games/types";

// Code Racer's rules, as pure functions of the match: the snippet, where
// each racer is at any moment, when the race is over and who won.

export type Course = {
  snippet: Snippet;
  language: RacerLanguage;
  code: string;
  // The characters a racer types, as positions in the code: everything
  // except the indentation at the start of each line.
  stops: number[];
};

export function makeCourse(seed: number, language: RacerLanguage, length: RacerLength): Course {
  const list = SNIPPETS[language]?.[length] ?? SNIPPETS.javascript.medium;
  const snippet = list[Math.floor(rng(seed)() * list.length)];
  const code = snippet.code;
  const stops: number[] = [];
  let lineStart = true;
  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    if (lineStart && char === " ") continue;
    lineStart = char === "\n";
    stops.push(i);
  }
  return { snippet, language, code, stops };
}

export function wpm(chars: number, ms: number): number {
  return ms > 0 ? chars / 5 / (ms / 60000) : 0;
}

// ---------- Computer racers (solo) ----------

const BOT_WPM: Record<string, number> = { "bot:rookie": 34, "bot:racer": 55, "bot:ace": 82 };

// Characters a computer racer has typed after `t` ms: its steady speed,
// with a gentle wobble so it speeds up and slows down like a person (the
// wobble never makes it go backwards).
export function botTyped(course: Course, botId: string, seed: number, t: number): number {
  if (t <= 0) return 0;
  const rate = ((BOT_WPM[botId] ?? 45) * 5) / 60000;
  const phase = (seed % 997) / 997 * Math.PI * 2 + botId.length;
  const wobble = 380 * (Math.sin(t / 820 + phase) - Math.sin(phase));
  return Math.max(0, Math.min(course.stops.length, Math.floor(rate * (t + wobble))));
}

export function botFinishTime(course: Course, botId: string, seed: number): number {
  let low = 0;
  let high = 60 * 60_000;
  while (high - low > 5) {
    const mid = (low + high) / 2;
    if (botTyped(course, botId, seed, mid) >= course.stops.length) high = mid;
    else low = mid;
  }
  return Math.round(high);
}

// ---------- The race ----------

export type Racer = {
  typed: number;
  errors: number;
  finishedAt: number | null;
  left: boolean;
};

// Where everyone is at time `t`: people from their progress moves, the
// computer racers from their speed.
export function raceState(course: Course, match: MatchInfo, events: MatchEvent[], t: number): Map<string, Racer> {
  const total = course.stops.length;
  const racers = new Map<string, Racer>();
  for (const player of match.players) {
    if (player.bot) {
      const finish = botFinishTime(course, player.id, match.seed);
      racers.set(player.id, {
        typed: botTyped(course, player.id, match.seed, t),
        errors: 0,
        finishedAt: finish <= t ? finish : null,
        left: false,
      });
    } else racers.set(player.id, { typed: 0, errors: 0, finishedAt: null, left: false });
  }
  const limit = timeLimit(course);
  const people = new Set(match.players.filter((p) => !p.bot).map((p) => p.id));
  // The first person (not a computer) over the line.
  let firstFinish = Infinity;
  for (const event of events) {
    // Nothing counts once the race is over: time's up, or the others' grace
    // after the first finish has run out.
    if (event.t > Math.min(limit, firstFinish + FINISH_GRACE_MS)) continue;
    if (event.by === "system" && event.type === "left") {
      const id = (event.data as { id?: string })?.id;
      const racer = id ? racers.get(id) : undefined;
      if (racer && racer.finishedAt === null) racer.left = true;
      continue;
    }
    if (event.type !== "progress") continue;
    const racer = racers.get(event.by);
    const data = event.data as { i?: unknown; e?: unknown };
    if (!racer || racer.finishedAt !== null || typeof data?.i !== "number") continue;
    racer.typed = Math.max(racer.typed, Math.min(total, Math.floor(data.i)));
    if (typeof data.e === "number") racer.errors = Math.max(racer.errors, Math.floor(data.e));
    if (racer.typed >= total) {
      racer.finishedAt = event.t;
      if (people.has(event.by)) firstFinish = Math.min(firstFinish, event.t);
    }
  }
  return racers;
}

// A race can't go on forever: long enough to finish at 15 WPM, within 5 minutes.
export function timeLimit(course: Course): number {
  return Math.min(5 * 60_000, Math.max(90_000, (course.stops.length / 5 / 15) * 60_000));
}

// After the first person finishes, the rest have this long.
export const FINISH_GRACE_MS = 30_000;

export function raceOver(course: Course, match: MatchInfo, racers: Map<string, Racer>, t: number, solo: boolean): boolean {
  if (t >= timeLimit(course)) return true;
  const people = match.players.filter((p) => !p.bot).map((p) => racers.get(p.id)!);
  if (solo) return people.every((r) => r.finishedAt !== null);
  if (people.every((r) => r.finishedAt !== null || r.left)) return true;
  const firsts = people.map((r) => r.finishedAt).filter((v): v is number => v !== null);
  return firsts.length > 0 && t >= Math.min(...firsts) + FINISH_GRACE_MS;
}

export function accuracy(racer: Racer): number {
  const attempts = racer.typed + racer.errors;
  return attempts > 0 ? Math.round((racer.typed / attempts) * 100) : 100;
}

export function raceStandings(course: Course, match: MatchInfo, racers: Map<string, Racer>): Standing[] {
  const total = course.stops.length;
  return match.players.map((player) => {
    const racer = racers.get(player.id)!;
    if (racer.finishedAt !== null) {
      const speed = Math.round(wpm(total, racer.finishedAt));
      return {
        id: player.id,
        score: 1e9 - racer.finishedAt,
        label: `${speed} WPM`,
        detail: player.bot ? `${(racer.finishedAt / 1000).toFixed(1)} s` : `${accuracy(racer)}% accuracy · ${(racer.finishedAt / 1000).toFixed(1)} s`,
        stat: player.bot ? undefined : speed,
      };
    }
    const done = Math.floor((racer.typed / total) * 100);
    return {
      id: player.id,
      score: (racer.typed / total) * 1e6,
      label: `${done}%`,
      detail: racer.left ? "Left the race" : "Didn't finish",
      stat: player.bot ? undefined : 0,
    };
  });
}
