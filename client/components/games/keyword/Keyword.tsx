"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { CalendarDays, CornerDownLeft, Delete } from "lucide-react";
import { PlayerAvatar } from "@/components/games/PlayerAvatar";
import { useTicker } from "@/components/games/useTicker";
import { dailyKey, readDaily, writeDaily, type DailyResult } from "@/lib/games/daily";
import {
  MAX_GUESSES,
  WORD_LENGTH,
  WORD_TIME_MS,
  keywordOver,
  keywordState,
  keywordStandings,
  letterMarks,
  marksFor,
  validGuess,
  wordCount,
  type KeywordMode,
  type KeywordPlayer,
  type Mark,
  type Round,
} from "@/lib/games/logic/keyword";
import { sfx } from "@/lib/games/sound";
import { SETTLE_MS, type GameProps, type Player } from "@/lib/games/types";
import { ui } from "@/lib/ui";

const MARK_BG: Record<Mark, string> = { hit: "var(--kw-hit)", near: "var(--kw-near)", miss: "var(--kw-miss)" };
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
// The finished word stays on screen this long before the next one.
const BETWEEN_WORDS_MS = 1900;
const REVEAL_MS = 1300;

function Tile({ letter, mark, state, index }: { letter: string; mark?: Mark; state: "empty" | "typed" | "revealed" | "revealing"; index: number }) {
  const shown = state === "revealed" || state === "revealing";
  return (
    <div
      className={`kw-tile h-[3.25rem] w-[3.25rem] sm:h-14 sm:w-14 ${state === "revealed" ? "kw-revealed" : state === "revealing" ? "kw-revealing" : ""}`}
      style={{ "--delay": `${index * 140}ms` } as CSSProperties}
    >
      <div className={`kw-inner ${state === "typed" ? "kw-pop" : ""}`}>
        <div
          className={`kw-face border-2 bg-ink-900 text-[1.6rem] font-bold uppercase text-ink-100 ${letter ? "border-ink-500" : "border-ink-700"}`}
        >
          {letter}
        </div>
        <div className="kw-face kw-back text-[1.6rem] font-bold uppercase text-white" style={{ background: shown && mark ? MARK_BG[mark] : "var(--kw-miss)" }}>
          {letter}
        </div>
      </div>
    </div>
  );
}

function Board({ round, entry, t, shake, win }: { round: Round; entry: string; t: number; shake: number; win: boolean }) {
  const rows = Array.from({ length: MAX_GUESSES }, (_, r) => r);
  const current = round.done ? -1 : round.guesses.length;
  return (
    <div className="grid gap-1.5">
      {rows.map((r) => {
        const guess = round.guesses[r];
        if (guess) {
          const marks = marksFor(guess, round.answer);
          const revealing = t - (round.times[r] ?? -Infinity) < REVEAL_MS;
          const bouncing = win && r === round.guesses.length - 1;
          return (
            <div key={r} className="flex gap-1.5">
              {[...guess].map((letter, i) => (
                <div key={i} className={bouncing ? "kw-win" : ""} style={{ "--delay": `${720 + i * 90}ms` } as CSSProperties}>
                  <Tile letter={letter} mark={marks[i]} state={revealing ? "revealing" : "revealed"} index={i} />
                </div>
              ))}
            </div>
          );
        }
        const letters = r === current ? entry : "";
        return (
          <div key={r === current ? `entry-${shake}` : r} className={`flex gap-1.5 ${r === current && shake ? "gs-shake" : ""}`}>
            {Array.from({ length: WORD_LENGTH }, (_, i) => (
              <Tile key={`${i}-${letters[i] ?? ""}`} letter={letters[i] ?? ""} state={letters[i] ? "typed" : "empty"} index={i} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Keyboard({ marks, onKey, disabled }: { marks: Map<string, Mark>; onKey: (key: string) => void; disabled: boolean }) {
  return (
    <div className={`w-full max-w-lg select-none space-y-1.5 ${disabled ? "pointer-events-none opacity-60" : ""}`}>
      {ROWS.map((row, r) => (
        <div key={row} className="flex justify-center gap-1 sm:gap-1.5">
          {r === 2 && (
            <button type="button" onClick={() => onKey("Enter")} aria-label="Enter" className="flex h-12 flex-[1.5] items-center justify-center rounded-lg transition-[filter] hover:brightness-110 sm:h-14"
              style={{ background: "var(--kw-key)", color: "var(--kw-key-text)" }}>
              <CornerDownLeft className="h-4 w-4" />
            </button>
          )}
          {[...row].map((key) => {
            const mark = marks.get(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onKey(key)}
                className="h-12 max-w-11 flex-1 rounded-lg text-sm font-semibold uppercase transition-[background-color,color,filter] hover:brightness-110 sm:h-14"
                style={
                  mark === "miss"
                    ? { background: "var(--kw-key-out)", color: "var(--kw-key-out-text)" }
                    : mark
                      ? { background: MARK_BG[mark], color: "#fff" }
                      : { background: "var(--kw-key)", color: "var(--kw-key-text)" }
                }
              >
                {key}
              </button>
            );
          })}
          {r === 2 && (
            <button type="button" onClick={() => onKey("Backspace")} aria-label="Delete letter" className="flex h-12 flex-[1.5] items-center justify-center rounded-lg transition-[filter] hover:brightness-110 sm:h-14"
              style={{ background: "var(--kw-key)", color: "var(--kw-key-text)" }}>
              <Delete className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// Someone else's board: their colors, never their letters.
function MiniBoard({ round }: { round: Round | undefined }) {
  return (
    <div className="grid gap-[3px]">
      {Array.from({ length: MAX_GUESSES }, (_, r) => {
        const guess = round?.guesses[r];
        const marks = guess ? marksFor(guess, round!.answer) : null;
        return (
          <div key={r} className="flex gap-[3px]">
            {Array.from({ length: WORD_LENGTH }, (_, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-[3px] transition-colors duration-500 ${marks ? "" : "border border-ink-700"}`}
                style={marks ? { background: MARK_BG[marks[i]] } : undefined}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Opponent({ player, state, total }: { player: Player; state: KeywordPlayer; total: number }) {
  const round = state.rounds[state.rounds.length - 1];
  const solved = state.rounds.filter((r) => r.solved).length;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-900/85 p-2.5 shadow-xs">
      <MiniBoard round={round} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <PlayerAvatar player={player} size={18} dim={state.left} />
          <span className="truncate text-sm font-medium text-ink-100">{player.name}</span>
        </div>
        <p className="mt-1 text-xs tabular-nums text-ink-400">{state.score.toLocaleString()} pts</p>
        <p className="text-[11px] text-ink-500">
          {state.left ? "Left" : state.finished ? `Done · ${solved}/${total}` : `Word ${state.rounds.length} of ${total}`}
        </p>
      </div>
    </div>
  );
}

export default function Keyword({ match, events, me, mode, now, send, onOver }: GameProps) {
  const kwMode: KeywordMode = mode === "online" ? "online" : match.settings.mode === "endless" ? "endless" : "daily";
  const [day] = useState(() => dailyKey());
  // Today's word, if it was already played on this device before this game.
  const [playedBefore] = useState<DailyResult | null>(() => (kwMode === "daily" ? readDaily(day) : null));
  const [entry, setEntry] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const overRef = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tick = useTicker(true, 8);
  const t = now();
  const players = keywordState(match, events, kwMode, day);
  const mine = me ? players.get(me) : undefined;
  const total = wordCount(match, kwMode);
  const over = t >= 0 && keywordOver(match, players, t, kwMode);

  // The word on screen: the finished one lingers before the next appears.
  const last = mine ? mine.rounds[mine.rounds.length - 1] : undefined;
  const previous = mine && mine.rounds.length > 1 ? mine.rounds[mine.rounds.length - 2] : undefined;
  const lingering = !!previous && last!.guesses.length === 0 && t - last!.startedAt < BETWEEN_WORDS_MS;
  const shown = lingering ? previous : last;
  const wordNumber = mine ? (lingering ? mine.rounds.length - 1 : mine.rounds.length) : 1;
  const canType = !!mine && !mine.finished && !lingering && !playedBefore && t >= 0 && !over;

  // Online, a game that ends on the clock waits a moment for guesses still
  // on their way, so every browser agrees.
  const limit = kwMode === "online" ? total * WORD_TIME_MS : Infinity;
  const settled = over && (kwMode !== "online" || t < limit || t >= limit + SETTLE_MS);
  useEffect(() => {
    if (overRef.current || !settled || playedBefore) return;
    overRef.current = true;
    const standings = keywordStandings(match, players, kwMode);
    if (kwMode === "daily" && mine) {
      const round = mine.rounds[0];
      writeDaily(day, { solved: round.solved, guesses: round.guesses.length, rows: round.guesses });
    }
    // Let the last reveal play before the results cover the board.
    overTimer.current = setTimeout(() => onOver(standings), mode === "online" ? 400 : 1500);
  }, [tick, settled, match, players, kwMode, mine, day, mode, onOver, playedBefore]);

  const say = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 1500);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      if (overTimer.current) clearTimeout(overTimer.current);
    },
    []
  );

  const press = useCallback(
    (key: string) => {
      if (!canType) return;
      if (key === "Enter") {
        if (entry.length < WORD_LENGTH) {
          say("Not enough letters");
          setShake((s) => s + 1);
          sfx.wrong();
          return;
        }
        if (!validGuess(entry)) {
          say("Not in the word list");
          setShake((s) => s + 1);
          sfx.wrong();
          return;
        }
        send("guess", { w: entry });
        if (entry === shown?.answer) setTimeout(() => sfx.correct(), 750);
        else sfx.flip();
        setEntry("");
        return;
      }
      if (key === "Backspace") {
        setEntry((e) => e.slice(0, -1));
        return;
      }
      if (/^[a-z]$/.test(key) && entry.length < WORD_LENGTH) {
        setEntry((e) => e + key);
        sfx.key();
      }
    },
    [canType, entry, say, send, shown?.answer]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === "Enter" || key === "Backspace" || /^[a-z]$/.test(key)) {
        e.preventDefault();
        press(key);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [press]);

  if (playedBefore && kwMode === "daily") {
    const answer = shown?.answer ?? "";
    const done: Round = {
      answer,
      guesses: playedBefore.rows ?? [],
      times: (playedBefore.rows ?? []).map(() => -Infinity),
      solved: playedBefore.solved,
      done: true,
      startedAt: 0,
      doneAt: 0,
    };
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-8 text-center">
        <span className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(135deg, var(--g1), var(--g2))" }}>
          <CalendarDays className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-xl font-semibold text-ink-100">You&apos;ve played today&apos;s word</h2>
        <p className="mt-1 text-sm text-ink-400">
          {playedBefore.solved ? `Solved in ${playedBefore.guesses}.` : `It was ${answer.toUpperCase()}.`} A new word arrives tomorrow.
        </p>
        <div className="mt-6">
          <Board round={done} entry="" t={Infinity} shake={0} win={false} />
        </div>
        <Link href="/games/keyword/solo?mode=endless" className={`${ui.primary} mt-6`}>
          Play endless instead
        </Link>
      </div>
    );
  }

  const myMarks = letterMarks(shown);
  const others = match.players.filter((p) => p.id !== me);
  const justDone = shown?.done && shown.doneAt !== null && t - shown.doneAt < BETWEEN_WORDS_MS + 800;
  const timeLeft = kwMode === "online" ? Math.max(0, total * WORD_TIME_MS - t) : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-5 px-3 py-4 sm:py-6 lg:flex-row lg:items-start lg:justify-center lg:gap-12">
      {kwMode === "online" && others.length > 0 && (
        <aside className="order-first flex w-full gap-2 overflow-x-auto pb-1 lg:order-last lg:w-64 lg:flex-col lg:overflow-visible lg:pt-12">
          <p className="hidden text-xs font-medium uppercase tracking-wider text-ink-500 lg:block">Everyone else</p>
          {others.map((p) => (
            <div key={p.id} className="shrink-0">
              <Opponent player={p} state={players.get(p.id)!} total={total} />
            </div>
          ))}
        </aside>
      )}

      <div className="flex w-full max-w-lg flex-col items-center">
        <div className="mb-4 flex w-full items-center justify-between text-sm">
          <span className="text-ink-400">
            {kwMode === "daily" ? "Today's word" : kwMode === "endless" ? `Word ${wordNumber}` : `Word ${wordNumber} of ${total}`}
          </span>
          <span className="font-semibold tabular-nums text-ink-100">
            {(mine?.score ?? 0).toLocaleString()} <span className="text-xs font-normal text-ink-500">pts</span>
          </span>
          {timeLeft !== null ? (
            <span className="tabular-nums text-ink-400">
              {Math.floor(timeLeft / 60000)}:{String(Math.floor((timeLeft % 60000) / 1000)).padStart(2, "0")}
            </span>
          ) : (
            <span className="text-ink-500">{kwMode === "endless" ? `${(mine?.rounds.filter((r) => r.solved).length ?? 0)} in a row` : ""}</span>
          )}
        </div>

        <div className="relative">
          {shown ? <Board round={shown} entry={canType ? entry : ""} t={t} shake={shake} win={!!shown.solved && !!justDone} /> : null}
          {(notice || (justDone && shown)) && (
            <div className="pointer-events-none absolute inset-x-0 -top-2 flex justify-center">
              <span className="gs-pop-in rounded-lg bg-ink-100 px-3 py-1.5 text-sm font-semibold text-ink-950 shadow-raised">
                {notice ??
                  (shown!.solved
                    ? ["Genius!", "Brilliant!", "Splendid!", "Great!", "Nice!", "Phew!"][Math.min(shown!.guesses.length, 6) - 1]
                    : `The word was ${shown!.answer.toUpperCase()}`)}
              </span>
            </div>
          )}
        </div>

        <div className="mt-6 w-full">
          <Keyboard marks={myMarks} onKey={press} disabled={!canType} />
        </div>
        {!me && <p className="mt-4 text-xs text-ink-500">You&apos;re watching. You&apos;ll play in the next round.</p>}
        {mine?.finished && kwMode === "online" && (
          <p className="mt-4 text-sm text-ink-400">You&apos;re done! Waiting for everyone else…</p>
        )}
      </div>
    </div>
  );
}
