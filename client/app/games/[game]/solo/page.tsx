"use client";

import { Suspense, use, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SoloGame } from "@/components/games/SoloGame";
import { gameById, normalizeSettings, type GameDef } from "@/lib/games/registry";
import { ui } from "@/lib/ui";

function SoloWithSettings({ game }: { game: GameDef }) {
  const params = useSearchParams();
  const query = params.toString();
  const settings = useMemo(() => normalizeSettings(game, "solo", Object.fromEntries(new URLSearchParams(query))), [game, query]);
  return <SoloGame key={`${game.id}?${query}`} game={game} settings={settings} />;
}

function Loading() {
  return (
    <main className="grid h-dvh place-items-center bg-ink-950">
      <Loader2 className="h-5 w-5 animate-spin text-ink-500" />
    </main>
  );
}

// A solo game, full screen (the settings come from the address).
export default function SoloGamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game: id } = use(params);
  const game = gameById(id);
  if (!game) {
    return (
      <main className="grid h-dvh place-items-center bg-ink-950 text-center">
        <div>
          <p className="font-semibold text-ink-100">Game not found</p>
          <Link href="/games" className={`${ui.secondary} mt-3`}>
            All games
          </Link>
        </div>
      </main>
    );
  }
  return (
    <Suspense fallback={<Loading />}>
      <SoloWithSettings game={game} />
    </Suspense>
  );
}
