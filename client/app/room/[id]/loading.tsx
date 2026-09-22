import { Skeleton } from "@/components/Skeleton";

export default function RoomLoading() {
  return (
    <main className="flex h-[calc(100vh-56px)] flex-col">
      <div className="flex items-center justify-between border-b border-ink-800 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-7 w-20 rounded-lg" />
        </div>
      </div>
      <div className="flex flex-1">
        <Skeleton className="flex-1 rounded-none" />
        <div className="hidden w-72 shrink-0 border-l border-ink-800 bg-ink-900/40 p-3 md:block">
          <Skeleton className="mb-3 h-9 w-full rounded-lg" />
          <div className="space-y-3">
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
    </main>
  );
}