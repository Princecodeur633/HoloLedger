import { cn } from "@/lib/utils";

/** Grey pulsing placeholder shown where content is about to appear. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("bg-muted animate-pulse rounded-md", className)} />;
}

/** Rows shaped like a list item (icon, two lines, amount). */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Chargement" className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Placeholder with the dashboard's layout: balance card, three stats, a list. */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Chargement" className="flex flex-col gap-5">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-28 rounded-2xl" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-18 rounded-xl" />
        <Skeleton className="h-18 rounded-xl" />
        <Skeleton className="h-18 rounded-xl" />
      </div>
      <Skeleton className="h-52 rounded-xl" />
      <ListSkeleton rows={4} />
    </div>
  );
}
