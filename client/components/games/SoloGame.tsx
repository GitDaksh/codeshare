"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { RotateCcw } from "lucide-react";
import { useApi } from "@/lib/api";
import { Confetti } from "@/components/games/Confetti";
import { Countdown } from "@/components/games/Countdown";
import { GameStage } from "@/components/games/GameStage";
import { Results, ranked } from "@/components/games/Results";
import { GAME_COMPONENTS } from "@/components/games/gameComponents";
import { PLAYER_COLORS, type GameDef } from "@/lib/games/registry";
import { SOLO_ID, soloPlayers } from "@/lib/games/players";
import { sfx } from "@/lib/games/sound";
import { recordResult, type RecordedResult } from "@/lib/games/stats";
import { useMe } from "@/lib/games/useMe";
import { useSoloMatch } from "@/lib/games/useSoloMatch";
import type { Settings, Standing } from "@/lib/games/types";
import { ui } from "@/lib/ui";

// A game played alone (or against the computer), full screen.
export function SoloGame({ game, settings }: { game: GameDef; settings: Settings }) {
  const router = useRouter();
  const api = useApi();
  const { isSignedIn } = useAuth();
  const me = useMe();
  const players = useMemo(() => soloPlayers(game.id, settings, me), [game.id, settings, me]);
  const solo = useSoloMatch(settings, players);
  const [over, setOver] = useState<Standing[] | null>(null);
  const [record, setRecord] = useState<RecordedResult | null>(null);
  const [confetti, setConfetti] = useState(0);
  const reportedRef = useRef<string | null>(null);
  const Game = GAME_COMPONENTS[game.id];

  const handleOver = useCallback(
    (standings: Standing[]) => {
      if (reportedRef.current === solo.match.id) return;
      reportedRef.current = solo.match.id;
      setOver(standings);
      const rows = ranked(standings);
      const mine = rows.find((r) => r.id === SOLO_ID);
      const alone = solo.match.players.length === 1;
      const won = mine?.won ?? (!alone && mine?.rank === 1 && rows.filter((r) => r.rank === 1).length === 1);
      if (won) {
        sfx.win();
        setConfetti((c) => c + 1);
      } else if (!alone) sfx.lose();
      if (mine && mine.stat !== undefined) {
        void recordResult(api, !!isSignedIn, game.id, mine.stat, !!won).then(setRecord);
      }
    },
    [api, game.id, isSignedIn, solo.match.id, solo.match.players.length]
  );

  const again = useCallback(() => {
    solo.restart();
    setOver(null);
    setRecord(null);
  }, [solo]);

  const exit = useCallback(() => router.push(`/games/${game.id}`), [router, game.id]);

  // Enter plays again from the results.
  useEffect(() => {
    if (!over) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        again();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [over, again]);

  const colors = useMemo(() => [...game.colors, ...PLAYER_COLORS], [game.colors]);

  return (
    <GameStage
      game={game}
      onExit={exit}
      exitLabel="Back"
      badge={<span className={ui.badge}>Solo</span>}
      overlay={
        <>
          <Countdown key={solo.match.id} now={solo.now} />
          {over && (
            <Results
              game={game}
              standings={over}
              players={solo.match.players}
              me={SOLO_ID}
              record={record}
              actions={
                <>
                  <button type="button" onClick={exit} className={`${ui.secondary} h-10`}>
                    Back to {game.title}
                  </button>
                  <button type="button" onClick={again} className={`${ui.primary} h-10`}>
                    <RotateCcw className="h-4 w-4" />
                    Play again
                  </button>
                </>
              }
              note={
                <>
                  Press <kbd className="rounded border border-ink-700 px-1 font-[family-name:var(--font-mono)] text-[10px]">Enter</kbd> to play again
                  {!isSignedIn && " · Sign in to save your bests to the leaderboard"}
                </>
              }
            />
          )}
          <Confetti colors={colors} fire={confetti} />
        </>
      }
    >
      <Game
        key={solo.match.id}
        match={solo.match}
        events={solo.events}
        me={SOLO_ID}
        mode="solo"
        now={solo.now}
        send={solo.send}
        sendAs={solo.sendAs}
        onOver={handleOver}
      />
    </GameStage>
  );
}
