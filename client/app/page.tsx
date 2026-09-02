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
      <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Link
          href="/register"
          className="w-full rounded-md bg-neutral-100 px-5 py-2.5 text-center text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-200 sm:w-auto"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="w-full rounded-md border border-neutral-700 px-5 py-2.5 text-center text-sm font-medium transition-colors hover:border-neutral-500 sm:w-auto"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}