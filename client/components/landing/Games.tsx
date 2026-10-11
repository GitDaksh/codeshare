"use client";

import { useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, Clock, Loader2, Play, Users } from "lucide-react";
import { GameArt } from "@/components/games/GameArt";
import { Reveal } from "@/components/landing/Reveal";
import { Window } from "@/components/landing/TourVisuals";
import { GAMES, normalizeSettings, type GameDef } from "@/lib/games/registry";
import { useCreateLobby } from "@/lib/games/useCreateLobby";

const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98];
// How long each game stays on screen while the console plays by itself.
const CYCLE_MS = 5000;

const gradient = (game: GameDef) => `linear-gradient(135deg, ${game.colors[0]}, ${game.colors[1]})`;

function soloHref(game: GameDef) {
  const settings = normalizeSettings(game, "solo", {});
  const query = new URLSearchParams(Object.entries(settings).map(([k, v]) => [k, String(v)])).toString();
  return `/games/${game.id}/solo${query ? `?${query}` : ""}`;
}

function playerCount(game: GameDef) {
  return game.players.max === 2 ? "Solo or 1 vs 1" : `Solo or ${game.players.min}–${game.players.max} players`;
}

// What the selected game is, and the two ways to play it. Every game's
// details sit in the same grid cell, so the panel keeps the height of the
// longest one and nothing below it jumps when the game changes.
function Details({
  game,
  shown,
  creating,
  onFriends,
}: {
  game: GameDef;
  shown: boolean;
  creating: boolean;
  onFriends: () => void;
}) {
  const Icon = game.icon;
  return (
    <div
      inert={!shown}
      className={`col-start-1 row-start-1 flex flex-col transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white shadow-xs" style={{ background: gradient(game) }}>
          <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
        </span>
        <h3 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-ink-100">{game.title}</h3>
      </div>
      <p className="mt-4 text-[15px] font-medium text-ink-200">{game.tagline}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-400">{game.description}</p>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {playerCount(game)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {game.minutes}
        </span>
      </div>
      <div className="mt-6 flex flex-wrap gap-2.5 lg:mt-auto lg:pt-6">
        <Link
          href={soloHref(game)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink-100 px-4 text-sm font-medium text-ink-950 shadow-xs transition-[background-color,transform] duration-200 hover:bg-ink-200 active:scale-[0.98]"
        >
          <Play className="h-3.5 w-3.5" aria-hidden="true" />
          Play solo
        </Link>
        <button
          type="button"
          onClick={onFriends}
          disabled={creating}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-4 text-sm font-medium text-ink-100 shadow-xs transition-[border-color,transform] duration-200 hover:border-ink-500 active:scale-[0.98] disabled:opacity-60"
        >
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Users className="h-3.5 w-3.5" aria-hidden="true" />}
          Play with friends
        </button>
      </div>
    </div>
  );
}

// The nine games as a console: the selected game's scene on a stage lit in
// its colors, what it is and how to play it, and a dock of every game. It
// moves through the games by itself while it's on screen, until you pick one.
export function Games() {
  const reduce = useReducedMotion();
  const consoleRef = useRef<HTMLDivElement>(null);
  const inView = useInView(consoleRef, { amount: 0.35 });
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);
  // Once you choose a game yourself, the console stops changing it.
  const [picked, setPicked] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const { create, creating } = useCreateLobby();

  const game = GAMES[active];
  const cycling = !reduce && !picked;
  const running = cycling && inView && !hovered && !focused;

  function pick(index: number, focus = false) {
    setActive(index);
    setPicked(true);
    if (focus) tabRefs.current[index]?.focus();
  }

  // The dock is a set of tabs: arrows, Home and End move between games.
  function onDockKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const last = GAMES.length - 1;
    const next =
      e.key === "ArrowRight"
        ? active === last ? 0 : active + 1
        : e.key === "ArrowLeft"
          ? active === 0 ? last : active - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    pick(next, true);
  }

  function onBlurCapture(e: FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  }

  return (
    <section id="games" className="relative scroll-mt-20 px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em] text-ink-500">Games</p>
          <h2 className="text-gradient mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-5xl">
            Take a break. Play with friends.
          </h2>
          <p className="mt-4 text-ink-400">
            Nine quick games for people who code. Play solo in seconds, with no account needed, or share a code and
            play together, live.
          </p>
        </Reveal>

        <Reveal className="mt-12 sm:mt-16">
          <div
            ref={consoleRef}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocusCapture={() => setFocused(true)}
            onBlurCapture={onBlurCapture}
          >
            <Window
              title="Games"
              badge={<span className="rounded border border-ink-700 px-1.5 py-0.5 text-[10px] text-ink-500">9 games</span>}
            >
              <div
                id="games-panel"
                role="tabpanel"
                aria-labelledby={`games-tab-${game.id}`}
                className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
              >
                {/* The stage: the game's own scene, lit in its colors. */}
                <div
                  aria-hidden="true"
                  className="relative h-56 overflow-hidden border-b border-ink-800 bg-ink-950 sm:h-72 lg:h-auto lg:min-h-80 lg:border-b-0 lg:border-r"
                >
                  {GAMES.map((g, i) => (
                    <div
                      key={g.id}
                      className="absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none"
                      style={{
                        opacity: i === active ? 1 : 0,
                        background: `radial-gradient(75% 95% at 12% 8%, color-mix(in srgb, ${g.colors[0]} 32%, transparent), transparent 62%), radial-gradient(70% 90% at 90% 96%, color-mix(in srgb, ${g.colors[1]} 26%, transparent), transparent 64%)`,
                      }}
                    />
                  ))}
                  <div className="dot-grid absolute inset-0 opacity-70" />
                  <AnimatePresence initial={false}>
                    <motion.div
                      key={game.id}
                      className="absolute inset-0 grid place-items-center"
                      initial={reduce ? false : { opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={reduce ? undefined : { opacity: 0, scale: 1.04 }}
                      transition={{ duration: 0.5, ease: EASE }}
                    >
                      <div className="relative h-[160px] w-[340px] shrink-0 scale-[0.84] min-[380px]:scale-95 sm:scale-[1.4] lg:scale-[1.55]">
                        <GameArt game={game} className="ga-bare" />
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="grid p-5 sm:p-7">
                  {GAMES.map((g, i) => (
                    <Details
                      key={g.id}
                      game={g}
                      shown={i === active}
                      creating={creating === g.id}
                      onFriends={() => void create(g.id, normalizeSettings(g, "online", {}))}
                    />
                  ))}
                </div>
              </div>

              {/* The dock: every game, in its colors. */}
              <div
                role="tablist"
                aria-label="Games"
                onKeyDown={onDockKeyDown}
                className="grid grid-cols-5 gap-3 border-t border-ink-800 px-4 py-4 sm:grid-cols-9 sm:px-6 sm:py-5"
              >
                {GAMES.map((g, i) => {
                  const Icon = g.icon;
                  const selected = i === active;
                  return (
                    <button
                      key={g.id}
                      ref={(el) => {
                        tabRefs.current[i] = el;
                      }}
                      type="button"
                      role="tab"
                      id={`games-tab-${g.id}`}
                      aria-selected={selected}
                      aria-controls="games-panel"
                      aria-label={g.title}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => pick(i)}
                      className="group/tile flex min-w-0 flex-col items-center gap-2 rounded-xl p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ink-400"
                    >
                      <span className="relative w-full max-w-14">
                        <span
                          aria-hidden="true"
                          className={`absolute inset-0 rounded-xl blur-lg transition-opacity duration-500 motion-reduce:transition-none ${selected ? "opacity-60" : "opacity-0"}`}
                          style={{ background: gradient(g) }}
                        />
                        <span
                          className={`relative grid aspect-square w-full place-items-center rounded-xl text-white shadow-xs transition-transform duration-300 ease-out motion-reduce:transition-none ${
                            selected ? "-translate-y-1 scale-105" : "scale-95 group-hover/tile:-translate-y-0.5 group-hover/tile:scale-100"
                          }`}
                          style={{ background: gradient(g) }}
                        >
                          <Icon className="h-1/2 w-1/2" strokeWidth={2.25} aria-hidden="true" />
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={`hidden w-full truncate text-center text-[11px] font-medium transition-colors lg:block ${selected ? "text-ink-100" : "text-ink-500"}`}
                      >
                        {g.title}
                      </span>
                      {/* While the console plays by itself, this fills up, then the next game shows. */}
                      <span aria-hidden="true" className="relative block h-0.5 w-full max-w-14 overflow-hidden rounded-full">
                        {selected && cycling && (
                          <span
                            key={active}
                            className="landing-dock-progress absolute inset-0 rounded-full"
                            style={
                              {
                                background: gradient(g),
                                animationDuration: `${CYCLE_MS}ms`,
                                animationPlayState: running ? "running" : "paused",
                              } as CSSProperties
                            }
                            onAnimationEnd={(e) => {
                              if (e.target === e.currentTarget) setActive((a) => (a + 1) % GAMES.length);
                            }}
                          />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Window>
          </div>
        </Reveal>

        <Reveal className="mt-8 flex justify-center">
          <Link
            href="/games"
            className="group inline-flex items-center gap-2 text-sm font-medium text-ink-300 transition-colors hover:text-ink-100"
          >
            See all nine games
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
