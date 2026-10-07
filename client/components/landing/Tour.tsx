"use client";

import { lazy, Suspense, useRef, useState, useSyncExternalStore, type ComponentType } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Check } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { scrollToY } from "@/components/landing/SmoothScroll";
import { BigOVisual, CollabVisual, PracticeVisual, ProgressVisual, Window } from "@/components/landing/TourVisuals";

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98];
// Lens (the renderer and its recordings) loads only when its chapter shows.
const LensDemo = lazy(() => import("@/components/landing/LensDemo"));

function LensVisual() {
  return (
    <Window
      title="Lens"
      badge={
        <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-950">Real recording</span>
      }
    >
      <Suspense fallback={<div className="h-full animate-pulse bg-ink-900" />}>
        <LensDemo />
      </Suspense>
    </Window>
  );
}

type Chapter = {
  id: string;
  label: string;
  title: string;
  body: string;
  points: string[];
  visual: ComponentType;
};

const CHAPTERS: Chapter[] = [
  {
    id: "collaborate",
    label: "Collaborate",
    title: "Edit together. Never collide.",
    body: "Everyone types in the same file at the same time, and every edit merges cleanly. Live cursors and selections show who's where, and Follow mode rides along with a teammate.",
    points: ["Conflict-free editing", "Live cursors and selections", "Follow mode", "⌘Z only undoes your own edits"],
    visual: CollabVisual,
  },
  {
    id: "lens",
    label: "Lens",
    title: "Watch your code run.",
    body: "Step through Python, JavaScript or TypeScript one line at a time. Arrays get index markers, tables become grids, and linked lists and trees are drawn as they change. In a room, everyone sees the same step.",
    points: ["Index markers on every array", "Linked lists, trees and grids", "40 ready-made concepts", "Shared in every room"],
    visual: LensVisual,
  },
  {
    id: "practice",
    label: "Practice",
    title: "100 problems, tested in the browser.",
    body: "Classic interview problems from Easy to Hard, with instant tests in Python, JavaScript and TypeScript. Work alone, or share the link and solve it together.",
    points: ["Instant test results", "35 Easy · 46 Medium · 19 Hard", "Solve with a partner", "Every solve tracked"],
    visual: PracticeVisual,
  },
  {
    id: "complexity",
    label: "Big-O meter",
    title: "Know your Big-O as you type.",
    body: "A live meter reads your code and shows its time and space complexity. Rewrite a nested loop and watch O(n²) become O(n).",
    points: ["Time and space complexity", "Updates as you type", "Right there in the editor"],
    visual: BigOVisual,
  },
  {
    id: "progress",
    label: "Progress",
    title: "See yourself improve.",
    body: "Your dashboard tracks the problems you've solved, your active days and streak, and the people you've coded with.",
    points: ["Progress by difficulty", "16-week activity map", "Streaks and coding partners"],
    visual: ProgressVisual,
  },
];

// Which layout is showing: true for the pinned desktop tour, false for the
// stacked one, null until the browser has said (the server can't know).
const DESKTOP = "(min-width: 1024px)";
function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(DESKTOP);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => null,
  );
}

function ChapterText({ chapter, index }: { chapter: Chapter; index: number }) {
  return (
    <>
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em] text-ink-500">
        {String(index + 1).padStart(2, "0")} · {chapter.label}
      </p>
      <h3 className="text-gradient mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">
        {chapter.title}
      </h3>
      <p className="mt-4 max-w-md leading-relaxed text-ink-400">{chapter.body}</p>
      <ul className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
        {chapter.points.map((point) => (
          <li key={point} className="flex items-center gap-2.5 text-sm text-ink-300">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-ink-600">
              <Check className="h-2.5 w-2.5 text-ink-100" strokeWidth={3} aria-hidden="true" />
            </span>
            {point}
          </li>
        ))}
      </ul>
    </>
  );
}

// One segment of the chapter rail. It fills as you scroll through its chapter.
function RailSegment({
  chapter,
  index,
  progress,
  active,
  onSelect,
}: {
  chapter: Chapter;
  index: number;
  progress: MotionValue<number>;
  active: boolean;
  onSelect: () => void;
}) {
  const fill = useTransform(progress, [index / CHAPTERS.length, (index + 1) / CHAPTERS.length], [0, 1]);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "step" : undefined}
      className="group min-w-0 flex-1 text-left"
    >
      <span className="block h-[2px] overflow-hidden rounded-full bg-ink-800">
        <motion.span className="block h-full origin-left rounded-full bg-ink-100" style={{ scaleX: fill }} />
      </span>
      <span
        className={`mt-2.5 block truncate text-xs font-medium transition-colors ${
          active ? "text-ink-100" : "text-ink-600 group-hover:text-ink-300"
        }`}
      >
        {chapter.label}
      </span>
    </button>
  );
}

export function Tour() {
  const isDesktop = useIsDesktop();
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    setActive(Math.min(CHAPTERS.length - 1, Math.max(0, Math.floor(value * CHAPTERS.length))));
  });

  // Glide to the start of a chapter.
  function select(index: number) {
    const track = trackRef.current;
    if (!track) return;
    const top = track.getBoundingClientRect().top + window.scrollY;
    const distance = track.offsetHeight - window.innerHeight;
    scrollToY(top + ((index + 0.02) / CHAPTERS.length) * distance);
  }

  const Visual = CHAPTERS[active].visual;

  return (
    <section id="tour" className="relative scroll-mt-20 px-4 pt-20 sm:pt-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em] text-ink-500">
            The platform
          </p>
          <h2 className="text-gradient mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-5xl">
            One room. Everything you need to get better.
          </h2>
          <p className="mt-4 text-ink-400">
            Pair on code, watch it run, practice interview problems and track your progress, all in the browser.
          </p>
        </Reveal>

        {/* Desktop: a pinned stage. Scrolling moves through the chapters. */}
        <div
          ref={trackRef}
          className="relative mt-4 hidden lg:block"
          style={{ height: `${CHAPTERS.length * 90}vh` }}
        >
          <div className="sticky top-0 flex h-screen items-center">
            <div className="grid w-full grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-12 pt-16">
              <div>
                <nav aria-label="Tour chapters" className="flex gap-3">
                  {CHAPTERS.map((chapter, i) => (
                    <RailSegment
                      key={chapter.id}
                      chapter={chapter}
                      index={i}
                      progress={scrollYProgress}
                      active={active === i}
                      onSelect={() => select(i)}
                    />
                  ))}
                </nav>
                <div className="relative mt-10 min-h-[22rem]">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={active}
                      initial={reduce ? false : { opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? undefined : { opacity: 0, y: -10 }}
                      transition={{ duration: 0.35, ease: EASE }}
                    >
                      <ChapterText chapter={CHAPTERS[active]} index={active} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              <div className="relative h-[min(34rem,calc(100vh-10rem))]">
                {/* Opacity and position only: a scale would throw off Lens's arrows. */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={active}
                    className="absolute inset-0"
                    initial={reduce ? false : { opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, y: -16 }}
                    transition={{ duration: 0.4, ease: EASE }}
                  >
                    {isDesktop && <Visual />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Phones and tablets: the chapters one after another. */}
        <div className="mt-14 space-y-20 lg:hidden">
          {CHAPTERS.map((chapter, i) => {
            const ChapterVisual = chapter.visual;
            return (
              <Reveal key={chapter.id}>
                <ChapterText chapter={chapter} index={i} />
                <div className="mt-8 h-[25rem] sm:h-[30rem]">{isDesktop === false && <ChapterVisual />}</div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}