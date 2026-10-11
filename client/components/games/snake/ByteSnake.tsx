"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Timer, Zap } from "lucide-react";
import { PlayerAvatar } from "@/components/games/PlayerAvatar";
import { useTicker } from "@/components/games/useTicker";
import { DX, DY, GOLDEN_STEPS, RESPAWN_MS, SIZE, SnakeCache, durationMs, multiplier, snakeStandings, snakeWorld, xOf, yOf, type SnakeSim, type Turn } from "@/lib/games/logic/snake";
import { playerColor } from "@/lib/games/registry";
import { sfx } from "@/lib/games/sound";
import type { GameProps } from "@/lib/games/types";

const LIME = "#a3e635";
const LIME_DEEP = "#4d7c0f";
const GOLD = "#facc15";
const CRASH = "#f87171";
const KEYS: Record<string, number> = { ArrowUp: 0, w: 0, W: 0, ArrowRight: 1, d: 1, D: 1, ArrowDown: 2, s: 2, S: 2, ArrowLeft: 3, a: 3, A: 3 };
// A swipe this long (in pixels) turns the snake.
const SWIPE_PX = 22;
// The board fits the screen's height.
const BOARD_MAX = "max(17rem, min(40rem, calc(100dvh - 15rem)))";

type Latest = Pick<GameProps, "match" | "events" | "me" | "mode" | "now" | "send">;
type Particle = { x: number; y: number; vx: number; vy: number; born: number; life: number; color: string; size: number };
type Floater = { x: number; y: number; text: string; born: number; color: string };
type Theme = { board: string; dots: string; edge: string; text: string; light: boolean; mono: string; sans: string };

function readTheme(): Theme {
  const root = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => root.getPropertyValue(name).trim() || fallback;
  const light = document.documentElement.classList.contains("light");
  return {
    board: v("--ink-900", light ? "#ffffff" : "#1b1b1f"),
    dots: v("--ink-700", light ? "#dfdfe4" : "#36363d"),
    edge: v("--ink-800", light ? "#ececf0" : "#27272c"),
    text: v("--ink-100", light ? "#1f1f24" : "#f4f4f5"),
    light,
    mono: v("--font-mono", "ui-monospace, monospace"),
    sans: getComputedStyle(document.body).fontFamily || "system-ui, sans-serif",
  };
}

// The snake as a line through the middles of its spaces, with the head
// gliding into its next space and the tail sliding out of its last one.
function snakePoints(sim: SnakeSim, t: number): [number, number][] {
  const body = sim.body;
  if (body.length === 0) return [];
  const p = sim.alive && sim.leftAt === null ? Math.min(1, Math.max(0, (t - sim.lastAt) / Math.max(1, sim.nextAt - sim.lastAt))) : 0;
  const dir = sim.upcomingDir();
  const points: [number, number][] = [[xOf(body[0]) + 0.5 + DX[dir] * p, yOf(body[0]) + 0.5 + DY[dir] * p]];
  for (const cell of body) points.push([xOf(cell) + 0.5, yOf(cell) + 0.5]);
  if (!sim.growing && body.length >= 2 && p > 0) {
    const [tx, ty] = points[points.length - 1];
    const [bx, by] = points[points.length - 2];
    points[points.length - 1] = [tx + (bx - tx) * p, ty + (by - ty) * p];
  }
  return points;
}

function strokeSnake(ctx: CanvasRenderingContext2D, points: [number, number][], c: number, color: string, deep: string, alpha: number, width: number, glow: number) {
  if (points.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0][0] * c, points[0][1] * c);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0] * c, points[i][1] * c);
  // The glow, then the body, then a shine along the top.
  ctx.globalAlpha = alpha * glow;
  ctx.strokeStyle = color;
  ctx.lineWidth = c * width * 1.9;
  ctx.stroke();
  const [hx, hy] = points[0];
  const [ex, ey] = points[points.length - 1];
  const gradient = ctx.createLinearGradient(hx * c, hy * c, ex * c, ey * c);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, deep);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = gradient;
  ctx.lineWidth = c * width;
  ctx.stroke();
  ctx.globalAlpha = alpha * 0.35;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = c * width * 0.22;
  ctx.stroke();
  ctx.restore();
}

function drawHead(ctx: CanvasRenderingContext2D, sim: SnakeSim, point: [number, number], c: number, color: string, alpha: number, eyes: boolean) {
  const [x, y] = point;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x * c, y * c, c * 0.42, 0, Math.PI * 2);
  ctx.fill();
  if (eyes) {
    const dir = sim.upcomingDir();
    const fx = DX[dir];
    const fy = DY[dir];
    // Two eyes, side by side across the direction of travel.
    for (const side of [-1, 1]) {
      const ex = x * c + fx * c * 0.14 + -fy * side * c * 0.17;
      const ey = y * c + fy * c * 0.14 + fx * side * c * 0.17;
      ctx.fillStyle = "#0b0b0e";
      ctx.beginPath();
      ctx.arc(ex, ey, c * 0.085, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ex + fx * c * 0.025, ey + fy * c * 0.025, c * 0.032, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFood(ctx: CanvasRenderingContext2D, sim: SnakeSim, c: number, t: number, theme: Theme) {
  const { cell, golden, until } = sim.food;
  const cx = (xOf(cell) + 0.5) * c;
  const cy = (yOf(cell) + 0.5) * c;
  const pulse = 0.5 + 0.5 * Math.sin(t / 220);
  const color = golden ? GOLD : LIME;
  const s = c * (0.66 + pulse * 0.05);
  ctx.save();
  // Glow
  ctx.globalAlpha = (theme.light ? 0.16 : 0.26) + pulse * 0.12;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, c * 0.62, 0, Math.PI * 2);
  ctx.fill();
  // The chip
  ctx.globalAlpha = 1;
  const gradient = ctx.createLinearGradient(cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2);
  gradient.addColorStop(0, golden ? "#fef08a" : "#d9f99d");
  gradient.addColorStop(1, golden ? "#ca8a04" : "#65a30d");
  ctx.fillStyle = gradient;
  roundRect(ctx, cx - s / 2, cy - s / 2, s, s, c * 0.16);
  ctx.fill();
  // Its value, in hex
  ctx.fillStyle = "#1a2e05";
  ctx.font = `700 ${Math.round(c * 0.34)}px ${theme.mono}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(golden ? "FF" : ((cell * 151 + 23) & 255).toString(16).toUpperCase().padStart(2, "0"), cx, cy + c * 0.02);
  // A golden byte's time running out
  if (golden && until !== null) {
    const left = Math.max(0, Math.min(1, (until - sim.step) / GOLDEN_STEPS));
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = c * 0.07;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(cx, cy, c * 0.56, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBoard(theme: Theme, px: number, dpr: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d")!;
  const c = px / SIZE;
  ctx.fillStyle = theme.board;
  roundRect(ctx, 0, 0, px, px, 14 * dpr);
  ctx.fill();
  // A soft light in the middle.
  const light = ctx.createRadialGradient(px / 2, px * 0.42, 0, px / 2, px / 2, px * 0.7);
  light.addColorStop(0, theme.light ? "rgba(163, 230, 53, 0.08)" : "rgba(163, 230, 53, 0.07)");
  light.addColorStop(1, "rgba(163, 230, 53, 0)");
  ctx.fillStyle = light;
  roundRect(ctx, 0, 0, px, px, 14 * dpr);
  ctx.fill();
  // Dots where the grid lines cross.
  ctx.fillStyle = theme.dots;
  for (let y = 1; y < SIZE; y++) {
    for (let x = 1; x < SIZE; x++) {
      ctx.beginPath();
      ctx.arc(x * c, y * c, Math.max(0.8 * dpr, c * 0.045), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvas;
}

export default function ByteSnake({ match, events, me, mode, now, send, onOver }: GameProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<SnakeCache | null>(null);
  const latest = useRef<Latest>({ match, events, me, mode, now, send });
  const overRef = useRef(false);
  const swipeRef = useRef<{ x: number; y: number; id: number } | null>(null);
  // Your latest turns, until they show up in the match's moves.
  const localRef = useRef<Turn[]>([]);

  useEffect(() => {
    latest.current = { match, events, me, mode, now, send };
  });

  const tick = useTicker(true, 10);
  const t = now();
  const world = snakeWorld(match, events, Math.max(0, t));
  const ends = durationMs(match);
  const mine = me ? world.get(me) : undefined;
  const solo = mode === "solo";

  // ---------- The end ----------
  const crashT = mine?.crash?.t ?? null;
  const finished = solo ? !!mine?.over && crashT !== null && t >= crashT + 900 : ends !== null && t >= ends + 1000;
  useEffect(() => {
    if (!finished || overRef.current) return;
    overRef.current = true;
    onOver(snakeStandings(match, snakeWorld(match, events, ends ?? Math.max(0, now()))));
  }, [finished, match, events, ends, now, onOver, tick]);

  // ---------- Steering ----------
  const steer = useCallback((d: number) => {
    const { match: m, events: e, me: you, now: clock, send: emit } = latest.current;
    if (!you) return;
    const at = clock();
    const limit = durationMs(m);
    if (at < 0 || (limit !== null && at >= limit)) return;
    if (!cacheRef.current) cacheRef.current = new SnakeCache();
    localRef.current = localRef.current.filter((turn) => at - turn.t < 3000);
    const sim = cacheRef.current.update(m, e, at, { id: you, turns: localRef.current }).get(you);
    if (!sim || sim.over || !sim.alive || sim.leftAt !== null) return;
    const planned = sim.plannedDir();
    if (d === planned || d === (planned + 2) % 4) return;
    const k = sim.nextFreeStep();
    // At most two turns waiting.
    if (k > sim.step + 2) return;
    // Shown at once here, so the snake answers this very frame.
    localRef.current = [...localRef.current, { d, k, t: at }];
    emit("turn", { d, k });
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const d = KEYS[e.key];
      if (d === undefined) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      steer(d);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [steer]);

  // Swipes: each 22 px in one direction is a turn (without lifting).
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return;
    swipeRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeRef.current;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0);
    swipeRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerUp = () => {
    swipeRef.current = null;
  };

  // ---------- Drawing (every frame) ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let px = 0;
    let dpr = 1;
    let theme = readTheme();
    let board: HTMLCanvasElement | null = null;
    const particles: Particle[] = [];
    const floaters: Floater[] = [];
    const seen = new Map<string, { eaten: number; deaths: number }>();

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      px = Math.max(1, Math.round(wrap.clientWidth * dpr));
      canvas.width = px;
      canvas.height = px;
      board = null;
    };
    resize();
    const sizes = new ResizeObserver(resize);
    sizes.observe(wrap);
    const themes = new MutationObserver(() => {
      theme = readTheme();
      board = null;
    });
    themes.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const burst = (x: number, y: number, colors: string[], count: number, speed: number, at: number) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const v = speed * (0.35 + Math.random() * 0.65);
        particles.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, born: at, life: 420 + Math.random() * 380, color: colors[i % colors.length], size: 0.08 + Math.random() * 0.1 });
      }
    };

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const { match: m, events: e, me: you, now: clock } = latest.current;
      const at = clock();
      const wall = performance.now();
      if (!cacheRef.current) cacheRef.current = new SnakeCache();
      const sims = cacheRef.current.update(m, e, Math.max(0, at), you ? { id: you, turns: localRef.current } : undefined);
      if (!board) board = drawBoard(theme, px, dpr);
      const c = px / SIZE;
      ctx.clearRect(0, 0, px, px);
      ctx.drawImage(board, 0, 0);

      const players = m.players;
      const mineSim = you ? sims.get(you) : undefined;
      const focus = mineSim ?? sims.get(players[0]?.id ?? "");

      // Bites and crashes: sparks, a "+10", sounds and a shake (yours).
      for (const p of players) {
        const sim = sims.get(p.id);
        if (!sim) continue;
        const before = seen.get(p.id);
        seen.set(p.id, { eaten: sim.eaten, deaths: sim.deaths });
        if (!before) continue;
        const yours = p.id === you;
        if (sim.eaten > before.eaten && sim.lastEat) {
          const x = xOf(sim.lastEat.cell) + 0.5;
          const y = yOf(sim.lastEat.cell) + 0.5;
          if (yours) {
            burst(x, y, sim.lastEat.golden ? [GOLD, "#fef08a"] : [LIME, "#d9f99d"], sim.lastEat.golden ? 18 : 10, sim.lastEat.golden ? 5 : 3.4, wall);
            floaters.push({ x, y, text: `+${sim.lastEat.points}`, born: wall, color: sim.lastEat.golden ? GOLD : LIME });
            if (sim.lastEat.golden) sfx.combo(9);
            else sfx.eat();
          } else burst(x, y, [playerColor(p.seat)], 5, 2.2, wall);
        }
        if (sim.deaths > before.deaths && sim.crash) {
          const x = xOf(sim.crash.cell) + 0.5;
          const y = yOf(sim.crash.cell) + 0.5;
          if (yours) {
            burst(x, y, [CRASH, "#fb923c", LIME], 26, 6, wall);
            sfx.crash();
            wrap.animate(
              [
                { transform: "translate3d(0,0,0)" },
                { transform: "translate3d(-6px,2px,0)" },
                { transform: "translate3d(5px,-3px,0)" },
                { transform: "translate3d(-3px,1px,0)" },
                { transform: "translate3d(0,0,0)" },
              ],
              { duration: 320, easing: "ease-out" }
            );
          } else burst(x, y, [playerColor(p.seat)], 10, 3, wall);
        }
      }

      // The byte (everyone's is usually in the same place; yours is shown).
      if (focus && !focus.over && at >= 0) drawFood(ctx, focus, c, at, theme);

      // Everyone else, as ghosts with their names.
      for (const p of players) {
        if (p.id === you) continue;
        const sim = sims.get(p.id);
        if (!sim || sim.leftAt !== null) continue;
        const color = playerColor(p.seat);
        const fading = sim.alive ? 1 : Math.max(0, 1 - (at - (sim.crash?.t ?? at)) / 700);
        if (fading <= 0) continue;
        const points = snakePoints(sim, at);
        strokeSnake(ctx, points, c, color, color, 0.42 * fading, 0.46, theme.light ? 0.25 : 0.35);
        if (points[0]) {
          drawHead(ctx, sim, points[0], c, color, 0.55 * fading, false);
          ctx.save();
          ctx.globalAlpha = 0.85 * fading;
          ctx.font = `600 ${Math.max(10 * dpr, Math.round(c * 0.4))}px ${theme.sans}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillStyle = color;
          ctx.fillText(p.name, points[0][0] * c, points[0][1] * c - c * 0.55);
          ctx.restore();
        }
      }

      // You.
      if (mineSim && mineSim.leftAt === null) {
        const crashedFor = mineSim.alive ? 0 : at - (mineSim.crash?.t ?? at);
        const fading = mineSim.alive ? 1 : Math.max(0, 1 - crashedFor / (mineSim.over ? 2400 : 900));
        const flicker = mineSim.alive ? 1 : 0.55 + 0.45 * Math.round(Math.sin(crashedFor / 45) * 0.5 + 0.5);
        if (fading > 0) {
          const points = snakePoints(mineSim, at);
          // On the light board, deeper greens keep the snake easy to see.
          const body = mineSim.alive ? (theme.light ? "#65a30d" : LIME) : CRASH;
          const tail = mineSim.alive ? (theme.light ? "#365314" : LIME_DEEP) : "#7f1d1d";
          const head = mineSim.alive ? (theme.light ? "#84cc16" : "#d9f99d") : "#fecaca";
          strokeSnake(ctx, points, c, body, tail, fading * flicker, 0.62, theme.light ? 0.16 : 0.26);
          if (points[0]) drawHead(ctx, mineSim, points[0], c, head, fading * flicker, true);
        }
        // Waiting to come back: a ring filling up at the start.
        if (!mineSim.alive && !mineSim.over && mineSim.respawnAt !== null) {
          const done = Math.min(1, 1 - (mineSim.respawnAt - at) / RESPAWN_MS);
          ctx.save();
          ctx.strokeStyle = LIME;
          ctx.globalAlpha = 0.85;
          ctx.lineWidth = c * 0.12;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.arc(5.5 * c, 10.5 * c, c * 0.7, -Math.PI / 2, -Math.PI / 2 + done * Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Sparks and floating points.
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const age = wall - p.born;
        if (age > p.life) {
          particles.splice(i, 1);
          continue;
        }
        const k = age / 1000;
        ctx.globalAlpha = 1 - age / p.life;
        ctx.fillStyle = p.color;
        const size = p.size * c;
        ctx.fillRect((p.x + p.vx * k * (1 - k * 0.6)) * c - size / 2, (p.y + p.vy * k * (1 - k * 0.6)) * c - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        const age = wall - f.born;
        if (age > 800) {
          floaters.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = 1 - age / 800;
        ctx.fillStyle = f.color;
        ctx.font = `700 ${Math.round(c * 0.5)}px ${theme.sans}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(f.text, f.x * c, (f.y - 0.7 - (age / 800) * 0.9) * c);
        ctx.restore();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      sizes.disconnect();
      themes.disconnect();
    };
  }, []);

  // ---------- What's shown around the board ----------
  const length = mine ? mine.length : 3;
  const bonus = multiplier(length);
  const left = ends === null ? null : Math.max(0, ends - Math.max(0, t));
  const board = [...match.players]
    .map((p) => ({ player: p, sim: world.get(p.id)! }))
    .sort((a, b) => b.sim.points - a.sim.points || a.sim.deaths - b.sim.deaths);

  let status: string;
  if (t < 0) status = solo ? "Eat the bytes. Don't hit the walls or yourself." : "Same board, same bytes. Most points wins.";
  else if (mine?.over) status = "Crashed!";
  else if (mine && !mine.alive && mine.respawnAt !== null) status = `Crashed! Back in ${Math.max(0, (mine.respawnAt - t) / 1000).toFixed(1)}s`;
  else if (left !== null && left <= 0) status = "Time's up!";
  else status = "";

  return (
    <div className="mx-auto flex w-full flex-col items-center gap-3 px-3 py-4 sm:gap-4 sm:px-6 sm:py-6" style={{ maxWidth: `calc(${BOARD_MAX} + 1.5rem)` }}>
      {/* ---------- Score ---------- */}
      <div className="flex w-full items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-ink-500">Score</p>
          <p className="gs-gradient-text text-3xl font-semibold tabular-nums tracking-tight">{(mine?.points ?? 0).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-ink-800 bg-ink-900/85 px-2.5 py-1 text-xs text-ink-400 shadow-xs">
            Length <span className="font-semibold tabular-nums text-ink-100">{length}</span>
          </span>
          {bonus > 1 && (
            <span key={bonus} className="gs-pop-in inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-ink-950" style={{ background: "linear-gradient(135deg, var(--g1), var(--g2))" }}>
              <Zap className="h-3 w-3" />×{bonus}
            </span>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-ink-500">{left === null ? "Bytes" : "Time"}</p>
          <p className={`text-3xl font-semibold tabular-nums ${left !== null && left <= 10_000 && t >= 0 ? "text-warning" : "text-ink-100"}`}>
            {left === null ? (mine?.eaten ?? 0) : `${Math.floor(Math.ceil(left / 1000) / 60)}:${String(Math.ceil(left / 1000) % 60).padStart(2, "0")}`}
          </p>
        </div>
      </div>

      {/* ---------- The board ---------- */}
      <div
        ref={wrapRef}
        className="relative aspect-square w-full touch-none select-none rounded-[14px] shadow-card ring-1 ring-ink-800"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label={`Byte Snake board. Your score: ${mine?.points ?? 0}.`}
        data-head={mine?.body[0]}
        data-dir={mine?.plannedDir()}
        data-food={mine?.food.cell}
        data-body={mine?.body.join(",")}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </div>

      {/* ---------- What's happening ---------- */}
      <p className={`min-h-5 text-center text-sm font-semibold ${status.startsWith("Crashed") ? "text-danger" : "text-ink-200"}`} aria-live="polite">
        {status}
      </p>

      {/* ---------- Arrows for touch screens ---------- */}
      <div className="grid grid-cols-3 gap-2 sm:hidden" aria-label="Steer">
        {[
          { d: 0, icon: ArrowUp, label: "Up", place: "col-start-2" },
          { d: 3, icon: ArrowLeft, label: "Left", place: "col-start-1 row-start-2" },
          { d: 2, icon: ArrowDown, label: "Down", place: "col-start-2 row-start-2" },
          { d: 1, icon: ArrowRight, label: "Right", place: "col-start-3 row-start-2" },
        ].map(({ d, icon: Icon, label, place }) => (
          <button
            key={d}
            type="button"
            aria-label={label}
            onPointerDown={(e) => {
              e.preventDefault();
              steer(d);
            }}
            className={`${place} grid h-12 w-14 touch-none place-items-center rounded-xl border border-ink-700 bg-ink-900 text-ink-200 shadow-xs active:scale-95`}
          >
            <Icon className="h-5 w-5" />
          </button>
        ))}
      </div>
      <p className="hidden text-center text-xs text-ink-500 sm:block">Steer with the arrow keys or WASD.</p>

      {/* ---------- Everyone (online) ---------- */}
      {!solo && (
        <section className="w-full rounded-2xl border border-ink-800 bg-ink-900/85 p-2 shadow-card">
          {board.map(({ player, sim }, i) => (
            <div key={player.id} className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${player.id === me ? "bg-ink-800/60" : ""}`}>
              <span className="w-4 text-xs tabular-nums text-ink-500">{i + 1}</span>
              <PlayerAvatar player={player} size={22} dim={sim.leftAt !== null || !sim.alive} />
              <span className="min-w-0 flex-1 truncate text-sm text-ink-200">{player.id === me ? "You" : player.name}</span>
              {!sim.alive && sim.leftAt === null && t >= 0 && <span className="text-[11px] font-medium text-danger">Crashed</span>}
              {sim.leftAt !== null && <span className="text-[11px] text-ink-500">Left</span>}
              <span className="text-xs tabular-nums text-ink-500">{sim.length} long</span>
              <span className="w-14 text-right text-sm font-semibold tabular-nums text-ink-100">{sim.points.toLocaleString()}</span>
            </div>
          ))}
          {left !== null && left <= 10_000 && t >= 0 && (
            <p className="mt-1 flex items-center justify-center gap-1 text-[11px] font-medium text-warning">
              <Timer className="h-3 w-3" />
              {Math.ceil(left / 1000)}s left
            </p>
          )}
        </section>
      )}
    </div>
  );
}
