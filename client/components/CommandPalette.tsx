"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, type LucideIcon } from "lucide-react";
import { useMediaQuery } from "@/lib/useMediaQuery";

export type Command = {
  id: string;
  label: string;
  icon: LucideIcon;
  action: () => void;
  disabled?: boolean;
};

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  commands: Command[];
};

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // On phones this opens from the ⋯ button and works as an action menu.
  // Auto-focusing the search box there would pop the keyboard over the list.
  const isTouch = useMediaQuery("(hover: none)");

  const filtered = useMemo(
    () => commands.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase())),
    [commands, query]
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      if (!isTouch) {
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    }
  }, [open, isTouch]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  function runCommand(command: Command) {
    if (command.disabled) return;
    command.action();
    onClose();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const command = filtered[selectedIndex];
      if (command) runCommand(command);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-3 pt-[8vh] backdrop-blur-sm sm:px-4 sm:pt-[15vh]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-ink-700 bg-ink-900/95 shadow-2xl shadow-black/70 backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-ink-800 px-4">
              <Search className="h-4 w-4 shrink-0 text-ink-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isTouch ? "Search actions…" : "Type a command…"}
                className="w-full bg-transparent py-3.5 text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none"
              />
            </div>

            <div className="max-h-[60dvh] overflow-y-auto p-1.5 sm:max-h-80">
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-ink-400">No matching commands.</p>
              ) : (
                filtered.map((command, i) => {
                  const Icon = command.icon;
                  const selected = i === selectedIndex && !isTouch;
                  return (
                    <button
                      key={command.id}
                      onClick={() => runCommand(command)}
                      onMouseEnter={() => setSelectedIndex(i)}
                      disabled={command.disabled}
                      className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                        selected ? "bg-ink-800 text-ink-100" : "text-ink-300"
                      } ${command.disabled ? "cursor-not-allowed opacity-40" : "active:bg-ink-800"}`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          selected ? "border-ink-600 bg-ink-900" : "border-ink-700 bg-ink-950"
                        }`}
                      >
                        <Icon className={`h-3.5 w-3.5 ${selected ? "text-ink-100" : "text-ink-400"}`} />
                      </span>
                      {command.label}
                    </button>
                  );
                })
              )}
            </div>

            {!isTouch && (
              <div className="flex items-center gap-4 border-t border-ink-800 px-4 py-2 text-[10px] text-ink-500">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-ink-700 bg-ink-950 px-1 font-[family-name:var(--font-mono)] text-ink-300">↑</kbd>
                  <kbd className="rounded border border-ink-700 bg-ink-950 px-1 font-[family-name:var(--font-mono)] text-ink-300">↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-ink-700 bg-ink-950 px-1 font-[family-name:var(--font-mono)] text-ink-300">↵</kbd>
                  run
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-ink-700 bg-ink-950 px-1 font-[family-name:var(--font-mono)] text-ink-300">esc</kbd>
                  close
                </span>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}