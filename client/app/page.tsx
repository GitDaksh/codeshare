import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col items-center justify-center px-4 py-32 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Code together, in real time.
      </h1>
      <p className="mt-4 max-w-xl text-neutral-400">
        Create a room, share the link, and edit code with your team live —
        no setup, no friction.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/register"
          className="rounded-md bg-neutral-100 px-5 py-2.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-200"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-neutral-700 px-5 py-2.5 text-sm font-medium transition-colors hover:border-neutral-500"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}