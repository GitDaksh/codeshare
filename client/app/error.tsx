"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[calc(100dvh-56px)] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-[family-name:var(--font-mono)] text-5xl text-ink-700">500</p>
      <h1 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink-100">
        Something went wrong
      </h1>
      <p className="max-w-sm text-sm text-ink-500">
        An unexpected error occurred. You can try again, or head back home.
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-md bg-ink-100 px-4 py-2 text-sm font-medium text-ink-950 transition-colors hover:bg-white"
      >
        Try again
      </button>
    </main>
  );
}