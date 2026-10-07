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
    available: <Check className="h-4 w-4 text-success" />,
    taken: <X className="h-4 w-4 text-danger" />,
    invalid: <X className="h-4 w-4 text-danger" />,
  }[status];

  const helper = {
    idle: "3-20 characters: lowercase letters, numbers, underscores.",
    checking: "Checking availability…",
    available: "Nice, that username is available.",
    taken: "That username is already taken.",
    invalid: "3-20 characters: lowercase letters, numbers, underscores only.",
  }[status];

  const isError = status === "taken" || status === "invalid";

  const borderClass = isError
    ? "border-danger-line"
    : status === "available"
      ? "border-success-line"
      : "border-ink-700";

  return (
    <div>
      <div
        className={`relative flex h-11 items-center rounded-lg border bg-ink-900 shadow-xs transition-colors focus-within:border-ink-500 focus-within:ring-4 focus-within:ring-ink-100/[0.06] ${borderClass}`}
      >
        <span className="pointer-events-none pl-4 text-ink-500">@</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          placeholder="username"
          maxLength={20}
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-full min-w-0 flex-1 bg-transparent pl-1 pr-10 text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none"
        />
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2">{icon}</span>
      </div>
      <p className={`mt-2 text-xs transition-colors ${isError ? "text-danger" : status === "available" ? "text-success" : "text-ink-500"}`}>
        {helper}
      </p>
    </div>
  );
}