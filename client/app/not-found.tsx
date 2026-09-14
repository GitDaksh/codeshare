import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-[family-name:var(--font-mono)] text-5xl text-ink-700">404</p>
      <h1 className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink-100">
        Page not found
      </h1>
      <p className="max-w-sm text-sm text-ink-500">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 transition-colors hover:border-ink-500"
      >
        Back home
      </Link>
    </main>
  );
}