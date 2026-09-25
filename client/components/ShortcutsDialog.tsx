"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Keyboard, X } from "lucide-react";

const OPEN_EVENT = "codeshare:open-shortcuts";

// Lets any component (e.g. the room's command palette) open the sheet.
export function openShortcutsDialog() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

type Shortcut = { keys: string[]; label: string };
type ShortcutGroup = { title: string; items: Shortcut[] };

function buildGroups(isMac: boolean): ShortcutGroup[] {
  const mod = isMac ? "⌘" : "Ctrl";
  const alt = isMac ? "⌥" : "Alt";
  const shift = isMac ? "⇧" : "Shift";

  return [
    {
      title: "Everywhere",
      items: [
        { keys: ["?"], label: "Show keyboard shortcuts" },
        { keys: ["Esc"], label: "Close dialogs and menus" },
        { keys: ["Tab"], label: "Move between controls" },
      ],
    },
    {
      title: "Dashboard",
      items: [
        { keys: ["N"], label: "New room" },
        { keys: ["/"], label: "Search rooms" },
      ],
    },
    {
      title: "Room",
      items: [
        { keys: [mod, "K"], label: "Command palette" },
        { keys: [mod, "↵"], label: "Run code (in the editor)" },
        { keys: ["Right-click"], label: "Send selected code to chat" },
      ],
    },
    {
      title: "Editor",
      items: [
        { keys: [mod, "F"], label: "Find" },
        { keys: [mod, "D"], label: "Select next match" },
        { keys: [mod, "/"], label: "Toggle comment" },
        { keys: [alt, "↑"], label: "Move line up" },
        { keys: [alt, "↓"], label: "Move line down" },
        { keys: [mod, "Z"], label: "Undo" },
        { keys: [mod, shift, "Z"], label: "Redo" },
      ],
    },
  ];
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable ||
    // The code editor manages its own input and may not use a textarea.
    !!target.closest(".monaco-editor")
  );
}

export function ShortcutsDialog() {
  const [open, setOpen] = useState(false);
  const [isMac, setIsMac] = useState(true);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent));
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setOpen((o) => !o);
    }
    function handleOpenRequest() {
      setOpen(true);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener(OPEN_EVENT, handleOpenRequest);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(OPEN_EVENT, handleOpenRequest);
    };
  }, []);

  // Move focus into the dialog so keyboard users land in the right place.
  useEffect(() => {
    if (open) setTimeout(() => closeRef.current?.focus(), 0);
  }, [open]);

  const groups = buildGroups(isMac);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.21, 0.47, 0.32, 0.98] }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-ink-700 bg-ink-900 shadow-2xl shadow-black/70"
          >
            <div className="flex items-start justify-between gap-4 border-b border-ink-800 px-6 pb-4 pt-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ink-700 bg-ink-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <Keyboard className="h-4 w-4 text-ink-100" />
                </div>
                <div>
                  <h2
                    id="shortcuts-title"
                    className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-ink-100"
                  >
                    Keyboard shortcuts
                  </h2>
                  <p className="text-xs text-ink-400">
                    Press{" "}
                    <kbd className="rounded border border-ink-700 bg-ink-950 px-1 font-[family-name:var(--font-mono)] text-ink-300">
                      ?
                    </kbd>{" "}
                    anytime to open this.
                  </p>
                </div>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-x-10 gap-y-7 px-6 py-6 sm:grid-cols-2">
              {groups.map((group) => (
                <section key={group.title}>
                  <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-ink-400">{group.title}</h3>
                  <ul className="space-y-2.5">
                    {group.items.map((item) => (
                      <li key={item.label} className="flex items-center justify-between gap-4">
                        <span className="text-sm text-ink-300">{item.label}</span>
                        <span className="flex shrink-0 items-center gap-1">
                          {item.keys.map((key) => (
                            <kbd
                              key={key}
                              className="min-w-[1.5rem] rounded-md border border-ink-700 bg-ink-950 px-1.5 py-0.5 text-center font-[family-name:var(--font-mono)] text-[11px] text-ink-100 shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]"
                            >
                              {key}
                            </kbd>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}