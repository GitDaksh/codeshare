"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ui } from "@/lib/ui";

// Join a friend's game by its 6-character code.
export function JoinCode({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const valid = /^[A-HJ-NP-Z2-9]{6}$/.test(code);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (valid) router.push(`/games/play/${code}`);
  }

  return (
    <form onSubmit={submit} className={`flex items-center gap-2 ${className}`}>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
        placeholder="Game code"
        aria-label="Game code"
        spellCheck={false}
        autoComplete="off"
        className={`${ui.input} w-36 font-[family-name:var(--font-mono)] uppercase tracking-[0.2em] placeholder:font-[family-name:var(--font-display)] placeholder:tracking-normal placeholder:normal-case`}
      />
      <button type="submit" disabled={!valid} className={ui.secondary}>
        Join
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
