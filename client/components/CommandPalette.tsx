"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
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
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-3 pt-[8vh] sm:px-4 sm:pt-[15vh]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-md overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isTouch ? "Search actions…" : "Type a command…"}
              className="w-full border-b border-ink-800 bg-transparent px-4 py-3 text-sm text-ink-100 placeholder:text-ink-600 focus:outline-none"
            />
            <div className="max-h-[60dvh] overflow-y-auto p-1.5 sm:max-h-72">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-ink-600">No matching commands.</p>
              ) : (
                filtered.map((command, i) => {
                  const Icon = command.icon;
                  return (
                    <button
                      key={command.id}
                      onClick={() => runCommand(command)}
                      onMouseEnter={() => setSelectedIndex(i)}
                      disabled={command.disabled}
                      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm transition-colors sm:py-2 ${
                        i === selectedIndex && !isTouch ? "bg-ink-800 text-ink-100" : "text-ink-300"
                      } ${command.disabled ? "cursor-not-allowed opacity-40" : "active:bg-ink-800"}`}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-ink-500" />
                      {command.label}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}