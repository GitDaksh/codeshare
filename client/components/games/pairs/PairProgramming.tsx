"use client";

import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import {
  Binary,
  Boxes,
  Braces,
  CaseUpper,
  Check,
  CodeXml,
  Flame,
  Gauge,
  GitBranch,
  Globe,
  Keyboard,
  Languages,
  Lightbulb,
  Link2,
  Network,
  Percent,
  Regex,
  SquareTerminal,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { PlayerAvatar } from "@/components/games/PlayerAvatar";
import { useTicker } from "@/components/games/useTicker";
import type { PairTopic } from "@/lib/games/content/pairs";
import { TURN_MS, deal, pairCount, pairsStandings, pairsState, revealMs } from "@/lib/games/logic/pairs";
import { playerColor } from "@/lib/games/registry";
import { sfx } from "@/lib/games/sound";
import type { GameProps, Player } from "@/lib/games/types";

const TOPICS: Record<PairTopic, { label: string; icon: LucideIcon }> = {
  data: { label: "Data", icon: Boxes },
  http: { label: "HTTP", icon: Globe },
  network: { label: "Network", icon: Network },
  numbers: { label: "Numbers", icon: Binary },
  javascript: { label: "JavaScript", icon: Braces },
  keywords: { label: "Pairs", icon: Link2 },
  languages: { label: "Languages", icon: Languages },
  acronyms: { label: "Acronyms", icon: CaseUpper },
  "big-o": { label: "Big-O", icon: Gauge },
  html: { label: "HTML", icon: CodeXml },
  shortcuts: { label: "Shortcuts", icon: Keyboard },
  shell: { label: "Shell", icon: SquareTerminal },
  git: { label: "Git", icon: GitBranch },
  regex: { label: "Regex", icon: Regex },
  operators: { label: "Operators", icon: Percent },
  concepts: { label: "Concepts", icon: Lightbulb },
};

// The sparks that fly when a pair is found.
const SPARKS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2 + 0.3;
  const distance = 34 + (i % 3) * 10;
  return { dx: `${Math.round(Math.cos(angle) * distance)}px`, dy: `${Math.round(Math.sin(angle) * distance)}px` };
});

// How long "Match!" stays up after a pair is found.
const FOUND_NOTE_MS = 1800;
// Online, the turn clock shows from this much time left.
const CLOCK_FROM_MS = 5_000;

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Columns for the board: wide boards on wide screens, 4 across on phones.
function layout(cards: number) {
  if (cards <= 12) return { cols: 4, rows: 3, wideCols: 4, wideRows: 3 };
  if (cards <= 16) return { cols: 4, rows: 4, wideCols: 4, wideRows: 4 };
  return { cols: 4, rows: 6, wideCols: 6, wideRows: 4 };
}

function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900/85 px-3 py-2 shadow-xs">
      <p className="text-[11px] font-medium text-ink-500">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${accent ? "gs-gradient-text" : "text-ink-100"}`}>{value}</p>
    </div>
  );
}

// One player online: avatar, name, pairs found; the player whose turn it is
// glows, with their time running out underneath.
function PlayerChip({ player, you, pairs, active, left, clockLeft }: { player: Player; you: boolean; pairs: number; active: boolean; left: boolean; clockLeft: number | null }) {
  const color = playerColor(player.seat);
  const low = clockLeft !== null && clockLeft <= CLOCK_FROM_MS;
  return (
    <div className="relative flex min-w-0 items-center gap-2 rounded-xl border border-ink-800 bg-ink-900/85 px-2.5 py-2 shadow-xs">
      <span
        className="pointer-events-none absolute -inset-px rounded-xl transition-opacity duration-300"
        style={{ opacity: active ? 1 : 0, boxShadow: `0 0 0 1.5px ${color}, 0 0 24px -8px ${color}` }}
        aria-hidden="true"
      />
      <PlayerAvatar player={player} size={26} dim={left} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-100">{you ? "You" : player.name}</p>
        <p className={`text-[11px] ${low ? "font-semibold text-warning" : "text-ink-500"}`}>
          {left ? "Left" : active ? (low ? `${Math.ceil(clockLeft! / 1000)}s left` : you ? "Your turn" : "Their turn") : "Waiting"}
        </p>
      </div>
      <span className="text-xl font-semibold tabular-nums text-ink-100" aria-label={`${pairs} pairs`}>
        {pairs}
      </span>
      {active && clockLeft !== null && (
        <span className="absolute inset-x-3 bottom-1 h-0.5 overflow-hidden rounded-full bg-ink-800" aria-hidden="true">
          <span
            className="block h-full origin-left rounded-full transition-transform duration-100 ease-linear"
            style={{ transform: `scaleX(${clockLeft / TURN_MS})`, background: low ? "var(--warning)" : color }}
          />
        </span>
      )}
    </div>
  );
}

export default function PairProgramming({ match, events, me, mode, now, send, onOver }: GameProps) {
  const overRef = useRef(false);
  const claimRef = useRef(-1);
  const cueRef = useRef("");
  const heardRef = useRef<{ flips: number; found: number; miss: number } | null>(null);

  const tick = useTicker(true, 10);
  const t = now();
  const state = pairsState(match, events, Math.max(0, t));
  const { pairs } = deal(match.seed, pairCount(match));
  const count = pairs.length;
  const ids = match.players.map((p) => p.id);
  const byId = new Map(match.players.map((p) => [p.id, p]));
  const nameOf = (id: string) => (id === me ? "You" : (byId.get(id)?.name ?? "Someone"));
  const solo = mode === "solo";
  const mover = ids[state.turn];
  const playing = !!me && !!state.players.get(me);
  const mine = me ? state.players.get(me) : undefined;
  const myTurn = playing && mover === me && !state.over;
  const showing = state.hideAt !== null;
  const canFlip = !!(myTurn && t >= 0 && !showing);
  const found = state.foundBy.filter(Boolean).length / 2;
  const reveal = revealMs(match);

  // ---------- The end ----------
  const finished = state.over && state.endedAt !== null && t >= state.endedAt + 1500;
  useEffect(() => {
    if (!finished || overRef.current) return;
    overRef.current = true;
    onOver(pairsStandings(match, state));
  }, [finished, match, state, onOver]);

  // ---------- The turn clock (online) ----------
  const timed = !solo && !state.over && t >= 0 && !showing;
  const turnLeft = Math.max(0, state.turnStart + TURN_MS - Math.max(0, t));
  const claimDue = timed && playing && !myTurn && !mine?.left && t >= state.turnStart + TURN_MS + 250;
  const turnNo = state.turnNo;
  useEffect(() => {
    if (!claimDue || claimRef.current === turnNo) return;
    claimRef.current = turnNo;
    send("skip", { m: turnNo });
  }, [claimDue, turnNo, send]);
  const cue = timed && myTurn && turnLeft <= 5000 && turnLeft > 0 ? `${turnNo}-${state.turnStart}-${Math.ceil(turnLeft / 1000)}` : "";
  useEffect(() => {
    if (!cue || cue === cueRef.current) return;
    cueRef.current = cue;
    sfx.tick();
  }, [cue, tick]);

  // ---------- Sounds ----------
  let flips = 0;
  for (const player of state.players.values()) flips += player.flips;
  const foundT = state.lastFound?.t ?? -1;
  const missT = state.lastMiss?.t ?? -1;
  const foundStreak = state.lastFound ? (state.players.get(state.lastFound.by)?.streak ?? 0) : 0;
  useEffect(() => {
    const heard = heardRef.current;
    heardRef.current = { flips, found: foundT, miss: missT };
    // Nothing that happened before you arrived makes a sound.
    if (!heard) return;
    if (foundT !== heard.found) {
      if (foundStreak >= 2) sfx.combo(foundStreak + 2);
      else sfx.correct();
    } else if (missT !== heard.miss) setTimeout(() => sfx.wrong(), 380);
    else if (flips > heard.flips) sfx.flip();
  }, [flips, foundT, missT, foundStreak]);
  // Online, a soft pop when it becomes your turn.
  const turnRef = useRef(-1);
  const myTurnStarts = myTurn && !solo && t >= 0;
  useEffect(() => {
    if (!myTurnStarts || turnRef.current === turnNo) return;
    turnRef.current = turnNo;
    if (turnNo > 0) sfx.pop();
  }, [myTurnStarts, turnNo]);

  const flip = useCallback(
    (i: number) => {
      if (!canFlip) return;
      send("flip", { i });
    },
    [canFlip, send]
  );

  // ---------- What's shown ----------
  const { cols, rows, wideCols, wideRows } = layout(state.cards.length);
  const recentFind = state.lastFound && t - state.lastFound.t < FOUND_NOTE_MS ? state.lastFound : null;
  const recentPair = recentFind ? pairs[state.cards[recentFind.cards[0]].pair] : null;

  let status: ReactNode;
  if (state.over) {
    status = state.foundBy.some((f) => !f) ? "Not enough players left to go on." : "Every pair found!";
  } else if (t < 0) {
    status = solo ? "Find every pair" : mover === me ? "You go first" : `${nameOf(mover)} goes first`;
  } else if (recentPair && recentFind) {
    status = (
      <span className="inline-flex flex-wrap items-center justify-center gap-x-1.5">
        <span className="gs-gradient-text">{recentFind.by === me || solo ? "Match!" : `${nameOf(recentFind.by)} found a pair:`}</span>
        <span className={recentPair.a.code ? "gs-code font-[family-name:var(--font-mono)] text-ink-200" : "text-ink-200"}>{recentPair.a.text}</span>
        <span className="text-ink-500">+</span>
        <span className={recentPair.b.code ? "gs-code font-[family-name:var(--font-mono)] text-ink-200" : "text-ink-200"}>{recentPair.b.text}</span>
      </span>
    );
  } else if (showing && state.lastMiss) {
    status = solo ? "Not a pair" : state.lastMiss.by === me ? `Not a pair. ${nameOf(mover)}'s turn next.` : `Not a pair. ${mover === me ? "Your turn next." : `${nameOf(mover)}'s turn next.`}`;
  } else if (solo) status = state.open.length === 1 ? "Now find its partner" : "Flip two cards";
  else if (myTurn) status = state.open.length === 1 ? "Now find its partner" : "Your turn: flip two cards";
  else status = `${nameOf(mover)}'s turn`;

  const streak = mine?.streak ?? 0;
  const elapsed = state.over && state.endedAt !== null ? state.endedAt : Math.max(0, t);
  // The board fits the screen's height: cards are square on phones and 4:3
  // on wider screens.
  const maxWidth = (c: number, r: number, aspect: number) => `max(18rem, min(52rem, calc((100dvh - ${solo ? 15 : 16}rem) * ${((c * aspect) / r).toFixed(4)})))`;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 px-3 py-4 sm:px-6 sm:py-6">
      {/* ---------- Scores ---------- */}
      {solo ? (
        <div className="grid w-full max-w-md grid-cols-3 gap-2">
          <Stat label="Pairs" value={`${found}/${count}`} accent />
          <Stat label="Misses" value={mine?.misses ?? 0} />
          <Stat label="Time" value={clock(elapsed)} />
        </div>
      ) : (
        <div className="grid w-full max-w-3xl grid-cols-2 gap-2 sm:flex sm:justify-center [&>*]:sm:w-48">
          {match.players.map((p) => {
            const player = state.players.get(p.id)!;
            return (
              <PlayerChip
                key={p.id}
                player={p}
                you={p.id === me}
                pairs={player.pairs}
                active={!state.over && t >= 0 && p.id === mover && !showing}
                left={player.left}
                clockLeft={timed && p.id === mover ? turnLeft : null}
              />
            );
          })}
        </div>
      )}

      {/* ---------- The cards ---------- */}
      <div
        className="pp-board grid w-full gap-2 sm:gap-3"
        style={
          {
            "--cols": cols,
            "--wide-cols": wideCols,
            "--board-max": maxWidth(cols, rows, 1),
            "--board-max-wide": maxWidth(wideCols, wideRows, 4 / 3),
          } as CSSProperties
        }
      >
        {state.cards.map((card, i) => {
          const finder = state.foundBy[i];
          const open = state.open.includes(i);
          const up = !!finder || open;
          const missed = open && showing;
          const freshFind = finder !== null && t - (state.foundAt[i] ?? -Infinity) < 1100;
          // Found cards take the finder's color (solo: the game's own).
          const color = finder ? (solo ? "#a78bfa" : playerColor(byId.get(finder)?.seat ?? 0)) : null;
          const topic = TOPICS[card.topic];
          const Icon = topic.icon;
          const flippable = canFlip && !up;
          // The text is only on the page while the card is face up (or turning
          // back over), so it can't be read ahead of time.
          const shown = up || (!!state.lastMiss?.cards.includes(i) && t < state.lastMiss.t + reveal + 700);
          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                if (flippable) flip(i);
              }}
              aria-disabled={!flippable}
              data-open={flippable}
              data-card={i}
              data-up={up}
              aria-label={up ? `${card.text}${finder ? ", found" : ""}` : `Card ${i + 1}, face down`}
              className={`pp-card pp-deal relative block aspect-square outline-none sm:aspect-[4/3] ${flippable ? "cursor-pointer" : "cursor-default"} rounded-xl focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950`}
              style={{ animationDelay: `${i * 22}ms` }}
            >
              <span className={`absolute inset-0 ${freshFind ? "pp-found" : ""} ${missed ? "pp-miss" : ""}`}>
                <span className="pp-lift absolute inset-0">
                  <span className={`pp-inner ${up ? "pp-up" : ""}`}>
                    {/* The back */}
                    <span className="pp-face pp-back grid place-items-center">
                      <span className="select-none font-[family-name:var(--font-mono)] text-base font-semibold text-white/85 sm:text-2xl">{"</>"}</span>
                    </span>
                    {/* The front */}
                    <span
                      className="pp-face pp-front flex flex-col border border-ink-700 bg-ink-900 shadow-card"
                      style={
                        color
                          ? { borderColor: color, background: `color-mix(in srgb, ${color} 13%, var(--ink-900))`, boxShadow: `0 0 0 1px ${color}, 0 0 24px -10px ${color}` }
                          : missed
                            ? { borderColor: "var(--danger)" }
                            : undefined
                      }
                    >
                      <span className="flex items-center gap-1 px-1.5 pt-1.5 text-[9px] font-medium uppercase tracking-wider text-ink-500 sm:px-2.5 sm:pt-2 sm:text-[10px]">
                        {shown && (
                          <>
                            <Icon className="h-3 w-3 shrink-0" />
                            <span className="hidden truncate sm:inline">{topic.label}</span>
                          </>
                        )}
                      </span>
                      <span
                        className={`flex flex-1 items-center justify-center px-1.5 pb-2 text-center leading-tight text-ink-100 sm:px-3 ${
                          card.code
                            ? "gs-code break-all font-[family-name:var(--font-mono)] text-[11px] sm:text-sm"
                            : `break-words font-semibold ${card.text.length > 14 ? "text-[11px] sm:text-sm" : "text-[13px] sm:text-base"}`
                        }`}
                      >
                        {shown ? card.text : ""}
                      </span>
                      {finder && (
                        <span className="absolute right-1.5 top-1.5 sm:right-2 sm:top-2">
                          {solo ? (
                            <span className="grid h-4 w-4 place-items-center rounded-full text-white" style={{ background: "linear-gradient(135deg, var(--g1), var(--g2))" }}>
                              <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                            </span>
                          ) : (
                            byId.get(finder) && <PlayerAvatar player={byId.get(finder)!} size={16} />
                          )}
                        </span>
                      )}
                    </span>
                  </span>
                </span>
              </span>
              {freshFind && color && (
                <span className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden="true">
                  {SPARKS.map((s, k) => (
                    <span
                      key={k}
                      className="pp-spark absolute -ml-1 -mt-1 h-2 w-2 rounded-full"
                      style={{ "--dx": s.dx, "--dy": s.dy, background: k % 2 ? color : "var(--g1)" } as CSSProperties}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ---------- What's happening ---------- */}
      <div className="flex min-h-12 flex-col items-center gap-1.5 text-center" aria-live="polite">
        <p className="text-sm font-semibold text-ink-100">{status}</p>
        {streak >= 2 && !state.over ? (
          <span key={streak} className="gs-pop-in inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold text-white" style={{ background: "linear-gradient(135deg, var(--g1), var(--g2))" }}>
            <Flame className="h-3.5 w-3.5" />
            {streak} in a row
          </span>
        ) : !playing ? (
          <p className="text-xs text-ink-500">You&apos;re watching this match.</p>
        ) : !solo && myTurn && turnLeft <= CLOCK_FROM_MS && timed ? (
          <p className="flex items-center gap-1 text-xs font-semibold text-warning">
            <Timer className="h-3.5 w-3.5" />
            {Math.ceil(turnLeft / 1000)}s left
          </p>
        ) : null}
      </div>
    </div>
  );
}
