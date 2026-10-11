"use client";

import { PlayerAvatar } from "@/components/games/PlayerAvatar";
import type { Reaction } from "@/lib/games/useLobby";
import type { Player } from "@/lib/games/types";

export const REACTIONS = ["👏", "🔥", "😂", "😮", "🎉", "💀", "👀", "❤️"];

// Everyone's reactions floating up the screen, each with its sender's avatar
// (each one is removed once it has floated away; see useLobby).
export function FloatingReactions({ reactions, players }: { reactions: Reaction[]; players: Player[] }) {
  const byId = new Map(players.map((p) => [p.id, p]));
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 h-0" aria-hidden="true">
      {reactions.map((r) => {
        // The same spot for the same reaction on every screen.
        const hash = [...r.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7);
        const player = byId.get(r.by);
        return (
          <span
            key={r.id}
            className="gs-float absolute bottom-16 flex flex-col items-center"
            style={{ right: `${6 + (hash % 26)}%`, ["--drift" as string]: `${(hash % 40) - 20}px` }}
          >
            <span className="text-4xl drop-shadow-sm">{r.emoji}</span>
            {player && <PlayerAvatar player={player} size={18} className="mt-0.5" />}
          </span>
        );
      })}
    </div>
  );
}

// The row of emoji buttons.
export function ReactionBar({ onReact }: { onReact: (emoji: string) => void }) {
  return (
    <div className="gs-pop-in flex items-center gap-0.5 rounded-xl border border-ink-800 bg-ink-900 p-1 shadow-raised" role="group" aria-label="Send a reaction">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          className="grid h-9 w-9 place-items-center rounded-lg text-xl transition-transform hover:scale-110 hover:bg-ink-800 active:scale-95"
          aria-label={`React ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
