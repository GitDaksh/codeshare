"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, RotateCcw, Settings2, SmilePlus, WifiOff, XCircle } from "lucide-react";
import { Confetti } from "@/components/games/Confetti";
import { Countdown } from "@/components/games/Countdown";
import { GameStage } from "@/components/games/GameStage";
import { Lobby } from "@/components/games/Lobby";
import { PlayerAvatar } from "@/components/games/PlayerAvatar";
import { FloatingReactions, ReactionBar } from "@/components/games/Reactions";
import { Results, ranked } from "@/components/games/Results";
import { GAME_COMPONENTS } from "@/components/games/gameComponents";
import { PLAYER_COLORS, gameById } from "@/lib/games/registry";
import { sfx } from "@/lib/games/sound";
import { useLobby, type LobbyError } from "@/lib/games/useLobby";
import type { Standing } from "@/lib/games/types";
import { ui } from "@/lib/ui";
import "./games.css";

const ERRORS: Record<LobbyError, { title: string; text: string }> = {
  "not-found": { title: "This game isn't here", text: "The code may be mistyped, or the game ended and everyone left." },
  full: { title: "This game is full", text: "Every seat is taken. Ask the host for a new game, or start your own." },
  removed: { title: "You were removed", text: "The host removed you from this game." },
  left: { title: "You left this game", text: "You left it in another tab or window. Join again with the code to get back in." },
  "slow-down": { title: "Slow down a moment", text: "Too many tries in a row. Wait a few seconds and refresh." },
  connection: { title: "Can't connect", text: "Check your connection and refresh the page." },
};

function CodeBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          ?.writeText(`${window.location.origin}/games/play/${code}`)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => {});
      }}
      title="Copy the invite link"
      className={`${ui.badge} hidden cursor-pointer gap-1.5 font-[family-name:var(--font-mono)] transition-colors hover:border-ink-700 hover:text-ink-100 sm:inline-flex`}
    >
      {code}
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// A lobby and its matches, full screen: the lobby until the host starts,
// then the game (everyone's moves arriving live), then the results.
export function OnlineGame({ code }: { code: string }) {
  const router = useRouter();
  const live = useLobby(code);
  const { lobby, match, me } = live;
  const game = lobby ? gameById(lobby.game) : undefined;
  const [over, setOver] = useState<{ matchId: string; standings: Standing[] } | null>(null);
  const [confetti, setConfetti] = useState(0);
  const [picker, setPicker] = useState(false);
  const reportedRef = useRef<string | null>(null);

  const playing = !!lobby && lobby.status !== "lobby" && !!match && lobby.match?.id === match.id;
  const inMatch = !!match && !!me && match.players.some((p) => p.id === me);
  const myOver = playing && over?.matchId === match?.id ? over : null;
  const record = live.recorded && live.recorded.matchId === match?.id ? live.recorded : null;
  const host = lobby?.members.find((m) => m.id === lobby.hostId);

  const handleOver = useCallback(
    (standings: Standing[]) => {
      const matchId = match?.id;
      if (!matchId || reportedRef.current === matchId) return;
      reportedRef.current = matchId;
      setOver({ matchId, standings });
      live.done(standings);
      if (!inMatch || !game || !me) return;
      const rows = ranked(standings);
      const mine = rows.find((r) => r.id === me);
      const won = !!mine && mine.rank === 1 && rows.filter((r) => r.rank === 1).length === 1;
      if (won) {
        sfx.win();
        setConfetti((c) => c + 1);
      } else sfx.lose();
      // The server saves everyone's result itself once the match is over
      // (and says if it's a new personal best: live.recorded).
    },
    [game, inMatch, live, match?.id, me]
  );

  const leave = useCallback(() => {
    live.leave();
    router.push("/games");
  }, [live, router]);

  const colors = useMemo(() => (game ? [...game.colors, ...PLAYER_COLORS] : PLAYER_COLORS), [game]);

  if (live.error) {
    const message = ERRORS[live.error];
    return (
      <main className="grid h-dvh place-items-center bg-ink-950 px-4">
        <div className="gs-rise max-w-sm text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-ink-700 bg-ink-900 text-ink-300">
            <XCircle className="h-5 w-5" />
          </span>
          <h1 className="mt-4 text-lg font-semibold text-ink-100">{message.title}</h1>
          <p className="mt-1.5 text-sm text-ink-400">{message.text}</p>
          <Link href="/games" className={`${ui.primary} mt-5`}>
            Back to Games
          </Link>
        </div>
      </main>
    );
  }

  if (!lobby || !game) {
    return (
      <main className="grid h-dvh place-items-center bg-ink-950">
        <div className="flex items-center gap-2 text-sm text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Joining game {code}…
        </div>
      </main>
    );
  }

  const Game = GAME_COMPONENTS[game.id];
  const online = lobby.members.filter((m) => m.online);
  const canRestart = lobby.status === "finished";

  return (
    <GameStage
      game={game}
      onExit={leave}
      exitLabel="Leave"
      badge={<CodeBadge code={lobby.code} />}
      right={
        <>
          <div className="hidden items-center -space-x-1.5 md:flex">
            {online.slice(0, 5).map((m) => (
              <PlayerAvatar key={m.id} player={{ ...m, bot: false }} size={24} className="ring-2 ring-ink-950" />
            ))}
            {online.length > 5 && <span className="pl-3 text-xs text-ink-500">+{online.length - 5}</span>}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setPicker((p) => !p)}
              aria-label="Send a reaction"
              aria-expanded={picker}
              className={ui.icon}
            >
              <SmilePlus className="h-4 w-4" />
            </button>
            {picker && (
              <div className="absolute right-0 top-full z-50 mt-2">
                <ReactionBar onReact={(emoji) => live.react(emoji)} />
              </div>
            )}
          </div>
        </>
      }
      overlay={
        <>
          {playing && match && <Countdown key={match.id} now={live.now} />}
          {playing && match && myOver && (
            <Results
              game={game}
              standings={myOver.standings}
              players={match.players}
              me={me}
              record={record}
              actions={
                live.isHost ? (
                  <>
                    <button type="button" onClick={() => live.backToLobby()} disabled={!canRestart} className={`${ui.secondary} h-10`}>
                      <Settings2 className="h-4 w-4" />
                      Change settings
                    </button>
                    <button type="button" onClick={() => void live.start()} disabled={!canRestart} className={`${ui.primary} h-10`}>
                      {canRestart ? <RotateCcw className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                      Play again
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={leave} className={`${ui.secondary} h-10`}>
                    Leave game
                  </button>
                )
              }
              note={
                live.isHost ? (
                  canRestart ? (
                    "Everyone's done. Play again with the same players, or change the settings first."
                  ) : (
                    <>
                      Waiting for everyone&apos;s game to finish…{" "}
                      <button type="button" onClick={() => live.endMatch()} className="font-medium text-ink-300 underline-offset-2 hover:text-ink-100 hover:underline">
                        Don&apos;t wait
                      </button>
                    </>
                  )
                ) : (
                  `Waiting for ${host?.name ?? "the host"} to start the next round…`
                )
              }
            />
          )}
          <Confetti colors={colors} fire={confetti} />
          <FloatingReactions reactions={live.reactions} players={lobby.members.map((m) => ({ ...m, bot: false }))} />
          {!live.connected && (
            <div className="absolute inset-x-0 top-3 z-50 flex justify-center">
              <span className="flex items-center gap-2 rounded-lg border border-warning-line bg-ink-900 px-3 py-1.5 text-xs font-medium text-warning shadow-raised">
                <WifiOff className="h-3.5 w-3.5" />
                Reconnecting…
              </span>
            </div>
          )}
        </>
      }
    >
      {playing && match ? (
        <Game
          key={match.id}
          match={match}
          events={live.events}
          me={inMatch ? me : null}
          mode="online"
          now={live.now}
          send={live.send}
          sendAs={live.sendAs}
          onOver={handleOver}
        />
      ) : (
        <Lobby
          game={game}
          lobby={lobby}
          me={me}
          isHost={live.isHost}
          onStart={live.start}
          onSettings={(settings) => void live.changeSettings(settings)}
          onKick={live.kick}
        />
      )}
    </GameStage>
  );
}
