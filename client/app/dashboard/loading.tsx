import { Skeleton } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <Skeleton className="mb-6 h-7 w-32" />
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-lg border border-neutral-800 p-4">
            <Skeleton className="mb-2 h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </main>
  );
}