"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Flame } from "lucide-react";
import { PlayerAvatar } from "@/components/games/PlayerAvatar";
import { useTicker } from "@/components/games/useTicker";
import { BIT_VALUES, bitOver, bitStandings, bitState, comboAt, durationMs, targetAt, toHex } from "@/lib/games/logic/bitflip";
import { playerColor } from "@/lib/games/registry";
import { sfx } from "@/lib/games/sound";
import { SETTLE_MS, type GameProps } from "@/lib/games/types";

export default function BitFlip({ match, events, me, mode, now, send, onOver }: GameProps) {
  const hex = match.settings.base === "hex";
  const [bits, setBits] = useState(0);
  const overRef = useRef(false);

  const tick = useTicker(true, 10);
  const t = now();
  const duration = durationMs(match);
  const players = bitState(match, events);
  const mine = me ? players.get(me) : undefined;
  const hits = mine?.hits ?? 0;
  const target = targetAt(match.seed, hits);
  const over = t >= 0 && bitOver(match, players, t);
  const playing = !!mine && t >= 0 && !over;
  const combo = mine ? comboAt(mine.times, Math.max(0, t)) : 0;
  const left = Math.max(0, duration - Math.max(0, t));

  // Online, wait a moment after time's up for hits still on their way, so
  // every browser agrees on the final scores.
  const settled = over && (mode === "solo" || t < duration || t >= duration + SETTLE_MS);
  useEffect(() => {
    if (overRef.current || !settled) return;
    overRef.current = true;
    onOver(bitStandings(match, players));
  }, [tick, settled, match, players, onOver]);

  const toggle = useCallback(
    (index: number) => {
      if (!playing) return;
      const next = bits ^ BIT_VALUES[index];
      if (next === target) {
        send("hit", { n: hits });
        setBits(0);
        sfx.combo(combo + 1);
      } else {
        setBits(next);
        sfx.flip();
      }
    },
    [bits, combo, hits, playing, send, target]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[1-8]$/.test(e.key)) {
        e.preventDefault();
        toggle(Number(e.key) - 1);
      } else if (e.key === "Backspace" || e.key === "Escape" || e.key === "0") {
        e.preventDefault();
        setBits(0);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  const board = [...match.players]
    .map((p) => ({ player: p, state: players.get(p.id)! }))
    .sort((a, b) => b.state.hits - a.state.hits || (a.state.times.at(-1) ?? 0) - (b.state.times.at(-1) ?? 0));
  const most = Math.max(1, ...board.map((row) => row.state.hits));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-3 py-6 sm:px-6 sm:py-10">
      {/* ---------- Score, combo, clock ---------- */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-ink-500">Targets</p>
          <p className="text-3xl font-semibold tabular-nums text-ink-100">{hits}</p>
        </div>
        <div className="h-9">
          {combo >= 2 && (
            <span key={combo} className="gs-pop-in inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, var(--g1), var(--g2))" }}>
              <Flame className="h-4 w-4" />×{combo} combo
            </span>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-ink-500">Time</p>
          <p className={`text-3xl font-semibold tabular-nums ${left <= 10_000 && t >= 0 ? "text-warning" : "text-ink-100"}`}>{Math.ceil(left / 1000)}s</p>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
        <div
          className="h-full origin-left rounded-full transition-transform duration-100 ease-linear"
          style={{ transform: `scaleX(${left / duration})`, background: left <= 10_000 && t >= 0 ? "var(--warning)" : "linear-gradient(90deg, var(--g1), var(--g2))" }}
        />
      </div>

      {/* ---------- The target ---------- */}
      <section className="relative overflow-hidden rounded-2xl border border-ink-800 bg-ink-900/85 px-4 py-8 text-center shadow-card sm:py-10">
        <span key={`ring-${hits}`} className={hits ? "gs-ring absolute left-1/2 top-1/2 -ml-24 -mt-24 h-48 w-48 rounded-full border-2" : "hidden"} style={{ borderColor: "var(--g1)" }} />
        <p className="text-xs font-medium uppercase tracking-wider text-ink-500">Make</p>
        <p key={hits} className="gs-pop-in gs-gradient-text mt-1 text-7xl font-semibold tabular-nums tracking-tight sm:text-8xl">
          {hex ? toHex(target) : target}
        </p>
        <p className="mt-3 font-[family-name:var(--font-mono)] text-sm tabular-nums text-ink-400">
          you have <span className={bits > target ? "text-warning" : "text-ink-200"}>{hex ? toHex(bits) : bits}</span>
          {bits > target && <span className="ml-1.5 text-warning">· too high</span>}
        </p>
      </section>

      {/* ---------- The bits ---------- */}
      <section className="grid grid-cols-8 gap-1.5 sm:gap-3">
        {BIT_VALUES.map((value, i) => {
          const on = (bits & value) !== 0;
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggle(i)}
              disabled={!playing}
              aria-pressed={on}
              aria-label={`Bit worth ${value}`}
              className="group flex flex-col items-center gap-1.5 disabled:cursor-default"
            >
              <span className="text-[11px] font-medium tabular-nums text-ink-500 sm:text-xs">{hex ? `0x${value.toString(16).toUpperCase()}` : value}</span>
              <span
                className={`grid aspect-square w-full place-items-center rounded-xl border text-xl font-semibold tabular-nums transition-[transform,box-shadow,background-color,border-color] duration-150 group-active:scale-95 sm:text-2xl ${
                  on ? "border-transparent text-white" : "border-ink-700 bg-ink-900 text-ink-600 group-hover:border-ink-600"
                }`}
                style={on ? { background: "linear-gradient(135deg, var(--g1), var(--g2))", boxShadow: "0 0 22px color-mix(in srgb, var(--g1) 55%, transparent)" } : undefined}
              >
                {on ? 1 : 0}
              </span>
              <span className="hidden text-[10px] text-ink-600 sm:block">{i + 1}</span>
            </button>
          );
        })}
      </section>
      <p className="hidden text-center text-xs text-ink-500 sm:block">Press 1–8 to flip bits, 0 to clear.</p>

      {/* ---------- Everyone (online) ---------- */}
      {mode === "online" && (
        <section className="rounded-2xl border border-ink-800 bg-ink-900/85 p-3 shadow-card">
          {board.map(({ player, state }) => (
            <div key={player.id} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${player.id === me ? "bg-ink-800/60" : ""}`}>
              <PlayerAvatar player={player} size={22} dim={state.left} />
              <span className="w-24 truncate text-sm text-ink-200 sm:w-32">{player.id === me ? "You" : player.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-800">
                <div
                  className="h-full origin-left rounded-full transition-transform duration-300"
                  style={{ transform: `scaleX(${state.hits / most})`, background: playerColor(player.seat) }}
                />
              </div>
              <span className="w-8 text-right text-sm font-semibold tabular-nums text-ink-100">{state.hits}</span>
            </div>
          ))}
        </section>
      )}
      {!me && <p className="text-center text-xs text-ink-500">You&apos;re watching. You&apos;ll play in the next round.</p>}
    </div>
  );
}
