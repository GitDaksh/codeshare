"use client";

import { createContext, useCallback, useContext, useState, type ReactNode, type ElementType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  toast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, ElementType> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const COLORS: Record<ToastType, string> = {
  success: "text-ink-100",
  error: "text-red-400",
  info: "text-ink-400",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(16).slice(2, 8);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Centered and raised on phones (clear of the room page's bottom tab
          bar); bottom-right corner on larger screens. */}
      <div className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:items-end">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = ICONS[t.type];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="pointer-events-auto flex max-w-full items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-4 py-2.5 text-sm text-ink-100 shadow-lg sm:max-w-sm"
              >
                <Icon className={`h-4 w-4 shrink-0 ${COLORS[t.type]}`} />
                <span className="min-w-0">{t.message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}