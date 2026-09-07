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
    <main className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-[family-name:var(--font-mono)] text-5xl text-neutral-700">500</p>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-neutral-500">
        An unexpected error occurred. You can try again, or head back home.
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-200"
      >
        Try again
      </button>
    </main>
  );
}