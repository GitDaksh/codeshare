"use client";

import { useRef, type MouseEvent } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { AvatarIcon } from "@/components/AvatarIcon";
import { GithubIcon } from "@/components/GithubIcon";
import { LogoMark } from "@/components/LogoMark";
import { LANGUAGES } from "@/lib/languages";

type ProfilePreviewCardProps = {
  avatarId: string;
  username: string;
  bio: string;
  favoriteLanguage: string;
  githubUsername: string;
};

function languageLabel(value: string): string {
  return LANGUAGES.find((l) => l.value === value)?.label ?? value;
}

// A "member card" that fills in live during onboarding. It tilts toward the
// mouse in 3D (spring-smoothed) with a spotlight that follows the cursor.
export function ProfilePreviewCard({
  avatarId,
  username,
  bio,
  favoriteLanguage,
  githubUsername,
}: ProfilePreviewCardProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], [7, -7]), { stiffness: 180, damping: 18 });
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-9, 9]), { stiffness: 180, damping: 18 });

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
    if (reduce) return;
    pointerX.set((e.clientX - rect.left) / rect.width - 0.5);
    pointerY.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleMouseLeave() {
    pointerX.set(0);
    pointerY.set(0);
  }

  const trimmedGithub = githubUsername.trim();

  return (
    <div>
      <p className="mb-3 text-center font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-ink-600">
        Live preview
      </p>
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={reduce ? undefined : { rotateX, rotateY, transformPerspective: 1000 }}
        className="group relative overflow-hidden rounded-3xl border border-ink-800 bg-ink-950 p-6 shadow-[0_30px_80px_-30px_rgba(255,255,255,0.15)]"
      >
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="spotlight-fill pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        <div className="relative">
          <div className="flex items-center justify-between">
            <LogoMark className="h-6 w-6" />
            <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-ink-600">
              Member card
            </span>
          </div>

          <div className="mt-8 flex justify-center">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={avatarId}
                initial={{ scale: 0.7, opacity: 0, rotate: -8 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
              >
                <AvatarIcon
                  avatarId={avatarId}
                  className="h-24 w-24 rounded-full ring-1 ring-ink-800 ring-offset-4 ring-offset-ink-950"
                />
              </motion.div>
            </AnimatePresence>
          </div>

          <p className="mt-6 truncate text-center font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-ink-100">
            {username ? `@${username}` : <span className="text-ink-700">@username</span>}
          </p>

          <p className="mt-2 line-clamp-2 min-h-10 break-words text-center text-sm text-ink-400">
            {bio.trim() ? bio : <span className="text-ink-700">Your bio will show up here.</span>}
          </p>

          <div className="mt-6 flex min-h-7 flex-wrap items-center justify-center gap-2 text-xs">
            {favoriteLanguage && (
              <span className="rounded-full border border-ink-800 bg-ink-900 px-2.5 py-1 text-ink-300">
                {languageLabel(favoriteLanguage)}
              </span>
            )}
            {trimmedGithub && (
              <span className="flex max-w-full items-center gap-1.5 rounded-full border border-ink-800 bg-ink-900 px-2.5 py-1 text-ink-300">
                <GithubIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{trimmedGithub}</span>
              </span>
            )}
            {!favoriteLanguage && !trimmedGithub && (
              <span className="text-ink-700">Language and GitHub appear here</span>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}