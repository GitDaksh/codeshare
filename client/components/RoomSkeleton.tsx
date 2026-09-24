import { Skeleton } from "@/components/Skeleton";

// Mirrors the real room layout (floating panels on desktop, full-bleed on
// phones) so there's no jump when the room finishes loading.
export function RoomSkeleton() {
  return (
    <main className="flex h-dvh flex-col bg-ink-950 md:h-[calc(100dvh-56px)]">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-ink-800 px-2 sm:px-3 md:border-transparent">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-4 w-28 sm:w-36" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="hidden h-8 w-28 rounded-lg md:block" />
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 md:px-2 md:pb-2">
        <div className="flex min-w-0 flex-1 flex-col bg-ink-900 md:overflow-hidden md:rounded-xl md:border md:border-ink-800">
          <div className="flex-1 space-y-3 p-6">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <div className="h-7 border-t border-ink-800 bg-ink-950/60" />
        </div>

        <div className="hidden w-2 shrink-0 md:block" />

        <div className="hidden w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-ink-800 bg-ink-900 p-2 md:flex">
          <Skeleton className="h-9 w-full rounded-lg" />
          <div className="mt-5 space-y-5 px-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex h-14 shrink-0 items-center justify-around border-t border-ink-800 md:hidden">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-5 w-5 rounded" />
        ))}
      </div>
    </main>
  );
}