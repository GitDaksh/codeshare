"use client";

import Link from "next/link";
import { ArrowUpRight, Trash2 } from "lucide-react";
import { SpotlightCard } from "@/components/landing/SpotlightCard";
import { getStarterCode, LANGUAGES } from "@/lib/languages";
import type { Room } from "@/types/room";

type RoomCardProps = {
  room: Room;
  updatedLabel: string;
  canDelete: boolean;
  confirmingDelete: boolean;
  onRequestDelete: () => void;
};

const PREVIEW_LINE_COUNT = 6;
const PREVIEW_MASK = "linear-gradient(to bottom, #000 55%, transparent)";

function previewLines(room: Room): string[] {
  const source = room.code && room.code.trim() ? room.code : getStarterCode(room.language);
  return source.replace(/\t/g, "  ").split("\n").slice(0, PREVIEW_LINE_COUNT);
}

function languageLabel(value: string): string {
  return LANGUAGES.find((l) => l.value === value)?.label ?? value;
}

export function RoomCard({ room, updatedLabel, canDelete, confirmingDelete, onRequestDelete }: RoomCardProps) {
  return (
    <SpotlightCard
      className="h-full transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-16px_rgba(255,255,255,0.14)]"
      borderClassName="bg-ink-700"
      surfaceClassName="bg-ink-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
    >
      <div className="relative flex h-full flex-col">
        {/* Stretched link: the whole card opens the room, while the delete
            button still receives its own clicks (no button nested inside a link). */}
        <Link
          href={`/room/${room._id}`}
          aria-label={`Open room ${room.name}`}
          className="absolute inset-0 z-0 rounded-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-100"
        />

        {/* Code preview, styled as a darker "editor well" inside the card */}
        <div
          aria-hidden="true"
          className="pointer-events-none relative h-32 overflow-hidden border-b border-ink-800 bg-black/50 px-4 py-3 font-[family-name:var(--font-mono)] text-[11px] leading-5"
          style={{ maskImage: PREVIEW_MASK, WebkitMaskImage: PREVIEW_MASK }}
        >
          {previewLines(room).map((line, i) => (
            <div key={i} className="flex gap-3 whitespace-pre">
              <span className="w-3 shrink-0 text-right text-ink-600">{i + 1}</span>
              <span className="truncate text-ink-300">{line || " "}</span>
            </div>
          ))}
        </div>

        <div className="pointer-events-none relative flex flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="truncate text-sm font-semibold text-ink-100">{room.name}</h3>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-500 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink-100" />
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 pt-4">
            <div className="flex min-w-0 items-center gap-2 text-xs text-ink-400">
              <span className="shrink-0 rounded-md border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium text-ink-300">
                {languageLabel(room.language)}
              </span>
              <span className="truncate">{updatedLabel}</span>
            </div>
            {canDelete && (
              <button
                type="button"
                onClick={onRequestDelete}
                aria-label={confirmingDelete ? `Confirm deleting ${room.name}` : `Delete ${room.name}`}
                title={confirmingDelete ? "Click again to delete" : "Delete room"}
                className={`pointer-events-auto relative z-10 flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-xs transition-colors ${
                  confirmingDelete
                    ? "bg-red-500/10 text-red-400"
                    : "text-ink-500 hover:bg-ink-800 hover:text-red-400"
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {confirmingDelete && "Confirm"}
              </button>
            )}
          </div>
        </div>
      </div>
    </SpotlightCard>
  );
}