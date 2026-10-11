"use client";

import type { CSSProperties, ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { SoundToggle } from "@/components/games/SoundToggle";
import type { GameDef } from "@/lib/games/registry";
import "./games.css";

// A game's icon on a tile of its colors.
export function GameIconTile({ game, size = 32 }: { game: GameDef; size?: number }) {
  const Icon = game.icon;
  return (
    <span
      className="grid shrink-0 place-items-center rounded-lg text-white shadow-xs"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${game.colors[0]}, ${game.colors[1]})` }}
    >
      <Icon style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2.25} />
    </span>
  );
}

// The full-screen frame around a game being played (solo or online): a slim
// top bar, the game's colors glowing softly behind, and room for overlays
// (the countdown, the results) above the game itself.
export function GameStage({
  game,
  badge,
  onExit,
  exitLabel = "Leave",
  right,
  children,
  overlay,
}: {
  game: GameDef;
  badge?: ReactNode;
  onExit: () => void;
  exitLabel?: string;
  right?: ReactNode;
  children: ReactNode;
  overlay?: ReactNode;
}) {
  return (
    <div
      className="gs-stage flex h-dvh flex-col overflow-hidden bg-ink-950"
      style={{ "--g1": game.colors[0], "--g2": game.colors[1] } as CSSProperties}
    >
      <div className="gs-glow" aria-hidden="true" />
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-ink-800/70 px-2 sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{exitLabel}</span>
        </button>
        <div className="flex min-w-0 items-center gap-2.5">
          <GameIconTile game={game} size={28} />
          <span className="truncate text-sm font-semibold tracking-tight text-ink-100">{game.title}</span>
          {badge}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {right}
          <SoundToggle />
        </div>
      </header>
      <div className="relative min-h-0 flex-1">
        <main className="absolute inset-0 overflow-y-auto overflow-x-hidden">{children}</main>
        {overlay}
      </div>
    </div>
  );
}
