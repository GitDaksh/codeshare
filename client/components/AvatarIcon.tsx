"use client";

import { useId, useMemo } from "react";
import { getAvatarDefinition } from "@/lib/avatars";

type AvatarIconProps = {
  avatarId: string;
  className?: string;
};

export function AvatarIcon({ avatarId, className = "" }: AvatarIconProps) {
  // Strip characters React may include in useId output, so the IDs are
  // always safe inside SVG url(#...) references.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gradientId = `avatar-grad-${uid}`;
  const clipId = `avatar-clip-${uid}`;
  const { bg, bgKind, bgAngle, render } = useMemo(() => getAvatarDefinition(avatarId), [avatarId]);

  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="Avatar">
      <defs>
        {bgKind === "radial" ? (
          <radialGradient id={gradientId} cx="50%" cy="40%" r="75%">
            <stop offset="0%" stopColor={bg[1]} />
            <stop offset="100%" stopColor={bg[0]} />
          </radialGradient>
        ) : (
          <linearGradient
            id={gradientId}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
            gradientTransform={bgAngle !== undefined ? `rotate(${bgAngle} 0.5 0.5)` : undefined}
          >
            <stop offset="0%" stopColor={bg[0]} />
            <stop offset="100%" stopColor={bg[1]} />
          </linearGradient>
        )}
        <clipPath id={clipId}>
          <circle cx="20" cy="20" r="20" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="40" height="40" fill={`url(#${gradientId})`} />
        {render(uid)}
      </g>
    </svg>
  );
}