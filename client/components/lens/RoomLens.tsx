"use client";

import { Crosshair, EyeOff, Hand, Loader2, Square } from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
import { LensCallCard } from "@/components/lens/LensCallCard";
import { LensPlayer } from "@/components/lens/LensPlayer";
import { LensTestPicker } from "@/components/lens/LensTestPicker";
import type { RoomLensState } from "@/lib/useRoomLens";

const ACTION =
  "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-ink-700 px-2 text-xs font-medium text-ink-300 transition-colors hover:border-ink-500 hover:text-ink-100";

function SessionActions({ lens }: { lens: RoomLensState }) {
  const { session } = lens;
  if (!session) return null;
  const driver = session.driver;
  const who = !session.shared
    ? "Only you"
    : lens.isDriver
      ? "You're driving"
      : driver
        ? `${driver.name} is driving`
        : "No one is driving";

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {lens.practice ? (
        <LensTestPicker practice={lens.practice} title={session.title} truncated={session.trace.truncated} />
      ) : (
        session.title && (
          <span className="hidden max-w-[16rem] truncate rounded-md border border-ink-800 px-1.5 py-0.5 font-mono text-[10px] text-ink-400 xl:inline">
            {session.title}
          </span>
        )
      )}
      <span className="hidden items-center gap-1.5 pr-1 text-[11px] text-ink-400 md:flex" aria-live="polite">
        {session.shared && driver && <AvatarIcon avatarId={driver.avatarId} className="h-4 w-4" />}
        {who}
      </span>
      {session.shared && !lens.isDriver && !lens.following && (
        <button type="button" onClick={lens.follow} className={ACTION} title="Jump back to where the driver is">
          <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
          Follow
        </button>
      )}
      {session.shared && !lens.isDriver && lens.canDrive && (
        <button type="button" onClick={lens.takeControl} className={ACTION} title="Drive the steps for everyone">
          <Hand className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Take control</span>
        </button>
      )}
      <button type="button" onClick={lens.hide} className={ACTION} title="Back to the code (the session keeps going)">
        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Code</span>
      </button>
      {lens.isDriver && (
        <button
          type="button"
          onClick={lens.end}
          className={ACTION}
          title={session.shared ? "End the session for everyone" : "Close"}
        >
          <Square className="h-3 w-3" aria-hidden="true" />
          End
        </button>
      )}
    </div>
  );
}

// Sits over the editor: the recording veil, the "nothing ran" card, the
// shared player, or (when the player is hidden) a small banner to jump back in.
export function RoomLens({ lens }: { lens: RoomLensState }) {
  const { session } = lens;

  if (lens.recording) {
    return (
      <div className="absolute inset-0 z-20 grid place-items-center bg-ink-950/85 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3 px-6 text-center" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-ink-300" aria-hidden="true" />
          <p className="max-w-xs truncate text-sm font-medium text-ink-100">
            Recording {lens.recordingTitle || "your run"}…
          </p>
          {lens.recordingLanguage === "python" && (
            <p className="max-w-xs text-xs text-ink-500">The first time, Python takes a few seconds to download.</p>
          )}
        </div>
      </div>
    );
  }

  if (lens.idle) {
    const idle = lens.idle;
    const practice = lens.practice;
    return (
      <div className="absolute inset-0 z-20 grid grid-cols-1 place-items-center overflow-y-auto bg-ink-950/90 p-4 backdrop-blur-sm">
        <LensCallCard
          key={idle.defaultCall}
          language={idle.language}
          callables={idle.callables}
          defaultCall={idle.defaultCall}
          onSubmit={(call) => void lens.submitCall(call)}
          onShowAnyway={() => void lens.showIdleAnyway()}
          onCancel={lens.dismissIdle}
          testLabel={practice ? `Test ${practice.defaultTest + 1}` : undefined}
          onUseTest={practice ? () => practice.choose({ kind: "test", index: practice.defaultTest }) : undefined}
        />
      </div>
    );
  }

  if (!session) return null;

  if (!lens.open) {
    const label = !session.shared
      ? "Your recording"
      : lens.isDriver
        ? "You're presenting"
        : session.driver
          ? `${session.driver.name} is presenting`
          : "A recording is open";
    return (
      <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3">
        <div className="pointer-events-auto flex max-w-full items-center gap-2.5 rounded-full border border-ink-700 bg-ink-900/95 py-1 pl-3 pr-1 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.9)] backdrop-blur">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink-100 opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-ink-100" />
          </span>
          <span className="truncate text-xs text-ink-300">
            <span className="font-medium text-ink-100">Lens</span> · {label}
            {session.title ? ` · ${session.title}` : ""}
          </span>
          <button
            type="button"
            onClick={lens.show}
            className="shrink-0 rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-950 transition-colors hover:bg-white"
          >
            {lens.isDriver ? "Open" : "Watch"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-ink-950">
      <LensPlayer
        key={session.id}
        fill
        code={session.code}
        trace={session.trace}
        step={lens.step}
        onStepChange={lens.changeStep}
        actions={<SessionActions lens={lens} />}
      />
    </div>
  );
}