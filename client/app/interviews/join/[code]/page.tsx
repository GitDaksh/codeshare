"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Link2Off, Loader2 } from "lucide-react";
import { useApi } from "@/lib/api";
import type { Profile } from "@/types/profile";

// An interview invite link: joins you as the candidate, an interviewer or an
// observer, then opens the interview's room. New people set up a profile
// first (and come straight back here).
export default function JoinInterviewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const api = useApi();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const triedRef = useRef(false);

  useEffect(() => {
    document.title = "Joining an interview — CodeShare";
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || triedRef.current) return;
    triedRef.current = true;
    const here = `/interviews/join/${encodeURIComponent(code)}`;
    api
      .get<Profile>("/api/profile")
      .then((res) => {
        if (!res.data.username) {
          router.replace(`/onboarding?next=${encodeURIComponent(here)}`);
          return null;
        }
        return api.post<{ roomId: string }>("/api/interviews/join", { code });
      })
      .then((res) => {
        if (res) router.replace(`/room/${res.data.roomId}`);
      })
      .catch((err) => setError(err?.response?.data?.error ?? "This link doesn't work."));
  }, [api, code, isLoaded, isSignedIn, router]);

  return (
    <main className="flex min-h-[calc(100dvh-56px)] flex-col items-center justify-center gap-3 px-4 text-center">
      {error ? (
        <>
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-ink-700 bg-ink-900">
            <Link2Off className="h-5 w-5 text-ink-300" />
          </div>
          <p className="font-semibold text-ink-100">{error}</p>
          <p className="max-w-xs text-sm text-ink-400">
            Check that you&apos;re signed in with the right account, or ask whoever sent you the link for a new one.
          </p>
          <Link
            href="/interviews"
            className="mt-2 inline-flex h-9 items-center rounded-full border border-ink-700 bg-ink-900 px-4 text-sm text-ink-100 transition-colors hover:border-ink-500"
          >
            Go to Interviews
          </Link>
        </>
      ) : (
        <>
          <Loader2 className="h-5 w-5 animate-spin text-ink-400" />
          <p className="text-sm text-ink-400">Joining the interview…</p>
        </>
      )}
    </main>
  );
}