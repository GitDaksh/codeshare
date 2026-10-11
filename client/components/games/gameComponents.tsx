"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { Loader2 } from "lucide-react";
import type { GameId, GameProps } from "@/lib/games/types";

function Loading() {
  return (
    <div className="grid h-full min-h-[50vh] place-items-center">
      <Loader2 className="h-5 w-5 animate-spin text-ink-500" />
    </div>
  );
}

// Each game's code loads only when it's played.
export const GAME_COMPONENTS: Record<GameId, ComponentType<GameProps>> = {
  "code-racer": dynamic(() => import("@/components/games/racer/CodeRacer"), { ssr: false, loading: Loading }),
  keyword: dynamic(() => import("@/components/games/keyword/Keyword"), { ssr: false, loading: Loading }),
  "bit-flip": dynamic(() => import("@/components/games/bitflip/BitFlip"), { ssr: false, loading: Loading }),
  "output-oracle": dynamic(() => import("@/components/games/quiz/OutputOracle"), { ssr: false, loading: Loading }),
  "big-o-blitz": dynamic(() => import("@/components/games/quiz/BigOBlitz"), { ssr: false, loading: Loading }),
  "bug-hunt": dynamic(() => import("@/components/games/quiz/BugHunt"), { ssr: false, loading: Loading }),
  "four-in-a-row": dynamic(() => import("@/components/games/four/FourInARow"), { ssr: false, loading: Loading }),
  "pair-programming": dynamic(() => import("@/components/games/pairs/PairProgramming"), { ssr: false, loading: Loading }),
  "byte-snake": dynamic(() => import("@/components/games/snake/ByteSnake"), { ssr: false, loading: Loading }),
};
