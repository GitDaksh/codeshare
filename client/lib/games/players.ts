import type { GameId, Player, Settings } from "@/lib/games/types";

// Who's in a solo game: you, plus the computer players some games have.

export const SOLO_ID = "you";

const RACERS: Player[] = [
  { id: "bot:rookie", name: "Rookie", avatarId: "bot", seat: 1, bot: true },
  { id: "bot:racer", name: "Racer", avatarId: "bot", seat: 2, bot: true },
  { id: "bot:ace", name: "Ace", avatarId: "bot", seat: 3, bot: true },
];

const LEVEL_NAMES: Record<string, string> = { easy: "Computer (easy)", medium: "Computer (medium)", hard: "Computer (hard)" };

export function soloPlayers(game: GameId, settings: Settings, me: { name: string; avatarId: string }): Player[] {
  const you: Player = { id: SOLO_ID, name: me.name, avatarId: me.avatarId, seat: 0 };
  if (game === "code-racer" && settings.rivals !== "none") return [you, ...RACERS];
  if (game === "four-in-a-row") {
    return [you, { id: "bot:cpu", name: LEVEL_NAMES[String(settings.level)] ?? "Computer", avatarId: "bot", seat: 3, bot: true }];
  }
  return [you];
}
