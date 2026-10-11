"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, Clock, Flame, X } from "lucide-react";
import { PlayerAvatar } from "@/components/games/PlayerAvatar";
import { useTicker } from "@/components/games/useTicker";
import { quizStandings, quizState, type QuizRound, type QuizTiming } from "@/lib/games/logic/quiz";
import { sfx } from "@/lib/games/sound";
import type { GameProps, Player } from "@/lib/games/types";

export type QuizContext = {
  round: number;
  phase: "question" | "reveal" | "over";
  // Your answer this round (null: none yet).
  mine: number | null;
  // Whether you can still answer.
  open: boolean;
  answer: (choice: number) => void;
  // After the round closes: who picked what.
  picks: Map<number, Player[]>;
};

// The frame every quiz game shares: the round counter and clock, who has
// answered, the reveal with points and the explanation, and (online) the
// live scoreboard. Each game draws its own question and choices.
export function QuizFrame({
  game,
  timing,
  rounds,
  isCorrect,
  prompt,
  explain,
  children,
}: {
  game: GameProps;
  timing: QuizTiming;
  rounds: number;
  isCorrect: (round: number, choice: number) => boolean;
  prompt: (round: number) => ReactNode;
  explain: (round: number) => ReactNode;
  children: (ctx: QuizContext) => ReactNode;
}) {
  const { match, events, me, mode, now, send, onOver } = game;
  const overRef = useRef(false);
  const cueRef = useRef("");

  const tick = useTicker(true, 10);
  const t = Math.max(0, now());
  const state = quizState(match, events, t, timing, rounds, isCorrect);
  const round: QuizRound = state.rounds[state.current];
  const mineAnswer = me ? round.answers.get(me) : undefined;
  const playing = !!me && match.players.some((p) => p.id === me);
  const open = playing && state.phase === "question" && !mineAnswer && now() >= 0;
  const remaining = state.phaseEndsAt === null ? 0 : Math.max(0, state.phaseEndsAt - t);
  const myStats = me ? state.players.get(me) : undefined;

  // Sounds: the last seconds tick, and the reveal says right or wrong.
  const { phase, current } = state;
  const rightNow = !!mineAnswer?.correct;
  useEffect(() => {
    let cue = "";
    if (phase === "question" && remaining <= 3000 && remaining > 0) cue = `tick-${current}-${Math.ceil(remaining / 1000)}`;
    if (phase === "reveal") cue = `reveal-${current}`;
    if (!cue || cue === cueRef.current) return;
    cueRef.current = cue;
    if (cue.startsWith("tick")) sfx.tick();
    else if (playing) {
      if (rightNow) sfx.correct();
      else sfx.wrong();
    }
  }, [tick, phase, current, remaining, playing, rightNow]);

  useEffect(() => {
    if (overRef.current || state.phase !== "over") return;
    overRef.current = true;
    onOver(quizStandings(match, state, rounds));
  }, [state, match, rounds, onOver]);

  const picks = new Map<number, Player[]>();
  if (state.phase !== "question") {
    for (const p of match.players) {
      const a = round.answers.get(p.id);
      if (a) picks.set(a.choice, [...(picks.get(a.choice) ?? []), p]);
    }
  }

  const ctx: QuizContext = {
    round: state.current,
    phase: state.phase,
    mine: mineAnswer?.choice ?? null,
    open,
    answer: (choice) => {
      if (!open) return;
      send("answer", { r: state.current, a: choice });
      sfx.pop();
    },
    picks,
  };

  const board = [...match.players].sort((a, b) => state.players.get(b.id)!.score - state.players.get(a.id)!.score);
  const fraction = state.phase === "question" ? remaining / timing.questionMs : 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-5 sm:px-6 sm:py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-6">
      <div className="min-w-0">
        {/* ---------- Round, clock, score ---------- */}
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-ink-300">
            Question <span className="tabular-nums text-ink-100">{state.current + 1}</span>
            <span className="text-ink-500"> of {rounds}</span>
          </span>
          <span className="flex items-center gap-3">
            {(myStats?.streak ?? 0) >= 2 && (
              <span key={myStats!.streak} className="gs-pop-in inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-white" style={{ background: "linear-gradient(135deg, var(--g1), var(--g2))" }}>
                <Flame className="h-3 w-3" />
                {myStats!.streak} in a row
              </span>
            )}
            <span className="font-semibold tabular-nums text-ink-100">
              {(myStats?.score ?? 0).toLocaleString()} <span className="text-xs font-normal text-ink-500">pts</span>
            </span>
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Clock className={`h-3.5 w-3.5 ${state.phase === "question" && remaining <= 5000 ? "text-warning" : "text-ink-500"}`} />
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full origin-left rounded-full transition-transform duration-100 ease-linear"
              style={{
                transform: `scaleX(${fraction})`,
                background: remaining <= 5000 ? "var(--warning)" : "linear-gradient(90deg, var(--g1), var(--g2))",
              }}
            />
          </div>
          <span className="w-8 text-right text-xs tabular-nums text-ink-400">{state.phase === "question" ? Math.ceil(remaining / 1000) : ""}</span>
        </div>

        {mode === "online" && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Who has answered">
            {match.players.map((p) => (
              <span key={p.id} className="relative" title={round.answers.has(p.id) ? `${p.name} answered` : `${p.name} is thinking`}>
                <PlayerAvatar player={p} size={22} dim={!round.answers.has(p.id)} />
                {round.answers.has(p.id) && (
                  <span className="absolute -bottom-0.5 -right-0.5 grid h-3 w-3 place-items-center rounded-full bg-success-strong text-white ring-2 ring-ink-950">
                    <Check className="h-2 w-2" strokeWidth={4} />
                  </span>
                )}
              </span>
            ))}
          </div>
        )}

        <h2 key={`prompt-${state.current}`} className="gs-rise mt-5 text-lg font-semibold tracking-tight text-ink-100 sm:text-xl">
          {prompt(state.current)}
        </h2>

        <div key={`body-${state.current}`} className="gs-rise mt-4" style={{ animationDelay: "60ms" }}>
          {children(ctx)}
        </div>

        {/* ---------- The reveal ---------- */}
        {state.phase !== "question" && (
          <div className="gs-rise mt-4 rounded-xl border border-ink-800 bg-ink-900/90 p-4 shadow-card">
            {playing && (
              <p className={`flex items-center gap-2 text-sm font-semibold ${mineAnswer?.correct ? "text-success" : "text-danger"}`}>
                {mineAnswer?.correct ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                {mineAnswer?.correct ? (
                  <>
                    Correct!
                    <span className="gs-pop-in ml-1 rounded-md bg-success-soft px-1.5 py-0.5 tabular-nums text-success">+{mineAnswer.points}</span>
                  </>
                ) : mineAnswer ? (
                  "Not quite"
                ) : (
                  "Time's up"
                )}
              </p>
            )}
            <div className={`text-sm leading-relaxed text-ink-300 ${playing ? "mt-2" : ""}`}>{explain(state.current)}</div>
          </div>
        )}
        {!playing && <p className="mt-4 text-center text-xs text-ink-500">You&apos;re watching. You&apos;ll play in the next round.</p>}
      </div>

      {/* ---------- Scoreboard (online) ---------- */}
      {mode === "online" && (
        <aside className="mt-6 lg:mt-0">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-500">Scores</p>
          <ol className="space-y-1.5">
            {board.map((p, i) => {
              const player = state.players.get(p.id)!;
              return (
                <motion.li
                  key={p.id}
                  layout
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  className={`flex items-center gap-2.5 rounded-xl border border-ink-800 bg-ink-900/85 px-3 py-2 shadow-xs ${p.id === me ? "ring-1 ring-ink-600" : ""}`}
                >
                  <span className="w-4 text-xs tabular-nums text-ink-500">{i + 1}</span>
                  <PlayerAvatar player={p} size={22} dim={player.left} />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-200">{p.id === me ? "You" : p.name}</span>
                  <span className="text-sm font-semibold tabular-nums text-ink-100">{player.score.toLocaleString()}</span>
                </motion.li>
              );
            })}
          </ol>
        </aside>
      )}
    </div>
  );
}

// The avatars of everyone who picked a choice (shown after the round closes).
export function Pickers({ players }: { players: Player[] | undefined }) {
  if (!players?.length) return null;
  return (
    <span className="flex -space-x-1">
      {players.slice(0, 4).map((p) => (
        <PlayerAvatar key={p.id} player={p} size={18} className="ring-2 ring-ink-900" />
      ))}
      {players.length > 4 && <span className="pl-2 text-[11px] text-ink-500">+{players.length - 4}</span>}
    </span>
  );
}
