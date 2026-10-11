"use client";

import { use, useEffect } from "react";
import { OnlineGame } from "@/components/games/OnlineGame";

// A game with friends: /games/play/<code>.
export default function PlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const clean = code.toUpperCase();

  useEffect(() => {
    document.title = `Game ${clean} — CodeShare`;
  }, [clean]);

  return <OnlineGame key={clean} code={clean} />;
}
