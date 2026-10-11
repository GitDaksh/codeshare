"use client";

import { memo, useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Timer, Trophy } from "lucide-react";
import { PlayerAvatar } from "@/components/games/PlayerAvatar";
import { useTicker } from "@/components/games/useTicker";
import { COLS, ROWS, TURN_MS, aimOf, at, dropRow, fourStandings, fourState, fullColumns, isOver, seating, type Cell } from "@/lib/games/logic/four";
import { chooseMove, type Level } from "@/lib/games/logic/fourAI";
import { rng } from "@/lib/games/rng";
import { sfx } from "@/lib/games/sound";
import type { GameProps, Player } from "@/lib/games/types";

type Disc = 1 | 2;

// The discs' colors, for glows and accents (the discs themselves are drawn
// in games.css).
const DISC_COLOR: Record<Disc, string> = { 1: "#fb7185", 2: "#facc15" };
const DISC_NAME: Record<Disc, string> = { 1: "Rose", 2: "Gold" };

// The share of a drop spent falling (the rest is the bounce).
const IMPACT = 0.72;
// How long a disc takes to fall from above the board into `row`, bounce
// included. Like real gravity, twice the height takes ~1.4× as long.
function fallMs(row: number) {
  return Math.round((140 * Math.sqrt(row + 1.15) + 80) / IMPACT);
}

// Online, where you hover is shared at most this often, so the other player
// sees your disc move between columns.
const AIM_EVERY_MS = 120;
// Hovers stop being shared in a very long match, so moves always fit.
const AIM_EVENT_CAP = 8000;
// Online, the turn clock shows from this much time left.
const CLOCK_FROM_MS = 10_000;

// The board fits the screen: as wide as possible, but never so tall it
// needs scrolling (the board is about as tall as it is wide).
const BOARD_MAX = "max(17rem, min(36rem, calc(100dvh - 17rem)))";

const cells = (n: number) => `calc(var(--cell) * ${n})`;

// The front of the board: a rounded panel with 42 round holes, each shaded
// toward its edge. It sits in front of the discs.
const PANEL_PATH = (() => {
  let d = "M1.5 -1.5H68.5A3 3 0 0 1 71.5 1.5V58.5A3 3 0 0 1 68.5 61.5H1.5A3 3 0 0 1 -1.5 58.5V1.5A3 3 0 0 1 1.5 -1.5Z";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) d += `M${c * 10 + 1} ${r * 10 + 5}a4 4 0 1 0 8 0a4 4 0 1 0 -8 0Z`;
  }
  return d;
})();
const HOLES = Array.from({ length: ROWS * COLS }, (_, i) => ({ x: (i % COLS) * 10 + 5, y: Math.floor(i / COLS) * 10 + 5 }));

const Panel = memo(function Panel() {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const shade = `four-shade-${id}`;
  const top = `four-top-${id}`;
  return (
    <svg className="pointer-events-none absolute" style={{ inset: cells(-0.15) }} viewBox="-1.5 -1.5 73 63" aria-hidden="true">
      <defs>
        <radialGradient id={shade}>
          <stop offset="0.62" style={{ stopColor: "var(--four-shade)", stopOpacity: 0 }} />
          <stop offset="1" style={{ stopColor: "var(--four-shade)", stopOpacity: "var(--four-shade-alpha)" }} />
        </radialGradient>
        {/* The panel's edge casts a shadow into the top of each hole. */}
        <linearGradient id={top} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--four-shade)", stopOpacity: "var(--four-top-alpha)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--four-shade)", stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      {HOLES.map((h) => (
        <circle key={`s${h.x}-${h.y}`} cx={h.x} cy={h.y} r="4.05" fill={`url(#${shade})`} />
      ))}
      {HOLES.map((h) => (
        <circle key={`t${h.x}-${h.y}`} cx={h.x} cy={h.y} r="4.05" fill={`url(#${top})`} />
      ))}
      <path d={PANEL_PATH} fillRule="evenodd" style={{ fill: "var(--four-panel)" }} />
      {HOLES.map((h) => (
        <circle key={`b${h.x}-${h.y}`} cx={h.x} cy={h.y} r="4.3" fill="none" strokeWidth="0.45" style={{ stroke: "var(--four-bevel)" }} />
      ))}
    </svg>
  );
});

function DiscChip({ disc, size = 12 }: { disc: Disc; size?: number }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size, "--cell": `${size}px` } as CSSProperties}>
      <span className={`four-disc four-disc-${disc}`} style={{ inset: 0 }} />
    </span>
  );
}

function Dots() {
  return (
    <span className="four-dots inline-flex gap-0.5" aria-hidden="true">
      <span className="h-1 w-1 rounded-full bg-current" />
      <span className="h-1 w-1 rounded-full bg-current" />
      <span className="h-1 w-1 rounded-full bg-current" />
    </span>
  );
}

// One player's card above the board: who they are, their disc, and whether
// it's their move (online, with the time they have left).
function Side({
  player,
  disc,
  you,
  active,
  winner,
  left,
  clock,
  right = false,
}: {
  player: Player;
  disc: Disc;
  you: boolean;
  active: boolean;
  winner: boolean;
  left: boolean;
  // Online: the share of the turn left (1 → 0), and the milliseconds left.
  clock: { fraction: number; ms: number } | null;
  right?: boolean;
}) {
  const color = DISC_COLOR[disc];
  const low = !!clock && clock.ms <= CLOCK_FROM_MS;
  return (
    <div className={`relative flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-ink-800 bg-ink-900/85 px-2.5 py-2 shadow-xs sm:px-3 ${right ? "flex-row-reverse text-right" : ""}`}>
      <span
        className="pointer-events-none absolute -inset-px rounded-xl transition-opacity duration-300"
        style={{ opacity: active || winner ? 1 : 0, boxShadow: `0 0 0 1.5px ${color}, 0 0 28px -8px ${color}` }}
        aria-hidden="true"
      />
      <PlayerAvatar player={player} size={30} dim={left} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-100">{you ? "You" : player.name}</p>
        <p className={`flex items-center gap-1.5 text-xs ${right ? "justify-end" : ""} ${low ? "text-warning" : "text-ink-500"}`}>
          <DiscChip disc={disc} />
          {winner ? (
            <span className="inline-flex items-center gap-1 font-semibold" style={{ color }}>
              <Trophy className="h-3 w-3" />
              Winner
            </span>
          ) : left ? (
            "Left"
          ) : active ? (
            low ? (
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                <Timer className="h-3 w-3" />
                {Math.ceil(clock!.ms / 1000)}s
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-ink-300">
                {you ? "Your move" : "Thinking"}
                {!you && <Dots />}
              </span>
            )
          ) : (
            DISC_NAME[disc]
          )}
        </p>
      </div>
      {clock && active && (
        <span className="absolute inset-x-3 bottom-1 h-0.5 overflow-hidden rounded-full bg-ink-800" aria-hidden="true">
          <span
            className={`block h-full rounded-full transition-transform duration-100 ease-linear ${right ? "origin-right" : "origin-left"}`}
            style={{ transform: `scaleX(${clock.fraction})`, background: low ? "var(--warning)" : color }}
          />
        </span>
      )}
    </div>
  );
}

export default function FourInARow({ match, events, me, mode, now, send, sendAs, onOver }: GameProps) {
  const [aim, setAim] = useState(3);
  const [cpuAim, setCpuAim] = useState(3);
  const overRef = useRef(false);
  const heardRef = useRef(-1);
  const claimRef = useRef(-1);
  const announcedRef = useRef(-1);
  const cueRef = useRef("");
  const aimShare = useRef<{ last: number; col: number; timer: ReturnType<typeof setTimeout> | null }>({ last: 0, col: -1, timer: null });

  const tick = useTicker(true, 10);
  const t = now();

  // ---------- The game so far ----------
  const state = fourState(match, events);
  const seats = seating(match);
  const discOf = (id: string): Disc | 0 => (id === seats[0] ? 1 : id === seats[1] ? 2 : 0);
  const byId = new Map(match.players.map((p) => [p.id, p]));
  const nameOf = (id: string | null) => (!id ? "" : id === me ? "You" : (byId.get(id)?.name ?? "Someone"));
  const mover = seats[state.turn - 1];
  const myDisc = me ? discOf(me) : 0;
  const playing = myDisc !== 0;
  const over = isOver(state);
  const moveCount = state.moves.length;
  const last = state.moves[moveCount - 1];
  const lastRow = last?.row ?? 0;
  const lastLandsAt = last ? last.t + fallMs(last.row) : 0;
  const myTurn = playing && !over && mover === me;
  const canMove = myTurn && t >= 0;
  const cpu = mode === "solo" ? match.players.find((p) => p.bot) : undefined;
  const cpuDisc = cpu ? discOf(cpu.id) : 0;
  const cpuTurn = !!cpu && !over && mover === cpu.id;
  const level = (["easy", "medium", "hard"].includes(String(match.settings.level)) ? String(match.settings.level) : "medium") as Level;
  const boardKey = state.board.join("");
  // Which columns are full, one bit each (a column is full when its top space is taken).
  const fullMask = fullColumns(state.board) | 0;
  const winnerId = state.winner ? seats[state.winner - 1] : null;

  // The end: the winning line is drawn once the last disc lands, and the
  // results come a moment later.
  const won = !!state.line;
  const lineShown = won && !!last && t >= state.endedAt! + fallMs(last.row) * IMPACT;
  const overAt = !over || state.endedAt === null ? null : state.forfeit ? state.endedAt + 900 : state.endedAt + fallMs(lastRow) + 1300;
  const finished = overAt !== null && t >= overAt;

  // Online, each turn is timed.
  const timed = mode === "online" && !over && t >= 0;
  const turnLeft = Math.max(0, state.turnStart + TURN_MS - Math.max(0, t));
  // When the mover's time runs out, the other player's browser says so.
  const claimDue = timed && playing && !myTurn && t >= state.turnStart + TURN_MS + 250;
  // The last five seconds of your turn tick.
  const cue = timed && myTurn && turnLeft <= 5000 && turnLeft > 0 ? `${moveCount}-${Math.ceil(turnLeft / 1000)}` : "";

  // The disc waiting above the board: yours on your turn, the computer's on
  // its turn, and online the other player's wherever they're hovering. It
  // shows once the last disc has landed.
  let ghost: { key: string; col: number; disc: Disc; mine: boolean } | null = null;
  if (!over && t >= 0 && t >= lastLandsAt) {
    const disc = state.turn;
    if (mover === me) ghost = { key: `g-${mover}`, col: aim, disc, mine: true };
    else if (cpuTurn) ghost = { key: `g-${mover}`, col: cpuAim, disc, mine: false };
    else {
      const theirs = aimOf(events, state, mover);
      if (theirs !== null) ghost = { key: `g-${mover}`, col: theirs, disc, mine: false };
    }
  }
  const landing = ghost ? dropRow(state.board, ghost.col) : -1;

  // Four in a row: the winning discs, and a line through them end to end.
  const lineCells = new Set((lineShown && state.line ? state.line : []).map(([r, c]) => at(r, c)));
  let line: { left: string; top: string; width: string; angle: number } | null = null;
  if (lineShown && state.line) {
    const sorted = [...state.line].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const [r0, c0] = sorted[0];
    const [r1, c1] = sorted[sorted.length - 1];
    line = {
      left: cells(c0 + 0.5),
      top: cells(r0 + 0.5 - 0.07),
      width: cells(Math.hypot(c1 - c0, r1 - r0) + 0.36),
      angle: (Math.atan2(r1 - r0, c1 - c0) * 180) / Math.PI,
    };
  }

  // Left: you (or the first player if you're watching). Right: the other.
  const leftId = playing ? me! : match.players[0].id;
  const sides = [leftId, match.players.find((p) => p.id !== leftId)?.id ?? seats[1]];

  const slowId = last?.auto ? seats[last.disc - 1] : null;
  const autoNotice =
    slowId && !over && t - last!.t < 4000 ? (slowId === me ? "You ran out of time, so a disc was dropped for you." : `${nameOf(slowId)} ran out of time, so a disc was dropped for them.`) : null;

  let status: ReactNode;
  if (state.forfeit) status = winnerId === me ? `${nameOf(state.forfeit)} left. You win!` : `${nameOf(state.forfeit)} left the game.`;
  else if (state.winner) status = winnerId === me ? "Four in a row. You win!" : `${nameOf(winnerId)} wins!`;
  else if (state.draw) status = "The board is full. It's a draw!";
  else if (t < 0) status = mover === me ? "You go first" : `${nameOf(mover)} goes first`;
  else if (mover === me) status = "Your move";
  else
    status = (
      <span className="inline-flex items-center gap-1.5">
        {nameOf(mover)} is thinking <Dots />
      </span>
    );

  // ---------- When it's over ----------
  useEffect(() => {
    if (!finished || overRef.current) return;
    overRef.current = true;
    onOver(fourStandings(match, state, mode === "solo"));
  }, [finished, match, state, mode, onOver]);

  // ---------- Sounds: a thud when a disc lands, a chime for four in a row ----------
  useEffect(() => {
    // Discs already on the board when you arrived make no sound.
    if (heardRef.current === -1 || moveCount < heardRef.current) {
      heardRef.current = moveCount;
      return;
    }
    if (moveCount === heardRef.current) return;
    heardRef.current = moveCount;
    const impact = fallMs(lastRow) * IMPACT;
    setTimeout(() => sfx.drop(), impact);
    if (won) setTimeout(() => sfx.correct(), impact + 260);
  }, [moveCount, lastRow, won]);

  // ---------- The turn clock (online) ----------
  useEffect(() => {
    if (!claimDue || claimRef.current === moveCount) return;
    claimRef.current = moveCount;
    send("timeout", { m: moveCount });
  }, [claimDue, moveCount, send]);
  useEffect(() => {
    if (!cue || cue === cueRef.current) return;
    cueRef.current = cue;
    sfx.tick();
  }, [cue, tick]);

  // ---------- Your moves ----------
  const shareAim = useCallback(
    (col: number, force = false) => {
      if (mode !== "online") return;
      const share = aimShare.current;
      if (share.timer) clearTimeout(share.timer);
      share.timer = null;
      if (force) share.col = -1;
      const flush = () => {
        share.timer = null;
        if (share.col === col) return;
        share.col = col;
        share.last = Date.now();
        send("aim", { c: col });
      };
      const wait = share.last + AIM_EVERY_MS - Date.now();
      if (wait <= 0) flush();
      else share.timer = setTimeout(flush, wait);
    },
    [mode, send]
  );
  useEffect(() => {
    const share = aimShare.current;
    return () => {
      if (share.timer) clearTimeout(share.timer);
    };
  }, []);

  const aimAt = useCallback(
    (col: number) => {
      setAim(col);
      if (canMove && events.length < AIM_EVENT_CAP) shareAim(col);
    },
    [canMove, events.length, shareAim]
  );

  // At the start of your turn, show the other player where your disc is.
  useEffect(() => {
    if (!canMove || mode !== "online" || announcedRef.current === moveCount) return;
    announcedRef.current = moveCount;
    shareAim(aim, true);
  }, [canMove, mode, moveCount, aim, shareAim]);

  const drop = useCallback(
    (col: number) => {
      if (!canMove || col < 0 || col >= COLS || (fullMask >> col) & 1) return;
      setAim(col);
      const share = aimShare.current;
      if (share.timer) clearTimeout(share.timer);
      share.timer = null;
      send("drop", { c: col });
    },
    [canMove, fullMask, send]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || !canMove) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      if (/^[1-7]$/.test(e.key)) {
        e.preventDefault();
        drop(Number(e.key) - 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        aimAt(Math.min(COLS - 1, Math.max(0, aim + (e.key === "ArrowLeft" ? -1 : 1))));
      } else if (e.key === "ArrowDown" || ((e.key === "Enter" || e.key === " ") && !target?.closest?.("button, a"))) {
        e.preventDefault();
        drop(aim);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canMove, aim, aimAt, drop]);

  // ---------- The computer's moves (solo) ----------
  useEffect(() => {
    if (!cpuTurn || !cpu || !cpuDisc) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Think once the last disc has landed (or once the game starts).
    const wait = Math.max(300, lastLandsAt + 260 - now());
    timers.push(
      setTimeout(() => {
        const board = Array.from(boardKey, Number) as Cell[];
        const moves = board.filter(Boolean).length;
        const col = chooseMove(board, cpuDisc, level, (match.seed + moves * 7919) >>> 0);
        // Glance at a column or two first, like a person would.
        const random = rng((match.seed ^ Math.imul(moves + 1, 0x9e3779b1)) >>> 0);
        const path: number[] = [];
        const glances = level === "easy" ? (random() < 0.5 ? 1 : 0) : 1 + Math.floor(random() * 2);
        for (let i = 0; i < glances; i++) {
          const near = Math.min(COLS - 1, Math.max(0, col + (random() < 0.5 ? -1 : 1) * (1 + Math.floor(random() * 2))));
          if (near !== col && near !== path[path.length - 1]) path.push(near);
        }
        path.push(col);
        path.forEach((c, i) => timers.push(setTimeout(() => setCpuAim(c), i * 240)));
        timers.push(setTimeout(() => sendAs(cpu.id, "drop", { c: col }), path.length * 240 + 140));
      }, wait)
    );
    return () => timers.forEach(clearTimeout);
  }, [cpuTurn, cpu, cpuDisc, boardKey, level, match.seed, lastLandsAt, now, sendAs]);

  return (
    <div className="mx-auto flex w-full flex-col items-center gap-3 px-3 py-4 sm:gap-4 sm:px-6 sm:py-6" style={{ maxWidth: `calc(${BOARD_MAX} + 1.5rem)` }}>
      {/* ---------- Who's playing ---------- */}
      <div className="flex w-full items-center gap-2 sm:gap-3">
        {sides.map((id, i) => {
          const player = byId.get(id);
          const disc = discOf(id);
          if (!player || !disc) return null;
          return (
            <Side
              key={id}
              player={player}
              disc={disc}
              you={id === me}
              active={!over && t >= 0 && id === mover}
              winner={winnerId === id}
              left={state.forfeit === id}
              clock={timed && id === mover ? { fraction: turnLeft / TURN_MS, ms: turnLeft } : null}
              right={i === 1}
            />
          );
        })}
      </div>

      {/* ---------- The board ---------- */}
      <div className="w-full" style={{ containerType: "inline-size" }}>
        <div className="four-board relative select-none" style={{ "--cell": "calc(100cqw / 7.3)" } as CSSProperties}>
          {/* Above the board: the disc about to drop */}
          <div className="relative" style={{ marginLeft: cells(0.15), width: cells(7), height: cells(1) }}>
            {ghost && (
              <span key={ghost.key} data-ghost={ghost.col} className="four-glide absolute left-0 top-0" style={{ width: cells(1), height: cells(1), transform: `translate3d(${ghost.col * 100}%, 0, 0)` }}>
                <span className="gs-pop-in absolute inset-0">
                  <span className="gs-bob absolute inset-0">
                    <span
                      className={`four-disc four-disc-${ghost.disc}`}
                      style={{ opacity: ghost.mine ? 1 : 0.85, boxShadow: `0 0 ${cells(0.35)} ${cells(-0.05)} ${DISC_COLOR[ghost.disc]}` }}
                    />
                  </span>
                </span>
              </span>
            )}
          </div>

          <div className="four-frame relative" style={{ padding: cells(0.15) }}>
            <div className="relative" style={{ width: cells(7), height: cells(6) }}>
              {/* Where the waiting disc would land */}
              {ghost && landing >= 0 && (
                <span className="absolute" style={{ left: cells(ghost.col), top: cells(landing), width: cells(1), height: cells(1), opacity: ghost.mine ? 0.28 : 0.18 }}>
                  <span className={`four-disc four-disc-${ghost.disc}`} />
                </span>
              )}

              {/* The discs */}
              {state.moves.map((m, i) => {
                const fresh = t - m.t < fallMs(m.row) + 400;
                const winning = lineCells.has(at(m.row, m.col));
                return (
                  <span
                    key={i}
                    data-disc={m.disc}
                    data-col={m.col}
                    data-row={m.row}
                    className={`absolute ${fresh ? "four-drop" : ""}`}
                    style={
                      {
                        left: cells(m.col),
                        top: cells(m.row),
                        width: cells(1),
                        height: cells(1),
                        "--from": cells(-(m.row + 1.15)),
                        "--fall": `${fallMs(m.row)}ms`,
                      } as CSSProperties
                    }
                  >
                    <span className={`four-disc four-disc-${m.disc} transition-opacity duration-500 ${winning ? "four-win" : ""} ${lineShown && !winning ? "opacity-40" : ""}`} />
                  </span>
                );
              })}

              <Panel />

              {/* The lit column under your disc */}
              <span
                className="four-tint pointer-events-none absolute left-0 top-0 h-full rounded-[calc(var(--cell)*0.5)]"
                style={{
                  width: cells(1),
                  transform: `translate3d(${aim * 100}%, 0, 0)`,
                  opacity: ghost?.mine ? 1 : 0,
                  background: `linear-gradient(180deg, color-mix(in srgb, ${DISC_COLOR[myDisc || 1]} 11%, transparent), transparent 92%)`,
                }}
                aria-hidden="true"
              />

              {/* Four in a row */}
              {line && (
                <span
                  className="four-line pointer-events-none absolute rounded-full bg-white"
                  style={
                    {
                      left: line.left,
                      top: line.top,
                      width: line.width,
                      height: cells(0.14),
                      "--angle": `${line.angle}deg`,
                      "--back": cells(-0.18),
                      boxShadow: `0 0 ${cells(0.3)} ${DISC_COLOR[state.winner ?? 1]}, 0 0 0 1px rgb(0 0 0 / 0.18)`,
                    } as CSSProperties
                  }
                  aria-hidden="true"
                />
              )}

              {/* The columns you can drop into */}
              <div className="absolute inset-x-0 bottom-0 grid grid-cols-7" style={{ top: cells(-1.15) }}>
                {Array.from({ length: COLS }, (_, c) => {
                  const full = ((fullMask >> c) & 1) === 1;
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Drop a disc in column ${c + 1}${full ? " (full)" : ""}`}
                      aria-disabled={!canMove || full}
                      onMouseDown={(e) => e.preventDefault()}
                      onPointerMove={(e) => {
                        if (e.pointerType === "mouse" && c !== aim) aimAt(c);
                      }}
                      onClick={() => drop(c)}
                      className={`h-full touch-manipulation rounded-[calc(var(--cell)*0.3)] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-400 ${canMove && !full ? "cursor-pointer" : "cursor-default"}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- What's happening ---------- */}
      <div className="flex min-h-12 flex-col items-center gap-1 text-center" aria-live="polite">
        <p className={`text-sm font-semibold ${over ? "gs-pop-in text-ink-100" : mover === me ? "text-ink-100" : "text-ink-300"}`}>{status}</p>
        {autoNotice ? (
          <p className="gs-rise flex items-center gap-1.5 text-xs text-warning">
            <Timer className="h-3.5 w-3.5" />
            {autoNotice}
          </p>
        ) : canMove ? (
          <p className="text-xs text-ink-500">
            <span className="hidden sm:inline">Click a column, or press 1–7 (← → and Enter work too)</span>
            <span className="sm:hidden">Tap a column to drop your disc</span>
          </p>
        ) : !playing ? (
          <p className="text-xs text-ink-500">You&apos;re watching this match.</p>
        ) : cpuTurn ? (
          <p className="text-xs text-ink-500">{level === "hard" ? "It looks a long way ahead." : level === "easy" ? "It's still learning." : "It's pretty good."}</p>
        ) : null}
      </div>
    </div>
  );
}
