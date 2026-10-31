import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <div className="space-y-8" aria-label="Loading workspace">
      <Skeleton className="h-12 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
