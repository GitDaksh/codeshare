import { Skeleton } from "@/components/Skeleton";
import { PageContainer } from "@/components/PageHeader";

// Mirrors the dashboard's layout (header, rooms list, summary column), so
// nothing jumps when the data arrives.
export function DashboardSkeleton() {
  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Skeleton className="h-9 w-64 max-w-full rounded-lg" />
            <Skeleton className="hidden h-9 w-56 rounded-lg sm:block" />
          </div>
          <div className="divide-y divide-ink-800 overflow-hidden rounded-xl border border-ink-800 bg-ink-900 shadow-xs">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3.5 px-5 py-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-2.5 w-28" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-[300px] rounded-xl border border-ink-800 bg-ink-900 shadow-xs" />
          <div className="h-[280px] rounded-xl border border-ink-800 bg-ink-900 shadow-xs" />
        </div>
      </div>
    </PageContainer>
  );
}