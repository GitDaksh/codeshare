"use client";

import Link from "next/link";
import { Loader2, Play, Users } from "lucide-react";
import { GameArt } from "@/components/games/GameArt";
import { GameIconTile } from "@/components/games/GameStage";
import { normalizeSettings, type GameDef } from "@/lib/games/registry";
import { useSavedSettings } from "@/lib/games/lastSettings";
import type { GameStat } from "@/lib/games/stats";
import { ui } from "@/lib/ui";

export function soloHref(game: GameDef, saved: Record<string, unknown>) {
  const settings = normalizeSettings(game, "solo", saved);
  const query = new URLSearchParams(Object.entries(settings).map(([k, v]) => [k, String(v)])).toString();
  return `/games/${game.id}/solo${query ? `?${query}` : ""}`;
}

// A game on the Games page: its scene, what it is, and two ways to play.
export function GameCard({
  game,
  stat,
  onFriends,
  creating,
  index = 0,
}: {
  game: GameDef;
  stat?: GameStat;
  onFriends: () => void;
  creating: boolean;
  index?: number;
}) {
  const [saved] = useSavedSettings(game.id);
  const highlight = game.rankBy === "wins" ? (stat?.wins ? `${stat.wins} win${stat.wins === 1 ? "" : "s"}` : null) : stat?.best ? `Best ${stat.best.toLocaleString()} ${game.unit}` : null;

  return (
    <article
      className="gs-rise group flex flex-col overflow-hidden rounded-2xl border border-ink-800 bg-ink-900 shadow-xs transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-ink-700 hover:shadow-card"
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <Link href={`/games/${game.id}`} className="block" aria-label={`${game.title}: ${game.tagline}`}>
        <div className="relative h-40 overflow-hidden border-b border-ink-800">
          <GameArt game={game} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        </div>
        <div className="px-4 pt-4">
          <div className="flex items-center gap-2.5">
            <GameIconTile game={game} size={26} />
            <h2 className="text-[15px] font-semibold tracking-tight text-ink-100">{game.title}</h2>
            {highlight && <span className={`${ui.badge} ml-auto`}>{highlight}</span>}
          </div>
          <p className="mt-2 text-sm text-ink-400">{game.tagline}</p>
          <p className="mt-2 text-xs text-ink-500">
            Solo · {game.players.max === 2 ? "2 players" : `${game.players.min}–${game.players.max} players`} · {game.minutes}
          </p>
        </div>
      </Link>
      <div className="mt-auto flex gap-2 p-4">
        <Link href={soloHref(game, saved)} className={`${ui.primarySm} flex-1`}>
          <Play className="h-3.5 w-3.5" />
          Solo
        </Link>
        <button type="button" onClick={onFriends} disabled={creating} className={`${ui.secondarySm} flex-1`}>
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
          With friends
        </button>
      </div>
    </article>
  );
}
