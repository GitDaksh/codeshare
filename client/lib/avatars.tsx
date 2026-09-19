import type { ReactNode } from "react";

type PatternFn = (fg: string) => ReactNode;

const PALETTES: { bg: [string, string]; fg: string }[] = [
  { bg: ["#000000", "#262626"], fg: "#f5f5f5" },
  { bg: ["#0d0d0d", "#404040"], fg: "#f5f5f5" },
  { bg: ["#f5f5f5", "#cccccc"], fg: "#0d0d0d" },
  { bg: ["#1a1a1a", "#666666"], fg: "#f5f5f5" },
  { bg: ["#262626", "#0d0d0d"], fg: "#cccccc" },
  { bg: ["#404040", "#1a1a1a"], fg: "#f5f5f5" },
];

const PATTERNS: Record<string, PatternFn> = {
  orbit: (fg) => (
    <>
      <circle cx="20" cy="20" r="14" fill="none" stroke={fg} strokeWidth="1.5" opacity="0.55" />
      <circle cx="29" cy="14" r="4.5" fill={fg} />
    </>
  ),
  bloom: (fg) => (
    <>
      <circle cx="14" cy="16" r="9" fill={fg} opacity="0.35" />
      <circle cx="24" cy="14" r="7" fill={fg} opacity="0.5" />
      <circle cx="20" cy="26" r="8" fill={fg} opacity="0.65" />
    </>
  ),
  facet: (fg) => (
    <>
      <path d="M20 4 L34 24 L20 20 Z" fill={fg} opacity="0.85" />
      <path d="M20 20 L34 24 L22 36 Z" fill={fg} opacity="0.5" />
      <path d="M6 24 L20 4 L20 20 Z" fill={fg} opacity="0.65" />
    </>
  ),
  halo: (fg) => (
    <>
      <circle cx="20" cy="20" r="15" fill="none" stroke={fg} strokeWidth="1" opacity="0.3" />
      <circle cx="20" cy="20" r="10" fill="none" stroke={fg} strokeWidth="2" opacity="0.55" />
      <circle cx="20" cy="20" r="4" fill={fg} opacity="0.9" />
    </>
  ),
  terrain: (fg) => (
    <>
      <path d="M-2 30 Q10 20 20 27 T42 24 L42 42 L-2 42 Z" fill={fg} opacity="0.4" />
      <path d="M-2 34 Q12 26 20 32 T42 30 L42 42 L-2 42 Z" fill={fg} opacity="0.65" />
      <path d="M-2 38 Q14 32 22 37 T42 36 L42 42 L-2 42 Z" fill={fg} opacity="0.9" />
    </>
  ),
  fragment: (fg) => (
    <>
      <path d="M6 6 L22 10 L14 22 Z" fill={fg} opacity="0.5" />
      <path d="M22 10 L36 16 L24 26 L14 22 Z" fill={fg} opacity="0.75" />
      <path d="M14 22 L24 26 L18 36 L8 30 Z" fill={fg} opacity="0.9" />
    </>
  ),
  lattice: (fg) => (
    <>
      {[10, 20, 30].flatMap((cx) =>
        [10, 20, 30].map((cy) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.2" fill={fg} opacity="0.55" />
        ))
      )}
      <line x1="6" y1="34" x2="34" y2="6" stroke={fg} strokeWidth="2" opacity="0.9" />
    </>
  ),
  prism: (fg) => (
    <>
      <path d="M20 5 L35 33 L5 33 Z" fill={fg} opacity="0.35" />
      <path d="M20 14 L28 30 L12 30 Z" fill={fg} opacity="0.7" />
      <path d="M20 21 L23 28 L17 28 Z" fill={fg} />
    </>
  ),
  comet: (fg) => (
    <>
      <path d="M6 30 Q16 26 34 10" fill="none" stroke={fg} strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
      <path d="M12 28 Q20 22 32 12" fill="none" stroke={fg} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
      <circle cx="33" cy="10" r="4" fill={fg} />
    </>
  ),
  mosaic: (fg) => (
    <>
      <rect x="9" y="9" width="16" height="16" fill={fg} opacity="0.4" transform="rotate(8 17 17)" />
      <rect x="15" y="15" width="16" height="16" fill={fg} opacity="0.65" transform="rotate(-10 23 23)" />
      <rect x="17" y="8" width="10" height="10" fill={fg} opacity="0.9" transform="rotate(20 22 13)" />
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
  const patternFn = PATTERNS[pattern] ?? PATTERNS.orbit;

  return {
    bg: palette.bg,
    pattern: patternFn(palette.fg),
  };
}