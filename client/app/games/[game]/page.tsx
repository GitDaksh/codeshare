"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Gamepad2, Loader2, Play, Users } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/PageHeader";
import { GameArt } from "@/components/games/GameArt";
import { GameIconTile } from "@/components/games/GameStage";
import { Leaderboard } from "@/components/games/Leaderboard";
import { SettingsPicker } from "@/components/games/SettingsPicker";
import { gameById, normalizeSettings, settingsFor } from "@/lib/games/registry";
import { useSavedSettings } from "@/lib/games/lastSettings";
import { useCreateLobby } from "@/lib/games/useCreateLobby";
import { useGameStats } from "@/lib/games/stats";
import type { Settings } from "@/lib/games/types";
import { ui } from "@/lib/ui";

// One game's page: what it is, its settings, play solo or with friends, and
// its leaderboard.
export default function GamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game: id } = use(params);
  const game = gameById(id);
  const router = useRouter();
  const { stats } = useGameStats();
  const { create, creating } = useCreateLobby();
  // Your last choices for this game, remembered on this device.
  const [saved, setSaved] = useSavedSettings(game?.id ?? "code-racer");
  const settings: Settings = game ? normalizeSettings(game, "solo", saved) : {};

  useEffect(() => {
    document.title = game ? `${game.title} — Games — CodeShare` : "Game not found — CodeShare";
  }, [game]);

  if (!game) {
    return (
      <PageContainer>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-ink-700 bg-ink-900">
            <Gamepad2 className="h-5 w-5 text-ink-300" />
          </span>
          <p className="font-semibold text-ink-100">Game not found</p>
          <Link href="/games" className={ui.secondary}>
            All games
          </Link>
        </div>
      </PageContainer>
    );
  }

  const stat = stats?.[game.id];

  function playSolo() {
    if (!game) return;
    const query = new URLSearchParams(Object.entries(settings).map(([k, v]) => [k, String(v)])).toString();
    router.push(`/games/${game.id}/solo${query ? `?${query}` : ""}`);
  }

  function playFriends() {
    if (!game) return;
    void create(game.id, normalizeSettings(game, "online", settings));
  }

  return (
    <PageContainer>
      <PageHeader
        back={{ href: "/games", label: "Games" }}
        title={
          <span className="flex items-center gap-3">
            <GameIconTile game={game} size={34} />
            {game.title}
          </span>
        }
        description={game.description}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-6">
        <div className="gs-rise relative h-60 overflow-hidden rounded-2xl border border-ink-800 shadow-card sm:h-72 lg:h-auto lg:min-h-80">
          <GameArt game={game} />
        </div>

        <section className={`${ui.card} gs-rise flex flex-col p-5 sm:p-6`} style={{ animationDelay: "60ms" }}>
          <div className="flex flex-wrap gap-1.5">
            <span className={ui.badge}>
              <Users className="h-3 w-3" />
              Solo · {game.players.max === 2 ? "2 players" : `${game.players.min}–${game.players.max} players`}
            </span>
            <span className={ui.badge}>
              <Clock className="h-3 w-3" />
              {game.minutes}
            </span>
            {game.tags.map((tag) => (
              <span key={tag} className={ui.badge}>
                {tag}
              </span>
            ))}
          </div>

          {settingsFor(game, "solo").length > 0 && (
            <div className="mt-5">
              <SettingsPicker id={`game-${game.id}`} defs={settingsFor(game, "solo")} value={settings} onChange={(next) => setSaved({ ...saved, ...next } as Settings)} />
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row lg:mt-auto lg:pt-6">
            <button type="button" onClick={playSolo} className={`${ui.primary} h-11 flex-1 text-[15px]`}>
              <Play className="h-4 w-4" />
              Play solo
            </button>
            <button type="button" onClick={playFriends} disabled={creating === game.id} className={`${ui.secondary} h-11 flex-1 text-[15px]`}>
              {creating === game.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              Play with friends
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-ink-500 sm:text-left">
            With friends, you get a link and a code to share. They join from any device.
          </p>

          {stat && stat.plays > 0 && (
            <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-ink-800 pt-5">
              {[
                { label: game.rankBy === "wins" ? "Best level beaten" : "Your best", value: game.rankBy === "wins" ? (["–", "Easy", "Medium", "Hard"][stat.best] ?? "–") : `${stat.best.toLocaleString()} ${game.unit}` },
                { label: "Played", value: stat.plays.toLocaleString() },
                { label: "Wins", value: stat.wins.toLocaleString() },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-xs text-ink-500">{item.label}</dt>
                  <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums text-ink-100">{item.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-2 lg:gap-6">
        <section className={`${ui.card} p-5`}>
          <h2 className="text-sm font-semibold text-ink-100">How to play</h2>
          <ol className="mt-3 space-y-3">
            {game.howTo.map((line, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink-400">
                <span
                  className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md text-[11px] font-semibold text-white"
                  style={{ background: `linear-gradient(135deg, ${game.colors[0]}, ${game.colors[1]})` }}
                >
                  {i + 1}
                </span>
                {line}
              </li>
            ))}
          </ol>
        </section>
        <Leaderboard game={game} />
      </div>
    </PageContainer>
  );
}
