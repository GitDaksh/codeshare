import {
  Binary,
  Bug,
  CircleDot,
  Gauge,
  Layers,
  Sparkles,
  SpellCheck,
  TrendingUp,
  Worm,
  type LucideIcon,
} from "lucide-react";
import type { GameId, GameMode, SettingValue, Settings } from "@/lib/games/types";

// Every game, and what the Games pages say about it. The ids and online
// settings must match the server's list (server/src/lib/games.ts).

export type SettingOption = { value: SettingValue; label: string };

export type SettingDef = {
  key: string;
  label: string;
  // The first option is the default.
  options: SettingOption[];
  // Where the setting applies (both, unless it says otherwise).
  modes?: GameMode[];
};

export type GameDef = {
  id: GameId;
  title: string;
  tagline: string;
  description: string;
  howTo: string[];
  icon: LucideIcon;
  // The game's two colors (its art, glow and highlights).
  colors: [string, string];
  players: { min: number; max: number };
  minutes: string;
  tags: string[];
  settings: SettingDef[];
  // Personal bests are in this unit ("WPM", "points"…); Four in a Row ranks
  // by wins instead.
  rankBy: "best" | "wins";
  unit: string;
};

export const GAMES: GameDef[] = [
  {
    id: "code-racer",
    title: "Code Racer",
    tagline: "Race to type real code.",
    description: "Type a real snippet as fast as you can, against friends or three computer racers. Every key counts.",
    howTo: [
      "Type the code exactly as shown. Indentation after a new line is filled in for you.",
      "A wrong key turns red and holds you until you type the right one.",
      "Speed is in words per minute: every 5 characters is a word.",
    ],
    icon: Gauge,
    colors: ["#60a5fa", "#6366f1"],
    players: { min: 2, max: 8 },
    minutes: "1–2 min",
    tags: ["Typing", "Race"],
    settings: [
      {
        key: "language",
        label: "Language",
        options: [
          { value: "javascript", label: "JavaScript" },
          { value: "python", label: "Python" },
          { value: "typescript", label: "TypeScript" },
        ],
      },
      {
        key: "length",
        label: "Snippet",
        options: [
          { value: "medium", label: "Medium" },
          { value: "short", label: "Short" },
          { value: "long", label: "Long" },
        ],
      },
      {
        key: "rivals",
        label: "Rivals",
        options: [
          { value: "bots", label: "3 computer racers" },
          { value: "none", label: "Just me" },
        ],
        modes: ["solo"],
      },
    ],
    rankBy: "best",
    unit: "WPM",
  },
  {
    id: "keyword",
    title: "Keyword",
    tagline: "Guess the programming word in six tries.",
    description: "Every guess colors its letters: green is right, yellow is in the word somewhere. Race friends on the same words, or play today's daily.",
    howTo: [
      "Guess a 5-letter word. Green letters are in the right spot, yellow ones are in the word but elsewhere.",
      "Every answer is a programming word: think keywords, tools and concepts.",
      "Fewer guesses and less time score more.",
    ],
    icon: SpellCheck,
    colors: ["#4ade80", "#16a34a"],
    players: { min: 2, max: 8 },
    minutes: "2–5 min",
    tags: ["Words", "Puzzle"],
    settings: [
      {
        key: "words",
        label: "Words",
        options: [
          { value: 3, label: "3 words" },
          { value: 1, label: "1 word" },
          { value: 5, label: "5 words" },
        ],
        modes: ["online"],
      },
      {
        key: "mode",
        label: "Mode",
        options: [
          { value: "daily", label: "Today's word" },
          { value: "endless", label: "Endless" },
        ],
        modes: ["solo"],
      },
    ],
    rankBy: "best",
    unit: "points",
  },
  {
    id: "bit-flip",
    title: "Bit Flip",
    tagline: "Flip bits to hit the number. Fast.",
    description: "A number appears; switch the eight bits on and off until they add up to it. How many can you hit before time runs out?",
    howTo: [
      "Each bit is worth its label (128 down to 1). Turn on the ones that add up to the target.",
      "Click the bits, or press 1 to 8 on your keyboard.",
      "Hit targets back to back to build a combo.",
    ],
    icon: Binary,
    colors: ["#22d3ee", "#0891b2"],
    players: { min: 2, max: 8 },
    minutes: "30–90 s",
    tags: ["Arcade", "Binary"],
    settings: [
      {
        key: "base",
        label: "Targets",
        options: [
          { value: "binary", label: "Decimal" },
          { value: "hex", label: "Hex" },
        ],
      },
      {
        key: "seconds",
        label: "Time",
        options: [
          { value: 60, label: "60 s" },
          { value: 30, label: "30 s" },
          { value: 90, label: "90 s" },
        ],
      },
    ],
    rankBy: "best",
    unit: "targets",
  },
  {
    id: "output-oracle",
    title: "Output Oracle",
    tagline: "What does this code print?",
    description: "Read a short snippet and pick what it prints before the clock runs out. Faster right answers score more.",
    howTo: [
      "Read the code, then pick its exact output from four choices.",
      "A right answer scores up to 1,000 points: the faster, the more.",
      "Answer streaks add a bonus.",
    ],
    icon: Sparkles,
    colors: ["#e879f9", "#c026d3"],
    players: { min: 2, max: 8 },
    minutes: "3–5 min",
    tags: ["Quiz", "JS & Python"],
    settings: [
      {
        key: "rounds",
        label: "Rounds",
        options: [
          { value: 10, label: "10" },
          { value: 5, label: "5" },
          { value: 15, label: "15" },
        ],
      },
      {
        key: "language",
        label: "Language",
        options: [
          { value: "mixed", label: "Both" },
          { value: "javascript", label: "JavaScript" },
          { value: "python", label: "Python" },
        ],
      },
    ],
    rankBy: "best",
    unit: "points",
  },
  {
    id: "big-o-blitz",
    title: "Big-O Blitz",
    tagline: "Name the complexity before time runs out.",
    description: "Constant, logarithmic, linear… Look at the code and call its time complexity. Quick and right wins.",
    howTo: [
      "Pick the time complexity of the code, as the input size n grows.",
      "A right answer scores up to 1,000 points: the faster, the more.",
      "Answer streaks add a bonus.",
    ],
    icon: TrendingUp,
    colors: ["#fb923c", "#ea580c"],
    players: { min: 2, max: 8 },
    minutes: "3–5 min",
    tags: ["Quiz", "Algorithms"],
    settings: [
      {
        key: "rounds",
        label: "Rounds",
        options: [
          { value: 10, label: "10" },
          { value: 5, label: "5" },
          { value: 15, label: "15" },
        ],
      },
    ],
    rankBy: "best",
    unit: "points",
  },
  {
    id: "bug-hunt",
    title: "Bug Hunt",
    tagline: "Find the line with the bug.",
    description: "Every snippet has exactly one bug. Click the line it's on, then see the fix.",
    howTo: [
      "Each snippet has one buggy line. Click it.",
      "A right answer scores up to 1,000 points: the faster, the more.",
      "After each round you'll see the bug and its fix.",
    ],
    icon: Bug,
    colors: ["#f87171", "#dc2626"],
    players: { min: 2, max: 8 },
    minutes: "3–5 min",
    tags: ["Quiz", "Debugging"],
    settings: [
      {
        key: "rounds",
        label: "Rounds",
        options: [
          { value: 10, label: "10" },
          { value: 5, label: "5" },
          { value: 15, label: "15" },
        ],
      },
    ],
    rankBy: "best",
    unit: "points",
  },
  {
    id: "four-in-a-row",
    title: "Four in a Row",
    tagline: "Drop discs. Connect four.",
    description: "Take turns dropping discs into the grid. Four of yours in a line, any direction, wins. Play a friend or the computer.",
    howTo: [
      "Click a column to drop a disc; it falls to the lowest free space.",
      "Line up four in a row, column or diagonal to win.",
      "Block your opponent's lines before they finish them.",
    ],
    icon: CircleDot,
    colors: ["#facc15", "#f59e0b"],
    players: { min: 2, max: 2 },
    minutes: "3–10 min",
    tags: ["Board", "1 vs 1"],
    settings: [
      {
        key: "level",
        label: "Computer",
        options: [
          { value: "medium", label: "Medium" },
          { value: "easy", label: "Easy" },
          { value: "hard", label: "Hard" },
        ],
        modes: ["solo"],
      },
    ],
    rankBy: "wins",
    unit: "wins",
  },
  {
    id: "pair-programming",
    title: "Pair Programming",
    tagline: "Match coding concepts from memory.",
    description: "Flip two cards at a time to find matching pairs, like LIFO and Stack. With friends, take turns: a match means you go again.",
    howTo: [
      "Flip two cards. If they belong together, they're yours.",
      "If not, they flip back. Remember where they were!",
      "With friends, a match gives you another turn. Most pairs wins.",
    ],
    icon: Layers,
    colors: ["#a78bfa", "#7c3aed"],
    players: { min: 2, max: 4 },
    minutes: "2–6 min",
    tags: ["Memory", "Concepts"],
    settings: [
      {
        key: "pairs",
        label: "Pairs",
        options: [
          { value: 8, label: "8 pairs" },
          { value: 6, label: "6 pairs" },
          { value: 12, label: "12 pairs" },
        ],
      },
    ],
    rankBy: "best",
    unit: "points",
  },
  {
    id: "byte-snake",
    title: "Byte Snake",
    tagline: "Eat bytes, grow long, don't crash.",
    description: "Steer a neon snake around the grid eating bytes. With friends, everyone plays the same board at once and sees each other live.",
    howTo: [
      "Steer with the arrow keys or WASD (swipe on a phone).",
      "Each byte makes you longer and faster. Golden bytes are worth more.",
      "Don't hit the walls or yourself.",
    ],
    icon: Worm,
    colors: ["#a3e635", "#65a30d"],
    players: { min: 2, max: 8 },
    minutes: "1–3 min",
    tags: ["Arcade", "Classic"],
    settings: [
      {
        key: "seconds",
        label: "Time",
        options: [
          { value: 120, label: "2 min" },
          { value: 60, label: "1 min" },
          { value: 180, label: "3 min" },
        ],
        modes: ["online"],
      },
    ],
    rankBy: "best",
    unit: "points",
  },
];

export const GAME_IDS = GAMES.map((g) => g.id);

export function gameById(id: string): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}

export function settingsFor(game: GameDef, mode: GameMode): SettingDef[] {
  return game.settings.filter((s) => !s.modes || s.modes.includes(mode));
}

// Every setting for this mode, each one an allowed value (others fall back
// to the default).
export function normalizeSettings(game: GameDef, mode: GameMode, input: Record<string, unknown>): Settings {
  const settings: Settings = {};
  for (const def of settingsFor(game, mode)) {
    const value = input[def.key];
    const match = def.options.find((o) => String(o.value) === String(value));
    settings[def.key] = (match ?? def.options[0]).value;
  }
  return settings;
}

// Player colors, by seat.
export const PLAYER_COLORS = ["#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#f87171", "#22d3ee", "#a3e635"];

export function playerColor(seat: number): string {
  return PLAYER_COLORS[((seat % PLAYER_COLORS.length) + PLAYER_COLORS.length) % PLAYER_COLORS.length];
}
