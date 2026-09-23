"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

type RoomSettingsModalProps = {
  open: boolean;
  onClose: () => void;
  currentName: string;
  onSave: (name: string) => Promise<void>;
};

export function RoomSettingsModal({ open, onClose, currentName, onSave }: RoomSettingsModalProps) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setName(currentName);
  }, [open, currentName]);

  async function handleSave() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(name.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
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
              <h2 className="text-sm font-semibold text-ink-100">Room settings</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-md p-1 text-ink-400 transition-colors hover:text-ink-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mb-1 block text-xs text-ink-500">Room name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 focus:border-ink-500 focus:outline-none"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-sm text-ink-400 transition-colors hover:text-ink-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim() || saving}
                className="rounded-md bg-ink-100 px-4 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}