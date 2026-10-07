"use client";

import { useEscape } from "@/lib/useEscape";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Eye, PencilLine, RotateCcw, X } from "lucide-react";

type Kind = "edit" | "view";

type ShareDialogProps = {
  open: boolean;
  onClose: () => void;
  roomId: string;
  invites: { edit: string; view: string } | undefined;
  // Only the owner can replace a link.
  canReset: boolean;
  onReset: (kind: Kind) => Promise<void>;
};

const LINKS: { kind: Kind; title: string; detail: string; icon: typeof Eye }[] = [
  { kind: "edit", title: "Can edit", detail: "Type, run code and drive Lens.", icon: PencilLine },
  { kind: "view", title: "Can view", detail: "Watch, follow and chat. Can't change the code.", icon: Eye },
];

// The room's two invite links. Anyone who opens one joins the room with that
// role; people already in the room keep theirs.
export function ShareDialog(props: ShareDialogProps) {
  useEscape(props.open, props.onClose);
  return (
    <AnimatePresence>
      {props.open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:px-4"
          onClick={props.onClose}
        >
          <ShareCard {...props} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// The dialog itself: mounted only while open, so it always starts fresh.
function ShareCard({ onClose, roomId, invites, canReset, onReset }: ShareDialogProps) {
  const [copied, setCopied] = useState<Kind | null>(null);
  const [confirming, setConfirming] = useState<Kind | null>(null);
  const [resetting, setResetting] = useState<Kind | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  function linkFor(kind: Kind) {
    const code = invites?.[kind];
    return code ? `${window.location.origin}/room/${roomId}?invite=${code}` : "";
  }

  function handleCopy(kind: Kind) {
    const link = linkFor(kind);
    if (!link) return;
    void navigator.clipboard.writeText(link);
    setCopied(kind);
  }

  async function handleReset(kind: Kind) {
    if (confirming !== kind) {
      setConfirming(kind);
      return;
    }
    setConfirming(null);
    setResetting(kind);
    try {
      await onReset(kind);
    } finally {
      setResetting(null);
    }
  }

  return (
    <motion.div
      role="dialog"
      aria-label="Invite people"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.18 }}
      className="w-full rounded-t-xl border border-ink-800 bg-ink-900 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-raised sm:max-w-md sm:rounded-xl sm:pb-5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-700 sm:hidden" />
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-100">Invite people</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mb-4 text-xs text-ink-500">Anyone who opens a link joins with that role.</p>

      <div className="space-y-3">
        {LINKS.map(({ kind, title, detail, icon: Icon }) => (
          <div key={kind} className="rounded-xl border border-ink-800 bg-ink-950/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-ink-700 bg-ink-900">
                  <Icon className="h-3.5 w-3.5 text-ink-300" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink-100">{title}</div>
                  <div className="text-xs text-ink-500">{detail}</div>
                </div>
              </div>
              {canReset && (
                <button
                  onClick={() => void handleReset(kind)}
                  disabled={resetting !== null}
                  title="Make a new link. The old one stops working; people already in the room stay."
                  className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                    confirming === kind ? "bg-danger-soft text-danger" : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"
                  }`}
                >
                  <RotateCcw className={`h-3 w-3 ${resetting === kind ? "animate-spin" : ""}`} />
                  {confirming === kind ? "Old link stops working" : "Reset"}
                </button>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                readOnly
                value={linkFor(kind)}
                aria-label={`${title} link`}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 truncate rounded-md border border-ink-800 bg-ink-900 px-2.5 py-1.5 font-[family-name:var(--font-mono)] text-[11px] text-ink-300 focus:border-ink-600 focus:outline-none"
              />
              <button
                onClick={() => handleCopy(kind)}
                disabled={!invites}
                className="flex shrink-0 items-center gap-1.5 rounded-md bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-950 transition-colors hover:bg-ink-200 disabled:opacity-50"
              >
                {copied === kind ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === kind ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
        People already in the room keep their access. Change roles or remove people on the People tab.
      </p>
    </motion.div>
  );
}