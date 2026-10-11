import { rng } from "@/lib/games/rng";
import type { MatchEvent, MatchInfo, Standing } from "@/lib/games/types";

// Bit Flip's rules: the targets (the same sequence for everyone in a match),
// each player's hits, and the clock.

export const BIT_VALUES = [128, 64, 32, 16, 8, 4, 2, 1];
// Hits this close together keep a combo going.
export const COMBO_MS = 3000;

function popcount(n: number) {
  let count = 0;
  for (let v = n; v; v >>= 1) count += v & 1;
  return count;
}

const sequences = new Map<number, number[]>();
// Far more targets than anyone can hit in 90 seconds.
const SEQUENCE_LENGTH = 512;

// The n-th target: the first three have at most three bits on (a warm-up),
// then anything from 1 to 255, never the same twice in a row.
export function targetAt(seed: number, index: number): number {
  let list = sequences.get(seed);
  if (!list) {
    const random = rng(seed);
    list = [];
    let previous = 0;
    for (let i = 0; i < SEQUENCE_LENGTH; i++) {
      let value = 0;
      do {
        value = 1 + Math.floor(random() * 255);
      } while (value === previous || (i < 3 && popcount(value) > 3));
      list.push(value);
      previous = value;
    }
    sequences.set(seed, list);
  }
  return list[index % SEQUENCE_LENGTH];
}

export function durationMs(match: MatchInfo): number {
  return (Number(match.settings.seconds) || 60) * 1000;
}

export type BitPlayer = { hits: number; times: number[]; left: boolean };

export function bitState(match: MatchInfo, events: MatchEvent[]): Map<string, BitPlayer> {
  const end = durationMs(match);
  const players = new Map<string, BitPlayer>(match.players.map((p) => [p.id, { hits: 0, times: [], left: false }]));
  for (const event of events) {
    if (event.by === "system" && event.type === "left") {
      const player = players.get((event.data as { id?: string })?.id ?? "");
      if (player) player.left = true;
      continue;
    }
    const player = players.get(event.by);
    // A hit counts if it's for the player's next target and before time's up.
    if (event.type !== "hit" || !player || event.t > end + 250) continue;
    if ((event.data as { n?: unknown })?.n !== player.hits) continue;
    player.hits += 1;
    player.times.push(event.t);
  }
  return players;
}

// The streak of hits ending at the latest one (each within COMBO_MS).
export function comboAt(times: number[], t: number): number {
  if (times.length === 0 || t - times[times.length - 1] > COMBO_MS) return 0;
  let combo = 1;
  for (let i = times.length - 1; i > 0 && times[i] - times[i - 1] <= COMBO_MS; i--) combo++;
  return combo;
}

export function bitOver(match: MatchInfo, players: Map<string, BitPlayer>, t: number): boolean {
  if (t >= durationMs(match)) return true;
  return match.players.every((p) => p.bot || players.get(p.id)!.left);
}

export function bitStandings(match: MatchInfo, players: Map<string, BitPlayer>): Standing[] {
  return match.players.map((p) => {
    const player = players.get(p.id)!;
    const last = player.times[player.times.length - 1] ?? 0;
    let best = 0;
    let streak = 0;
    player.times.forEach((time, i) => {
      streak = i > 0 && time - player.times[i - 1] <= COMBO_MS ? streak + 1 : 1;
      best = Math.max(best, streak);
    });
    return {
      id: p.id,
      // Ties go to whoever got there first.
      score: player.hits * 1e7 - last,
      label: `${player.hits} target${player.hits === 1 ? "" : "s"}`,
      detail: player.hits ? `Best combo ×${best}` : player.left ? "Left" : "No targets hit",
      stat: player.hits,
    };
  });
}

export function toHex(n: number): string {
  return `0x${n.toString(16).toUpperCase().padStart(2, "0")}`;
}
