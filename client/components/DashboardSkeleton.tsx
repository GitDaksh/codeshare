import { Skeleton } from "@/components/Skeleton";

export function RoomCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
      <div className="h-32 space-y-2.5 border-b border-ink-800 bg-black/50 p-4">
        <Skeleton className="h-2.5 w-3/4" />
        <Skeleton className="h-2.5 w-1/2" />
        <Skeleton className="h-2.5 w-5/6" />
        <Skeleton className="h-2.5 w-2/5" />
      </div>
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

// Mirrors the real dashboard layout (including its background) so there's no
// jump when data arrives.
export function DashboardSkeleton() {
  return (
    <main className="relative overflow-hidden">
      <div className="hero-grid pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-70" />
      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full sm:h-14 sm:w-14" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-48" />
          </div>
        </div>
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
          <div className="min-w-0">
            <div className="h-12 w-full rounded-2xl border border-ink-700 bg-ink-900" />
            <Skeleton className="mt-10 h-6 w-32" />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <RoomCardSkeleton key={i} />
              ))}
            </div>
          </div>
          <div className="grid content-start gap-3 md:grid-cols-2 lg:grid-cols-1">
            <div className="h-[320px] rounded-2xl border border-ink-700 bg-ink-900" />
            <div className="h-[305px] rounded-2xl border border-ink-700 bg-ink-900" />
            <div className="h-[303px] rounded-2xl border border-ink-700 bg-ink-900 md:col-span-2 lg:col-span-1" />
          </div>
        </div>
      </div>
    </main>
  );
}