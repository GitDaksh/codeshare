"use client";

import type { ReactNode } from "react";
import { Sparkles, Trophy } from "lucide-react";
import { PlayerAvatar } from "@/components/games/PlayerAvatar";
import type { GameDef } from "@/lib/games/registry";
import type { Player, Standing } from "@/lib/games/types";

// Best first, with ties sharing a place.
export function ranked(standings: Standing[]) {
  return [...standings]
    .sort((a, b) => b.score - a.score)
    .map((s) => ({ ...s, rank: 1 + standings.filter((o) => o.score > s.score).length }));
}

function ordinal(n: number) {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

const PODIUM = [
  { place: 1, height: 92 },
  { place: 0, height: 120 },
  { place: 2, height: 72 },
];

// The end of a game: your result front and center, the podium, everyone
// else, and what to do next.
export function Results({
  game,
  standings,
  players,
  me,
  record,
  actions,
  note,
}: {
  game: GameDef;
  standings: Standing[];
  players: Player[];
  me: string | null;
  record: { best: number; newBest: boolean } | null;
  actions: ReactNode;
  note?: ReactNode;
}) {
  const rows = ranked(standings);
  const byId = new Map(players.map((p) => [p.id, p]));
  const mine = rows.find((r) => r.id === me);
  const solo = players.length === 1;
  const tiedFirst = rows.filter((r) => r.rank === 1).length > 1;

  const headline = !mine
    ? "Match over"
    : solo
      ? mine.won === false
        ? "Game over"
        : "Nice run!"
      : mine.rank === 1
        ? tiedFirst
          ? "It's a tie!"
          : "You won!"
        : rows.length === 2
          ? "Good game!"
          : `${ordinal(mine.rank)} place`;

  return (
    <div className="absolute inset-0 z-40 overflow-y-auto bg-ink-950/75" role="dialog" aria-label="Results">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="gs-rise w-full max-w-lg rounded-2xl border border-ink-800 bg-ink-900 p-6 shadow-raised sm:p-8">
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-500">{game.title}</p>
            <h2 className="mt-2 flex items-center justify-center gap-2 text-3xl font-semibold tracking-tight text-ink-100">
              {mine?.rank === 1 && !solo && !tiedFirst && <Trophy className="h-7 w-7 text-warning" />}
              {headline}
            </h2>
            {mine && (
              <p className="mt-3">
                <span className="gs-gradient-text text-4xl font-semibold tabular-nums tracking-tight">{mine.label}</span>
                {mine.detail && <span className="mt-1 block text-sm text-ink-400">{mine.detail}</span>}
              </p>
            )}
            {record?.newBest && (
              <p className="gs-pop-in mx-auto mt-4 inline-flex items-center gap-1.5 rounded-lg border border-warning-line bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
                <Sparkles className="h-3.5 w-3.5" />
                New personal best!
              </p>
            )}
            {record && !record.newBest && game.rankBy === "best" && !!mine?.stat && (
              <p className="mt-3 text-xs text-ink-500">
                Your best: {record.best.toLocaleString()} {game.unit}
              </p>
            )}
          </div>

          {!solo && rows.length > 1 && (
            <div className="mt-8 flex items-end justify-center gap-2 sm:gap-3">
              {PODIUM.filter(({ place }) => rows[place]).map(({ place, height }) => {
                const row = rows[place];
                const player = byId.get(row.id);
                return (
                  <div key={row.id} className="gs-rise flex w-24 flex-col items-center sm:w-28" style={{ animationDelay: `${150 + (2 - place) * 120}ms` }}>
                    {player && <PlayerAvatar player={player} size={place === 0 ? 48 : 40} />}
                    <p className={`mt-2 max-w-full truncate text-sm font-medium ${row.id === me ? "text-ink-100" : "text-ink-300"}`}>
                      {row.id === me ? "You" : (player?.name ?? "Player")}
                    </p>
                    <p className="max-w-full truncate text-xs tabular-nums text-ink-500">{row.label}</p>
                    <div
                      className="mt-2 flex w-full items-start justify-center rounded-t-xl border border-b-0 border-ink-800 pt-2 text-lg font-semibold text-ink-100"
                      style={{
                        height,
                        background: `linear-gradient(180deg, color-mix(in srgb, ${game.colors[0]} ${place === 0 ? 34 : 20}%, transparent), transparent)`,
                      }}
                    >
                      {ordinal(row.rank)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!solo && rows.length > 3 && (
            <ul className="mt-4 divide-y divide-ink-800 rounded-xl border border-ink-800">
              {rows.slice(3).map((row) => {
                const player = byId.get(row.id);
                return (
                  <li key={row.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-8 text-sm tabular-nums text-ink-500">{ordinal(row.rank)}</span>
                    {player && <PlayerAvatar player={player} size={24} />}
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-200">{row.id === me ? "You" : (player?.name ?? "Player")}</span>
                    <span className="text-sm tabular-nums text-ink-400">{row.label}</span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">{actions}</div>
          {note && <p className="mt-3 text-center text-xs text-ink-500">{note}</p>}
        </div>
      </div>
    </div>
  );
}
