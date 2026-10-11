"use client";

import { useEffect, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/PageHeader";
import { GameCard } from "@/components/games/GameCard";
import { JoinCode } from "@/components/games/JoinCode";
import { GAMES, gameById, normalizeSettings } from "@/lib/games/registry";
import { loadSettings } from "@/lib/games/lastSettings";
import { useCreateLobby } from "@/lib/games/useCreateLobby";
import { useGameStats } from "@/lib/games/stats";
import { dailyKey, useDaily } from "@/lib/games/daily";
import { ui } from "@/lib/ui";
import "@/components/games/games.css";

// Today's Keyword: the same word for everyone, once a day.
function DailyBanner() {
  const keyword = gameById("keyword")!;
  const done = useDaily(dailyKey());
  return (
    <Link
      href="/games/keyword/solo?mode=daily"
      className="gs-rise group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-ink-800 bg-ink-900 p-4 shadow-xs transition-[border-color,box-shadow] hover:border-ink-700 hover:shadow-card sm:p-5"
      style={{ "--g1": keyword.colors[0], "--g2": keyword.colors[1] } as CSSProperties}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(80% 140% at 0% 50%, color-mix(in srgb, var(--g1) 18%, transparent), transparent 60%)" }}
      />
      <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-xs" style={{ background: "linear-gradient(135deg, var(--g1), var(--g2))" }}>
        <CalendarDays className="h-5 w-5" />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink-100">Today&apos;s Keyword</span>
        <span className="block truncate text-sm text-ink-400">
          {done
            ? done.solved
              ? `Solved in ${done.guesses} ${done.guesses === 1 ? "guess" : "guesses"}. New word tomorrow!`
              : "Not this time. A new word comes tomorrow."
            : "One programming word, six guesses, the same for everyone."}
        </span>
      </span>
      <span className={`relative ${done ? ui.secondarySm : ui.primarySm}`}>
        {done ? <Check className="h-3.5 w-3.5" /> : null}
        {done ? "See result" : "Play"}
        {!done && <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />}
      </span>
    </Link>
  );
}

export default function GamesPage() {
  const { stats } = useGameStats();
  const { create, creating } = useCreateLobby();

  useEffect(() => {
    document.title = "Games — CodeShare";
  }, []);

  return (
    <PageContainer>
      <PageHeader
        title="Games"
        description="Quick games for people who code. Play solo in seconds, or send a link and play with friends, live."
        actions={<JoinCode />}
      />
      <DailyBanner />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {GAMES.map((game, i) => (
          <GameCard
            key={game.id}
            game={game}
            index={i}
            stat={stats?.[game.id]}
            creating={creating === game.id}
            onFriends={() => void create(game.id, normalizeSettings(game, "online", loadSettings(game.id)))}
          />
        ))}
      </div>
    </PageContainer>
  );
}
