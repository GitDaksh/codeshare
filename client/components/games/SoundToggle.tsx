"use client";

import { Volume2, VolumeX } from "lucide-react";
import { setSoundOn, useSoundOn } from "@/lib/games/sound";
import { ui } from "@/lib/ui";

export function SoundToggle() {
  const on = useSoundOn();
  return (
    <button
      type="button"
      onClick={() => setSoundOn(!on)}
      aria-label={on ? "Turn sound off" : "Turn sound on"}
      title={on ? "Sound on" : "Sound off"}
      className={ui.icon}
    >
      {on ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
    </button>
  );
}
