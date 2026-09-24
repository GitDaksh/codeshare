import { Skeleton } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center gap-3 sm:mb-8">
        <Skeleton className="h-10 w-10 rounded-full sm:h-12 sm:w-12" />
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-2 sm:mb-8 sm:grid-cols-4 sm:gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-lg border border-ink-800 p-4">
            <Skeleton className="mb-2 h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </main>
  );
}