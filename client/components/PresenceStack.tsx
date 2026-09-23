"use client";

import { AvatarIcon } from "@/components/AvatarIcon";
import type { OnlineUser } from "@/types/presence";

type PresenceStackProps = {
  users: OnlineUser[];
  currentUserId: string | null;
  max?: number;
};

export function PresenceStack({ users, currentUserId, max = 4 }: PresenceStackProps) {
  if (users.length === 0) return null;

  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((u) => (
        <div key={u.socketId} title={u.userId === currentUserId ? "You" : u.name}>
          <AvatarIcon avatarId={u.avatarId} className="h-6 w-6 rounded-full ring-2 ring-ink-950" />
        </div>
      ))}
      {overflow > 0 && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-800 text-[9px] font-medium text-ink-300 ring-2 ring-ink-950">
          +{overflow}
        </div>
      )}
    </div>
  );
}