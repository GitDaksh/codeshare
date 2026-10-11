"use client";

import { useState } from "react";
import { Check, Copy, Link as LinkIcon, Loader2, Play, Trophy, UserPlus, X } from "lucide-react";
import { PlayerAvatar } from "@/components/games/PlayerAvatar";
import { SettingsPicker } from "@/components/games/SettingsPicker";
import { GameArt } from "@/components/games/GameArt";
import { settingsFor, type GameDef } from "@/lib/games/registry";
import type { LobbyState } from "@/lib/games/useLobby";
import type { Settings } from "@/lib/games/types";
import { ui } from "@/lib/ui";

function CopyButton({ text, label, icon: Icon }: { text: string; label: string; icon: typeof Copy }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          })
          .catch(() => {});
      }}
      className={ui.secondarySm}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Icon className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}

// Before a match: invite friends (code or link), see who's here, and (the
// host) pick the settings and start.
export function Lobby({
  game,
  lobby,
  me,
  isHost,
  onStart,
  onSettings,
  onKick,
}: {
  game: GameDef;
  lobby: LobbyState;
  me: string | null;
  isHost: boolean;
  onStart: () => Promise<{ ok: boolean; error?: string }>;
  onSettings: (settings: Settings) => void;
  onKick: (id: string) => void;
}) {
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const link = typeof window !== "undefined" ? `${window.location.origin}/games/play/${lobby.code}` : `/games/play/${lobby.code}`;
  const online = lobby.members.filter((m) => m.online);
  const missing = Math.max(0, game.players.min - online.length);
  const host = lobby.members.find((m) => m.id === lobby.hostId);
  const seats = Array.from({ length: game.players.max }, (_, seat) => lobby.members.find((m) => m.seat === seat) ?? null);
  const wins = Object.entries(lobby.wins).sort((a, b) => b[1] - a[1]);

  async function start() {
    setStarting(true);
    setStartError(null);
    const res = await onStart();
    setStarting(false);
    if (!res.ok) setStartError(res.error === "need-players" ? `${game.title} needs at least ${game.players.min} players.` : "Couldn't start. Try again.");
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
      <section className="gs-rise overflow-hidden rounded-2xl border border-ink-800 bg-ink-900 shadow-card">
        <div className="relative h-36 overflow-hidden border-b border-ink-800 sm:h-44">
          <GameArt game={game} />
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className={ui.eyebrow}>Invite friends</p>
              <div className="mt-2 flex gap-1.5" aria-label={`Lobby code ${lobby.code}`}>
                {lobby.code.split("").map((char, i) => (
                  <span
                    key={i}
                    className="grid h-12 w-10 place-items-center rounded-lg border border-ink-700 bg-ink-950 font-[family-name:var(--font-mono)] text-2xl font-semibold text-ink-100 sm:h-14 sm:w-11"
                  >
                    {char}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={lobby.code} label="Copy code" icon={Copy} />
              <CopyButton text={link} label="Copy link" icon={LinkIcon} />
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-500">Friends join with the link, or by entering the code on the Games page.</p>

          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-100">
              Players <span className="ml-1 text-ink-500 tabular-nums">{lobby.members.length}/{game.players.max}</span>
            </h2>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {seats.map((member, seat) =>
              member ? (
                <li
                  key={member.id}
                  className="gs-pop-in group relative flex flex-col items-center rounded-xl border border-ink-800 bg-ink-950 px-2 py-3 text-center"
                >
                  <PlayerAvatar player={{ ...member, bot: false }} size={40} host={member.id === lobby.hostId} dim={!member.online} />
                  <span className="mt-2 max-w-full truncate text-sm font-medium text-ink-100">{member.name}</span>
                  <span className="text-[11px] text-ink-500">{member.id === me ? "You" : member.online ? "Ready" : "Reconnecting…"}</span>
                  {isHost && member.id !== me && (
                    <button
                      type="button"
                      onClick={() => onKick(member.id)}
                      aria-label={`Remove ${member.name}`}
                      title={`Remove ${member.name}`}
                      className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md text-ink-500 opacity-0 transition-opacity hover:bg-ink-800 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ) : (
                <li
                  key={`open-${seat}`}
                  className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-700 px-2 py-3 text-center"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-ink-800/60 text-ink-500">
                    <UserPlus className="h-4 w-4" />
                  </span>
                  <span className="mt-2 text-sm text-ink-500">Open seat</span>
                  <span className="text-[11px] text-transparent">.</span>
                </li>
              )
            )}
          </ul>
        </div>
      </section>

      <aside className="gs-rise space-y-4" style={{ animationDelay: "80ms" }}>
        <section className="rounded-2xl border border-ink-800 bg-ink-900 p-5 shadow-card">
          <h2 className="text-sm font-semibold text-ink-100">Settings</h2>
          <p className="mt-0.5 text-xs text-ink-500">{isHost ? "Everyone plays with these." : `Only ${host?.name ?? "the host"} can change these.`}</p>
          <div className="mt-4">
            <SettingsPicker
              id="lobby"
              defs={settingsFor(game, "online")}
              value={lobby.settings}
              onChange={onSettings}
              disabled={!isHost}
            />
            {settingsFor(game, "online").length === 0 && <p className="text-sm text-ink-400">Nothing to set: it&apos;s you against your friend.</p>}
          </div>

          <div className="mt-6">
            {isHost ? (
              <>
                <button type="button" onClick={start} disabled={starting || missing > 0} className={`${ui.primary} h-11 w-full text-[15px]`}>
                  {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {lobby.status === "finished" ? "Play again" : "Start game"}
                </button>
                <p className="mt-2 text-center text-xs text-ink-500">
                  {startError ?? (missing > 0 ? `Waiting for ${missing} more player${missing === 1 ? "" : "s"}…` : `${online.length} player${online.length === 1 ? "" : "s"} ready`)}
                </p>
              </>
            ) : (
              <div className="flex h-11 items-center justify-center gap-2 rounded-lg border border-ink-800 bg-ink-950 text-sm text-ink-400">
                <span className="gs-pulse-soft h-1.5 w-1.5 rounded-full bg-success-strong" />
                Waiting for {host?.name ?? "the host"} to start…
              </div>
            )}
          </div>
        </section>

        {wins.length > 0 && (
          <section className="rounded-2xl border border-ink-800 bg-ink-900 p-5 shadow-card">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-100">
              <Trophy className="h-4 w-4 text-warning" />
              This session
            </h2>
            <ul className="mt-3 space-y-2">
              {wins.map(([id, count]) => {
                const member = lobby.members.find((m) => m.id === id);
                return (
                  <li key={id} className="flex items-center gap-2.5 text-sm">
                    {member ? <PlayerAvatar player={{ ...member, bot: false }} size={22} /> : <span className="h-[22px] w-[22px] rounded-full bg-ink-800" />}
                    <span className="min-w-0 flex-1 truncate text-ink-200">{member?.name ?? "Left"}</span>
                    <span className="tabular-nums text-ink-400">
                      {count} win{count === 1 ? "" : "s"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="rounded-2xl border border-ink-800 bg-ink-900 p-5 shadow-card">
          <h2 className="text-sm font-semibold text-ink-100">How to play</h2>
          <ol className="mt-3 space-y-2.5">
            {game.howTo.map((line, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-400">
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
      </aside>
    </div>
  );
}
