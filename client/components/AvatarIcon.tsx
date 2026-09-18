"use client";

import { useId } from "react";
import { getAvatarDefinition } from "@/lib/avatars";

type AvatarIconProps = {
  avatarId: string;
  className?: string;
};

export function AvatarIcon({ avatarId, className = "" }: AvatarIconProps) {
  const clipId = useId();
  const { bg, pattern } = getAvatarDefinition(avatarId);

  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="Avatar">
      <defs>
        <clipPath id={clipId}>
          <circle cx="20" cy="20" r="20" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="40" height="40" fill={bg} />
        {pattern}
      </g>
    </svg>
  );
}