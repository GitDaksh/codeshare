const SHADES = [
  { avatar: "bg-ink-100 text-ink-950", cursor: "ink-100" },
  { avatar: "bg-ink-400 text-ink-950", cursor: "ink-400" },
  { avatar: "bg-ink-600 text-ink-100", cursor: "ink-600" },
  { avatar: "bg-ink-800 text-ink-100 border border-ink-500", cursor: "ink-300" },
];

function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) % SHADES.length;
  }
  return Math.abs(hash) % SHADES.length;
}

export function getAvatarShade(userId: string): string {
  return SHADES[hashUserId(userId)].avatar;
}

export function getCursorShadeClass(userId: string): string {
  return `remote-cursor-${SHADES[hashUserId(userId)].cursor}`;
}