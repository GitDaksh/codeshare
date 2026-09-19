"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { useApi } from "@/lib/api";

type UsernameInputProps = {
  value: string;
  onChange: (value: string) => void;
  onValidityChange: (valid: boolean) => void;
};

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

type Status = "idle" | "checking" | "available" | "taken" | "invalid";

export function UsernameInput({ value, onChange, onValidityChange }: UsernameInputProps) {
  const api = useApi();
  const [status, setStatus] = useState<Status>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();

    if (!trimmed) {
      setStatus("idle");
      onValidityChange(false);
      return;
    }

    if (!USERNAME_PATTERN.test(trimmed)) {
      setStatus("invalid");
      onValidityChange(false);
      return;
    }

    setStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get<{ available: boolean }>(
          `/api/profile/username-available?username=${encodeURIComponent(trimmed)}`
        );
        setStatus(res.data.available ? "available" : "taken");
        onValidityChange(res.data.available);
      } catch {
        setStatus("idle");
        onValidityChange(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const icon = {
    idle: null,
    checking: <Loader2 className="h-4 w-4 animate-spin text-ink-500" />,
    available: <Check className="h-4 w-4 text-ink-100" />,
    taken: <X className="h-4 w-4 text-red-400" />,
    invalid: <X className="h-4 w-4 text-red-400" />,
  }[status];

  const helper = {
    idle: "3-20 characters: lowercase letters, numbers, underscores.",
    checking: "Checking availability…",
    available: "Username available.",
    taken: "That username is already taken.",
    invalid: "3-20 characters: lowercase letters, numbers, underscores only.",
  }[status];

  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500">
          @
        </span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          placeholder="username"
          maxLength={20}
          autoFocus
          className="w-full rounded-md border border-ink-700 bg-ink-950 py-2.5 pl-7 pr-9 text-sm text-ink-100 placeholder:text-ink-600 focus:border-ink-500 focus:outline-none"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2">{icon}</span>
      </div>
      <p
        className={`mt-1.5 text-xs ${
          status === "taken" || status === "invalid" ? "text-red-400" : "text-ink-500"
        }`}
      >
        {helper}
      </p>
    </div>
  );
}