const SHADES = [
  "bg-ink-100 text-ink-950",
  "bg-ink-400 text-ink-950",
  "bg-ink-600 text-ink-100",
  "bg-ink-800 text-ink-100 border border-ink-500",
];

export function getAvatarShade(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) % SHADES.length;
  }
  return SHADES[Math.abs(hash) % SHADES.length];
}