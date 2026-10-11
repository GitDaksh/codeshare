// The shapes every game shares. A match is a list of moves ("events") in
// one agreed order: online, the server numbers them and stamps each with the
// match clock; solo, this browser does. Every game is a pure function of its
// match (seed, settings, players) and that list, so all browsers in a match
// compute exactly the same game.

export type GameId =
  | "code-racer"
  | "keyword"
  | "bit-flip"
  | "output-oracle"
  | "big-o-blitz"
  | "bug-hunt"
  | "four-in-a-row"
  | "pair-programming"
  | "byte-snake";

export type SettingValue = string | number;
export type Settings = Record<string, SettingValue>;

export type Player = {
  id: string;
  name: string;
  avatarId: string;
  // Their place in the lobby; it picks their color.
  seat: number;
  // Computer players (solo only).
  bot?: boolean;
};

export type MatchEvent = {
  seq: number;
  // A player's id, or "system" (someone left).
  by: string;
  type: string;
  data: unknown;
  // Milliseconds since the match started.
  t: number;
  // The sender's own id for the move, so it can drop its instant local copy
  // once the real one arrives.
  cid?: string;
};

export type MatchInfo = {
  id: string;
  number: number;
  seed: number;
  settings: Settings;
  players: Player[];
  // This browser's clock (Date.now()) at the moment the match starts.
  startAt: number;
};

// Where a player finished. `score` only orders players (higher is better);
// `stat` is what counts toward their personal best (in the game's unit,
// e.g. WPM); `label` and `detail` are what the results screen says.
export type Standing = {
  id: string;
  score: number;
  label: string;
  detail?: string;
  stat?: number;
  won?: boolean;
};

export type GameMode = "solo" | "online";

// Everything a game's component gets from the stage around it.
export type GameProps = {
  match: MatchInfo;
  events: MatchEvent[];
  // You, or null if you're watching a match you're not in.
  me: string | null;
  mode: GameMode;
  // Milliseconds since the match started (negative during the countdown).
  now: () => number;
  send: (type: string, data?: unknown) => void;
  // Solo only: moves made by the computer players.
  sendAs: (playerId: string, type: string, data?: unknown) => void;
  // Called when the game is over for everyone, with the final standings.
  onOver: (standings: Standing[]) => void;
};

// Online, a game that ends on the clock waits this long before working out
// the final standings, so moves made just before the end (still on their
// way) count in every browser alike.
export const SETTLE_MS = 1000;
