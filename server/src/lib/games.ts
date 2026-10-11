import { randomBytes } from "crypto";

// The games, and what a lobby for each one allows. The games themselves run
// in the players' browsers (client/lib/games): the server keeps the lobbies
// and relays every match's moves to everyone in one shared order, so each
// browser computes the same game. These ids and settings must match the
// app's list in client/lib/games/registry.ts.

export type SettingValue = string | number;
export type Settings = Record<string, SettingValue>;

export type GameRules = {
  minPlayers: number;
  maxPlayers: number;
  // A match is called off after this long, even if nobody's browser says
  // it's over (everyone closed the tab, say).
  maxMinutes: number;
  // Each setting's allowed values. The first one is the default.
  settings: Record<string, readonly SettingValue[]>;
  // Leaderboards rank by personal best, or by wins against friends (online
  // matches, which the server saves itself).
  rankBy: "best" | "wins";
  // The highest believable score; anything above it is rejected.
  maxScore: number;
};

export const GAMES: Record<string, GameRules> = {
  "code-racer": {
    minPlayers: 2,
    maxPlayers: 8,
    maxMinutes: 6,
    settings: { language: ["javascript", "python", "typescript"], length: ["medium", "short", "long"] },
    rankBy: "best",
    maxScore: 250,
  },
  keyword: {
    minPlayers: 2,
    maxPlayers: 8,
    maxMinutes: 12,
    settings: { words: [3, 1, 5] },
    rankBy: "best",
    maxScore: 10_000,
  },
  "bit-flip": {
    minPlayers: 2,
    maxPlayers: 8,
    maxMinutes: 4,
    settings: { base: ["binary", "hex"], seconds: [60, 30, 90] },
    rankBy: "best",
    maxScore: 300,
  },
  "output-oracle": {
    minPlayers: 2,
    maxPlayers: 8,
    maxMinutes: 12,
    settings: { rounds: [10, 5, 15], language: ["mixed", "javascript", "python"] },
    rankBy: "best",
    maxScore: 30_000,
  },
  "big-o-blitz": {
    minPlayers: 2,
    maxPlayers: 8,
    maxMinutes: 12,
    settings: { rounds: [10, 5, 15] },
    rankBy: "best",
    maxScore: 30_000,
  },
  "bug-hunt": {
    minPlayers: 2,
    maxPlayers: 8,
    maxMinutes: 12,
    settings: { rounds: [10, 5, 15] },
    rankBy: "best",
    maxScore: 30_000,
  },
  "four-in-a-row": {
    minPlayers: 2,
    maxPlayers: 2,
    maxMinutes: 30,
    settings: {},
    rankBy: "wins",
    maxScore: 3,
  },
  "pair-programming": {
    minPlayers: 2,
    maxPlayers: 4,
    maxMinutes: 20,
    settings: { pairs: [8, 6, 12] },
    rankBy: "best",
    maxScore: 3_000,
  },
  "byte-snake": {
    minPlayers: 2,
    maxPlayers: 8,
    maxMinutes: 5,
    settings: { seconds: [120, 60, 180] },
    rankBy: "best",
    maxScore: 100_000,
  },
};

export function isGame(game: unknown): game is string {
  return typeof game === "string" && Object.prototype.hasOwnProperty.call(GAMES, game);
}

// Every setting the game has, each one an allowed value (unknown keys are
// dropped, anything not allowed falls back to the default).
export function normalizeSettings(game: string, input: unknown): Settings {
  const rules = GAMES[game];
  const given = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const settings: Settings = {};
  for (const [key, allowed] of Object.entries(rules.settings)) {
    const value = given[key];
    settings[key] = allowed.includes(value as SettingValue) ? (value as SettingValue) : allowed[0];
  }
  return settings;
}

// Lobby codes: 6 characters people can read out loud, with no 0/O or 1/I
// to mix up (about a billion possibilities, for lobbies that last hours).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const LOBBY_CODE = /^[A-HJ-NP-Z2-9]{6}$/;

export function newLobbyCode(): string {
  let code = "";
  for (const byte of randomBytes(6)) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
}
