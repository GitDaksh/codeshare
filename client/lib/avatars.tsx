import type { ReactNode } from "react";

type PatternFn = (fg: string) => ReactNode;

const PALETTES: { bg: string; fg: string }[] = [
  { bg: "#000000", fg: "#f5f5f5" },
  { bg: "#0d0d0d", fg: "#999999" },
  { bg: "#f5f5f5", fg: "#0d0d0d" },
  { bg: "#1a1a1a", fg: "#cccccc" },
  { bg: "#262626", fg: "#666666" },
];

const PATTERNS: Record<string, PatternFn> = {
  rings: (fg) => (
    <>
      <circle cx="20" cy="20" r="15" fill="none" stroke={fg} strokeWidth="3.5" />
      <circle cx="20" cy="20" r="7" fill={fg} />
    </>
  ),
  stripes: (fg) => (
    <g transform="rotate(35 20 20)">
      {[-8, 4, 16, 28, 40].map((x) => (
        <rect key={x} x={x} y="-10" width="6" height="60" fill={fg} />
      ))}
    </g>
  ),
  dots: (fg) => (
    <>
      {[9, 20, 31].flatMap((cx) =>
        [9, 20, 31].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.2" fill={fg} />)
      )}
    </>
  ),
  triangles: (fg) => (
    <>
      <path d="M20 3 L35 20 L20 20 Z" fill={fg} />
      <path d="M20 37 L5 20 L20 20 Z" fill={fg} />
    </>
  ),
  cross: (fg) => (
    <>
      <rect x="16" y="4" width="8" height="32" fill={fg} />
      <rect x="4" y="16" width="32" height="8" fill={fg} />
    </>
  ),
  quadrants: (fg) => (
    <>
      <path d="M20 20 L20 0 A20 20 0 0 1 40 20 Z" fill={fg} />
      <path d="M20 20 L20 40 A20 20 0 0 1 0 20 Z" fill={fg} />
    </>
  ),
  chevrons: (fg) => (
    <>
      <path d="M2 16 L20 6 L38 16 L38 23 L20 13 L2 23 Z" fill={fg} />
      <path d="M2 30 L20 20 L38 30 L38 37 L20 27 L2 37 Z" fill={fg} />
    </>
  ),
  waves: (fg) => (
    <>
      <path d="M-2 13 Q9 6 20 13 T42 13 L42 21 Q31 14 20 21 T-2 21 Z" fill={fg} />
      <path d="M-2 27 Q9 20 20 27 T42 27 L42 35 Q31 28 20 35 T-2 35 Z" fill={fg} />
    </>
  ),
};

export const AVATAR_IDS = Object.keys(PATTERNS).flatMap((pattern) =>
  PALETTES.map((_, paletteIndex) => `${pattern}-${paletteIndex}`)
);

export const DEFAULT_AVATAR_ID = AVATAR_IDS[0];

export function getAvatarDefinition(avatarId: string) {
  const [pattern, paletteIndexStr] = avatarId.split("-");
  const paletteIndex = Number(paletteIndexStr);
  const palette = PALETTES[paletteIndex] ?? PALETTES[0];
  const patternFn = PATTERNS[pattern] ?? PATTERNS.rings;

  return {
    bg: palette.bg,
    pattern: patternFn(palette.fg),
  };
}