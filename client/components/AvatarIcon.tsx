"use client";

import { useId } from "react";
import { getAvatarDefinition } from "@/lib/avatars";

type AvatarIconProps = {
  avatarId: string;
  className?: string;
};

export function AvatarIcon({ avatarId, className = "" }: AvatarIconProps) {
  const uid = useId();
  const gradientId = `avatar-grad-${uid}`;
  const clipId = `avatar-clip-${uid}`;
  const { bg, pattern } = getAvatarDefinition(avatarId);

  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="Avatar">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={bg[0]} />
          <stop offset="100%" stopColor={bg[1]} />
        </linearGradient>
        <clipPath id={clipId}>
          <circle cx="20" cy="20" r="20" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="40" height="40" fill={`url(#${gradientId})`} />
        {pattern}
      </g>
    </svg>
  );
}