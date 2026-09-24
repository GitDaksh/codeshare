"use client";

import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { LANGUAGES } from "@/lib/languages";

type CreateRoomModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, language: string) => Promise<void>;
  defaultLanguage?: string;
};

export function CreateRoomModal({
  open,
  onClose,
  onCreate,
  defaultLanguage = "javascript",
}: CreateRoomModalProps) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState(defaultLanguage);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;

    setSubmitting(true);
    try {
      await onCreate(name.trim(), language);
      setName("");
      setLanguage(defaultLanguage);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // Bottom sheet on phones (sits above the keyboard); centered dialog on larger screens.
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.18 }}
            className="w-full rounded-t-2xl border border-ink-800 bg-ink-900 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-sm sm:rounded-xl sm:pb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-700 sm:hidden" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-100">Create a room</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-md p-1 text-ink-400 transition-colors hover:text-ink-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-ink-500">Room name</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Interview prep"
                  enterKeyHint="done"
                  className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-600 focus:border-ink-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-ink-500">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-300 focus:border-ink-500 focus:outline-none"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md px-3 py-2 text-sm text-ink-400 transition-colors hover:text-ink-100 sm:py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || submitting}
                  className="rounded-md bg-ink-100 px-4 py-2 text-sm font-medium text-ink-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 sm:py-1.5"
                >
                  {submitting ? "Creating…" : "Create room"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}