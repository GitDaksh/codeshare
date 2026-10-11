"use client";

import { Trophy } from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
import type { GameDef } from "@/lib/games/registry";
import { useLeaderboard } from "@/lib/games/stats";
import { ui } from "@/lib/ui";

const MEDALS = ["#fbbf24", "#cbd5e1", "#d97706"];

// The game's top 10 (best scores, or wins for Four in a Row).
export function Leaderboard({ game, refreshKey = 0 }: { game: GameDef; refreshKey?: number }) {
  const board = useLeaderboard(game.id, refreshKey);
  const unit = game.rankBy === "wins" ? "wins" : game.unit;

  return (
    <section className={`${ui.card} p-5`}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
        <Trophy className="h-4 w-4 text-warning" />
        Leaderboard
      </h2>
      <p className="mt-0.5 text-xs text-ink-500">{game.rankBy === "wins" ? "Most wins" : `Best scores, in ${game.unit}`}</p>
      {board === null ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded-lg bg-ink-800/60" />
          ))}
        </div>
      ) : board.entries.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-ink-700 px-4 py-6 text-center text-sm text-ink-500">
          No scores yet. Be the first on the board!
        </p>
      ) : (
        <ol className="mt-3 space-y-1">
          {board.entries.map((entry) => (
            <li
              key={entry.rank}
              className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${entry.you ? "bg-ink-800 ring-1 ring-ink-700" : ""}`}
            >
              <span
                className="w-6 text-center text-sm font-semibold tabular-nums"
                style={{ color: MEDALS[entry.rank - 1] ?? "var(--ink-500)" }}
              >
                {entry.rank}
              </span>
              <AvatarIcon avatarId={entry.avatarId} className="h-6 w-6 rounded-full" />
              <span className="min-w-0 flex-1 truncate text-sm text-ink-200">
                @{entry.username}
                {entry.you && <span className="ml-1.5 text-xs text-ink-500">(you)</span>}
              </span>
              <span className="text-sm font-medium tabular-nums text-ink-100">
                {entry.value.toLocaleString()} <span className="text-xs font-normal text-ink-500">{unit}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
