"use client";

import { Bot, Crown } from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
import { playerColor } from "@/lib/games/registry";
import type { Player } from "@/lib/games/types";

// A player's avatar inside a ring of their color, with a crown for the host
// and a small robot for computer players.
export function PlayerAvatar({
  player,
  size = 32,
  host = false,
  dim = false,
  className = "",
}: {
  player: Pick<Player, "avatarId" | "seat" | "bot" | "name">;
  size?: number;
  host?: boolean;
  dim?: boolean;
  className?: string;
}) {
  const color = playerColor(player.seat);
  const badge = Math.max(14, Math.round(size * 0.42));
  return (
    <span
      className={`relative inline-flex shrink-0 rounded-full transition-opacity ${dim ? "opacity-40" : ""} ${className}`}
      style={{ width: size, height: size, boxShadow: `0 0 0 2px ${color}` }}
      title={player.name}
    >
      {player.bot ? (
        <span className="grid h-full w-full place-items-center rounded-full bg-ink-800 text-ink-300">
          <Bot style={{ width: size * 0.55, height: size * 0.55 }} />
        </span>
      ) : (
        <AvatarIcon avatarId={player.avatarId} className="h-full w-full rounded-full" />
      )}
      {host && (
        <span
          className="absolute -right-1 -top-1.5 grid place-items-center rounded-full bg-ink-950 text-warning ring-1 ring-ink-800"
          style={{ width: badge, height: badge }}
          aria-label="Host"
        >
          <Crown style={{ width: badge * 0.62, height: badge * 0.62 }} />
        </span>
      )}
    </span>
  );
}
