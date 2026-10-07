"use client";

import Link from "next/link";
import { ChevronRight, Trash2 } from "lucide-react";
import { LANGUAGES } from "@/lib/languages";
import type { Room } from "@/types/room";

const SHORT: Record<string, string> = { javascript: "JS", typescript: "TS", python: "PY", cpp: "C++", java: "JAVA" };

export function languageLabel(value: string): string {
  return LANGUAGES.find((option) => option.value === value)?.label ?? value;
}

// A room in a list: its language, name and last update, opening on click.
// Owners get a two-step delete.
export function RoomRow({
  room,
  meta,
  canDelete = false,
  confirmingDelete = false,
  onRequestDelete,
}: {
  room: Room;
  meta: string;
  canDelete?: boolean;
  confirmingDelete?: boolean;
  onRequestDelete?: () => void;
}) {
  return (
    <div className="group relative flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-ink-950 sm:px-5">
      <Link href={`/room/${room._id}`} aria-label={`Open ${room.name}`} className="absolute inset-0 z-0" />
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-800 bg-ink-950 font-[family-name:var(--font-mono)] text-[10px] font-semibold text-ink-400 group-hover:bg-ink-900">
        {SHORT[room.language] ?? room.language.slice(0, 2).toUpperCase()}
      </span>
      <div className="pointer-events-none min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-100">{room.name}</p>
        <p className="truncate text-xs text-ink-500">
          {languageLabel(room.language)} · {meta}
        </p>
      </div>
      {canDelete && onRequestDelete && (
        <button
          type="button"
          onClick={onRequestDelete}
          aria-label={confirmingDelete ? `Confirm deleting ${room.name}` : `Delete ${room.name}`}
          title={confirmingDelete ? "Click again to delete" : "Delete room"}
          className={`relative z-10 flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-medium transition-all ${
            confirmingDelete
              ? "bg-danger-soft text-danger opacity-100"
              : "text-ink-500 opacity-100 hover:bg-ink-800 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          }`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {confirmingDelete && "Delete"}
        </button>
      )}
      <ChevronRight className="pointer-events-none h-4 w-4 shrink-0 text-ink-600 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-400" />
    </div>
  );
}