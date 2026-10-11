"use client";

import { useSyncExternalStore } from "react";

// Little sound effects, synthesized on the spot (no audio files to load).
// Sound can be switched off; the choice is remembered on this device.

const KEY = "codeshare:games:sound";
const EVENT = "codeshare:games:sound";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useSoundOn(): boolean {
  return useSyncExternalStore(subscribe, soundOn, () => true);
}

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === "undefined" || !soundOn()) return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return { ctx, out: master! };
  } catch {
    return null;
  }
}

type Tone = {
  freq: number;
  to?: number;
  ms: number;
  type?: OscillatorType;
  volume?: number;
  delay?: number;
};

function play(...tones: Tone[]) {
  const a = audio();
  if (!a) return;
  const start = a.ctx.currentTime;
  for (const tone of tones) {
    const at = start + (tone.delay ?? 0) / 1000;
    const end = at + tone.ms / 1000;
    const osc = a.ctx.createOscillator();
    const gain = a.ctx.createGain();
    osc.type = tone.type ?? "sine";
    osc.frequency.setValueAtTime(tone.freq, at);
    if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to, end);
    const volume = tone.volume ?? 0.12;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(a.out);
    osc.start(at);
    osc.stop(end + 0.02);
  }
}

export const sfx = {
  key: () => play({ freq: 1500 + Math.random() * 300, ms: 22, type: "square", volume: 0.025 }),
  error: () => play({ freq: 170, to: 120, ms: 110, type: "sawtooth", volume: 0.05 }),
  tick: () => play({ freq: 740, ms: 70, type: "triangle", volume: 0.09 }),
  go: () => play({ freq: 990, ms: 90, type: "triangle", volume: 0.1 }, { freq: 1480, ms: 220, type: "triangle", volume: 0.1, delay: 80 }),
  correct: () => play({ freq: 660, ms: 90, type: "triangle" }, { freq: 990, ms: 160, type: "triangle", delay: 75 }),
  wrong: () => play({ freq: 240, to: 150, ms: 260, type: "triangle", volume: 0.1 }),
  pop: () => play({ freq: 520, to: 880, ms: 90, type: "sine", volume: 0.1 }),
  flip: () => play({ freq: 420, to: 640, ms: 60, type: "triangle", volume: 0.06 }),
  drop: () => play({ freq: 300, to: 140, ms: 120, type: "sine", volume: 0.14 }),
  eat: () => play({ freq: 600, to: 1100, ms: 80, type: "square", volume: 0.04 }),
  combo: (level: number) => play({ freq: 520 * Math.pow(1.122, Math.min(level, 12)), ms: 110, type: "triangle", volume: 0.09 }),
  crash: () => play({ freq: 180, to: 50, ms: 420, type: "sawtooth", volume: 0.08 }),
  win: () =>
    play(
      { freq: 523, ms: 140, type: "triangle" },
      { freq: 659, ms: 140, type: "triangle", delay: 120 },
      { freq: 784, ms: 140, type: "triangle", delay: 240 },
      { freq: 1047, ms: 420, type: "triangle", delay: 360 }
    ),
  lose: () =>
    play({ freq: 392, ms: 180, type: "triangle", volume: 0.09 }, { freq: 330, ms: 180, type: "triangle", volume: 0.09, delay: 170 }, { freq: 262, ms: 380, type: "triangle", volume: 0.09, delay: 340 }),
};
