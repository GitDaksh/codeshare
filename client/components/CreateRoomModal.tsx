"use client";

import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { LANGUAGES } from "@/lib/languages";

type CreateRoomModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, language: string) => Promise<void>;
};

export function CreateRoomModal({ open, onClose, onCreate }: CreateRoomModalProps) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;

    setSubmitting(true);
    try {
      await onCreate(name.trim(), language);
      setName("");
      setLanguage("javascript");
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
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-sm rounded-xl border border-ink-700 bg-ink-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
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
                <label className="mb-1 block text-xs text-ink-400">Room name</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Interview prep"
                  className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 focus:border-ink-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-ink-400">Language</label>
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
                  className="rounded-md px-3 py-1.5 text-sm text-ink-400 transition-colors hover:text-ink-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || submitting}
                  className="rounded-md bg-ink-100 px-4 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
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