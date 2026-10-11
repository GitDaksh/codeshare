"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Flag, Keyboard } from "lucide-react";
import { PlayerAvatar } from "@/components/games/PlayerAvatar";
import { useTicker } from "@/components/games/useTicker";
import { KIND_CLASS, charKinds, type TokenKind } from "@/lib/games/highlight";
import { playerColor } from "@/lib/games/registry";
import { sfx } from "@/lib/games/sound";
import {
  FINISH_GRACE_MS,
  accuracy,
  makeCourse,
  raceOver,
  raceStandings,
  raceState,
  timeLimit,
  wpm,
  type Racer,
} from "@/lib/games/logic/racer";
import type { RacerLanguage, RacerLength } from "@/lib/games/content/snippets";
import { SETTLE_MS, type GameProps, type Player } from "@/lib/games/types";

const LANGUAGE_NAMES: Record<string, string> = { javascript: "JavaScript", python: "Python", typescript: "TypeScript" };
// Progress goes out at most this often (and always at the finish).
const SEND_EVERY_MS = 250;

function ordinal(n: number) {
  return `${n}${["th", "st", "nd", "rd"][n % 100 >= 11 && n % 100 <= 13 ? 0 : n % 10] ?? "th"}`;
}

function clock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// One lane of the track: the racer, their car, and their speed or place.
function Lane({ player, racer, total, me, place, t }: { player: Player; racer: Racer; total: number; me: boolean; place: number | null; t: number }) {
  const color = playerColor(player.seat);
  const progress = racer.finishedAt !== null ? 1 : racer.typed / total;
  const speed = racer.finishedAt !== null ? wpm(total, racer.finishedAt) : wpm(racer.typed, t);
  return (
    <div className={`grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_3.75rem] items-center gap-3 rounded-xl px-2 py-1.5 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_4.5rem] ${me ? "bg-ink-800/60" : ""}`}>
      <div className="flex min-w-0 items-center gap-2">
        <PlayerAvatar player={player} size={22} dim={racer.left} />
        <span className={`truncate text-sm ${me ? "font-semibold text-ink-100" : "text-ink-300"}`}>{me ? "You" : player.name}</span>
      </div>
      <div className="relative h-7">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-ink-700" />
        {/* The finish line */}
        <div className="absolute inset-y-0 right-0 w-1.5 bg-[repeating-linear-gradient(0deg,var(--ink-100)_0_4px,var(--ink-700)_4px_8px)] opacity-70" />
        <div
          className="absolute inset-y-0 left-0 w-[calc(100%-2.25rem)] transition-transform duration-200 ease-linear"
          style={{ transform: `translate3d(${progress * 100}%, 0, 0)` }}
        >
          <div className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center">
            <span className="h-1 w-10 -mr-2 rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${color})`, opacity: progress > 0 && racer.finishedAt === null ? 0.55 : 0 }} />
            <span
              className="relative h-4 w-8 rounded-full"
              style={{ background: color, boxShadow: `0 0 14px ${color}, 0 0 2px ${color}` }}
            >
              <span className="absolute right-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white/90" />
            </span>
          </div>
        </div>
      </div>
      <div className="text-right text-xs tabular-nums">
        {place !== null ? (
          <span className="inline-flex items-center gap-1 font-semibold text-ink-100">
            <Flag className="h-3 w-3" style={{ color }} />
            {ordinal(place)}
          </span>
        ) : racer.left ? (
          <span className="text-ink-500">Left</span>
        ) : (
          <span className="text-ink-400">{Math.round(speed)} wpm</span>
        )}
      </div>
    </div>
  );
}

type LineState = "done" | "todo" | number;

// One line of the snippet. Only the line with the cursor changes as you
// type, so the others are skipped when the screen updates.
const CodeLine = memo(function CodeLine({
  number,
  text,
  start,
  kinds,
  state,
  error,
}: {
  number: number;
  text: string;
  start: number;
  kinds: TokenKind[];
  state: LineState;
  error: boolean;
}) {
  const chars = [...text, "\n"];
  return (
    <div className={`flex ${state === "todo" ? "opacity-[0.38]" : ""}`} data-current={typeof state === "number" ? "" : undefined}>
      <span className="w-8 shrink-0 select-none pr-3 text-right text-ink-600">{number}</span>
      <span className="min-w-0 whitespace-pre">
        {chars.map((char, i) => {
          const kind = kinds[start + i] ?? "text";
          const newline = char === "\n";
          if (typeof state !== "number") {
            return newline ? null : (
              <span key={i} className={KIND_CLASS[kind]}>
                {char}
              </span>
            );
          }
          if (i < state) {
            return newline ? null : (
              <span key={i} className={KIND_CLASS[kind]}>
                {char}
              </span>
            );
          }
          if (i === state) {
            return (
              <span
                key={i}
                className={`relative rounded-[3px] ${error ? "bg-danger-soft text-danger" : `${KIND_CLASS[kind]}`}`}
                style={error ? undefined : { background: "color-mix(in srgb, var(--g1) 26%, transparent)" }}
              >
                {newline ? <span className="text-ink-500">↵</span> : char}
                <span className="gs-pulse-soft absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full" style={{ background: error ? "var(--danger)" : "var(--g1)" }} />
              </span>
            );
          }
          return newline ? (
            <span key={i} className="text-ink-700">
              ↵
            </span>
          ) : (
            <span key={i} className={`${KIND_CLASS[kind]} opacity-[0.38]`}>
              {char}
            </span>
          );
        })}
      </span>
    </div>
  );
});

export default function CodeRacer({ match, events, me, mode, now, send, onOver }: GameProps) {
  const language = (match.settings.language as RacerLanguage) ?? "javascript";
  const length = (match.settings.length as RacerLength) ?? "medium";
  const course = useMemo(() => makeCourse(match.seed, language, length), [match.seed, language, length]);
  const kinds = useMemo(() => charKinds(course.code, course.language), [course]);
  const total = course.stops.length;
  const playing = !!me && match.players.some((p) => p.id === me);

  const [typed, setTyped] = useState(0);
  const [errors, setErrors] = useState(0);
  const [errorAt, setErrorAt] = useState(-1);
  const [focused, setFocused] = useState(false);
  const typedRef = useRef(0);
  const errorsRef = useRef(0);
  const sentRef = useRef({ i: 0, at: 0 });
  const trailingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overRef = useRef(false);
  const overNowRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);

  // Redraws a dozen times a second, so the computer racers drive on and the
  // clocks count.
  const tick = useTicker(true, 12);
  const t = now();
  const started = t >= 0;

  const racers = raceState(course, match, events, Math.max(0, t));
  // Your own car moves on every key, not only when your progress is sent.
  const mine = me ? racers.get(me) : undefined;
  if (mine && mine.finishedAt === null) {
    mine.typed = Math.max(mine.typed, typed);
    mine.errors = Math.max(mine.errors, errors);
  }
  const places = new Map(
    [...racers.entries()]
      .filter(([, r]) => r.finishedAt !== null)
      .sort((a, b) => a[1].finishedAt! - b[1].finishedAt!)
      .map(([id], i) => [id, i + 1])
  );

  // The race ends when everyone's done, or the clock runs out (online, after
  // a moment for moves still on their way, so every browser agrees). The
  // standings come from the moves alone (not from keys pressed here but not
  // sent yet), the same in every browser.
  const over = started && raceOver(course, match, racers, t, mode === "solo");
  const firstFinish = Math.min(...[...racers.values()].map((r) => r.finishedAt ?? Infinity));
  const endsAt = Math.min(timeLimit(course), mode === "online" && Number.isFinite(firstFinish) ? firstFinish + FINISH_GRACE_MS : Infinity);
  const everyoneDone = match.players.every((p) => p.bot || racers.get(p.id)!.finishedAt !== null || racers.get(p.id)!.left);
  const settled = over && (mode === "solo" || everyoneDone || t >= endsAt + SETTLE_MS);
  useEffect(() => {
    overNowRef.current = over;
  }, [over]);
  useEffect(() => {
    if (overRef.current || !settled) return;
    overRef.current = true;
    onOver(raceStandings(course, match, raceState(course, match, events, Math.max(0, now()))));
  }, [tick, settled, course, match, events, now, onOver]);

  const flush = useCallback(() => {
    trailingRef.current = null;
    const i = typedRef.current;
    if (i === sentRef.current.i) return;
    sentRef.current = { i, at: Date.now() };
    send("progress", { i, e: errorsRef.current });
  }, [send]);

  const report = useCallback(() => {
    if (typedRef.current >= total) {
      if (trailingRef.current) clearTimeout(trailingRef.current);
      flush();
      return;
    }
    const wait = SEND_EVERY_MS - (Date.now() - sentRef.current.at);
    if (wait <= 0) flush();
    else if (!trailingRef.current) trailingRef.current = setTimeout(flush, wait);
  }, [flush, total]);

  useEffect(() => () => {
    if (trailingRef.current) clearTimeout(trailingRef.current);
  }, []);

  const press = useCallback(
    (char: string) => {
      if (!playing || now() < 0 || typedRef.current >= total || overNowRef.current) return;
      const expected = course.code[course.stops[typedRef.current]];
      if (char === expected) {
        typedRef.current += 1;
        setTyped(typedRef.current);
        setErrorAt(-1);
        sfx.key();
        report();
      } else {
        errorsRef.current += 1;
        setErrors(errorsRef.current);
        setErrorAt(typedRef.current);
        sfx.error();
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          cardRef.current?.animate(
            [{ transform: "translate3d(0, 0, 0)" }, { transform: "translate3d(-4px, 0, 0)" }, { transform: "translate3d(4px, 0, 0)" }, { transform: "translate3d(-2px, 0, 0)" }, { transform: "translate3d(0, 0, 0)" }],
            { duration: 260, easing: "ease-out" }
          );
        }
      }
    },
    [course, now, playing, report, total]
  );

  // Keep the line you're on in view.
  const cursor = typed >= total ? course.code.length : course.stops[typed];
  const lines = useMemo(() => {
    const result: { text: string; start: number }[] = [];
    let start = 0;
    for (const text of course.code.split("\n")) {
      result.push({ text, start });
      start += text.length + 1;
    }
    return result;
  }, [course]);
  const currentLine = lines.findIndex((l) => cursor >= l.start && cursor <= l.start + l.text.length);

  useEffect(() => {
    const el = codeRef.current?.querySelector("[data-current]");
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentLine]);

  useEffect(() => {
    if (playing) inputRef.current?.focus({ preventScroll: true });
  }, [playing]);

  const myTime = mine?.finishedAt ?? Math.max(0, t);
  const mySpeed = mine ? (mine.finishedAt !== null ? wpm(total, mine.finishedAt) : wpm(mine.typed, Math.max(1, t))) : 0;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-3 py-5 sm:px-6 sm:py-8" onClick={() => inputRef.current?.focus({ preventScroll: true })}>
      {/* ---------- The track ---------- */}
      <section className="gs-rise rounded-2xl border border-ink-800 bg-ink-900/85 p-2 shadow-card sm:p-3">
        {match.players.map((player) => (
          <Lane
            key={player.id}
            player={player}
            racer={racers.get(player.id)!}
            total={total}
            me={player.id === me}
            place={places.get(player.id) ?? null}
            t={Math.max(1, t)}
          />
        ))}
      </section>

      {/* ---------- The code ---------- */}
      <section
        ref={cardRef}
        className={`gs-rise relative overflow-hidden rounded-2xl border bg-ink-900 shadow-card transition-colors ${focused || !playing ? "border-ink-800" : "border-ink-700"}`}
        style={{ animationDelay: "60ms" }}
      >
        <div className="flex items-center justify-between border-b border-ink-800 px-4 py-2.5">
          <span className="text-sm font-medium text-ink-200">{course.snippet.title}</span>
          <span className="rounded-md border border-ink-800 bg-ink-950 px-1.5 py-0.5 text-[11px] font-medium text-ink-400">{LANGUAGE_NAMES[course.language]}</span>
        </div>
        <div ref={codeRef} className="gs-code max-h-[46vh] overflow-y-auto px-2 py-4 font-[family-name:var(--font-mono)] text-[13px] leading-7 sm:px-4 sm:text-[15px]">
          {lines.map((line, n) => (
            <CodeLine
              key={n}
              number={n + 1}
              text={line.text}
              start={line.start}
              kinds={kinds}
              state={n < currentLine || currentLine === -1 ? "done" : n > currentLine ? "todo" : cursor - line.start}
              error={n === currentLine && errorAt === typed}
            />
          ))}
        </div>

        {playing && (
          <textarea
            ref={inputRef}
            aria-label="Type the code here"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            className="absolute left-0 top-0 h-px w-px resize-none opacity-0"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                press("\n");
              } else if (e.key === "Tab") {
                e.preventDefault();
              } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                press(e.key);
              }
            }}
            onInput={(e) => {
              // Phone keyboards send text here instead of key presses.
              const value = e.currentTarget.value;
              e.currentTarget.value = "";
              for (const char of value) press(char === "\r" ? "\n" : char);
            }}
          />
        )}

        {playing && started && !focused && mine?.finishedAt === null && (
          <button
            type="button"
            onClick={() => inputRef.current?.focus({ preventScroll: true })}
            className="absolute inset-0 grid place-items-center bg-ink-950/60 text-sm font-medium text-ink-100"
          >
            <span className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 shadow-raised">
              <Keyboard className="h-4 w-4" />
              Click here to keep typing
            </span>
          </button>
        )}

        {mine && mine.finishedAt !== null && mode === "online" && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 border-t border-ink-800 bg-ink-900/95 px-4 py-3 text-sm text-ink-300">
            <Flag className="h-4 w-4" style={{ color: "var(--g1)" }} />
            You finished {ordinal(places.get(me!) ?? 1)} at {Math.round(mySpeed)} WPM. Waiting for the others… {clock(endsAt - t)}
          </div>
        )}
      </section>

      {/* ---------- Your numbers ---------- */}
      <section className="grid grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: "Speed", value: playing ? `${Math.round(mySpeed)}` : "–", unit: "wpm" },
          { label: "Accuracy", value: playing && mine ? `${accuracy(mine)}` : "–", unit: "%" },
          { label: "Time", value: (myTime / 1000).toFixed(1), unit: "s" },
          { label: "Progress", value: playing && mine ? `${Math.floor(((mine.finishedAt !== null ? total : mine.typed) / total) * 100)}` : "–", unit: "%" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-ink-800 bg-ink-900/85 px-3 py-2.5 shadow-xs sm:px-4">
            <p className="text-[11px] font-medium text-ink-500">{stat.label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink-100 sm:text-xl">
              {stat.value}
              {stat.unit && <span className="ml-0.5 text-xs font-normal text-ink-500">{stat.unit}</span>}
            </p>
          </div>
        ))}
      </section>
      {!playing && <p className="text-center text-xs text-ink-500">You&apos;re watching this race. You&apos;ll be in the next one.</p>}
      {playing && !started && <p className="text-center text-xs text-ink-500">Get ready: type the code exactly, and press Enter at the end of each line.</p>}
    </div>
  );
}
