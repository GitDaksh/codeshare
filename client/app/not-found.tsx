import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-[family-name:var(--font-mono)] text-5xl text-neutral-700">404</p>
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-neutral-500">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-md border border-neutral-700 px-4 py-2 text-sm transition-colors hover:border-neutral-500"
      >
        Back home
      </Link>
    </main>
  );
}