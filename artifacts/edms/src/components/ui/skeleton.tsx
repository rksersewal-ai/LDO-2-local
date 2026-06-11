import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

function TableSkeleton({
  columns = 6,
  rows = 8,
  className,
}: {
  columns?: number;
  rows?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading table"
      className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}
    >
      <div
        className="grid gap-3 border-b border-border bg-muted/50 p-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={`header-${index}`} className="h-3" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="grid min-h-10 items-center gap-3 p-3"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((_, columnIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${columnIndex}`}
                className={cn("h-3", columnIndex === 0 && "w-4/5", columnIndex > 2 && "w-2/3")}
              />
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">Loading table data</span>
    </div>
  );
}

function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading card"
      className={cn("rounded-lg border border-border bg-card p-4", className)}
    >
      <Skeleton className="mb-4 h-4 w-2/5" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <span className="sr-only">Loading card content</span>
    </div>
  );
}

function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-label="Loading list" className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={`list-${index}`}
          className="flex min-h-10 items-center gap-3 rounded-lg border border-border bg-card p-3"
        >
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading list content</span>
    </div>
  );
}

function PageSkeleton({ className }: { className?: string }) {
  return (
    <div role="status" aria-label="Loading page" className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <TableSkeleton rows={6} />
      <span className="sr-only">Loading page content</span>
    </div>
  );
}

export { CardSkeleton, ListSkeleton, PageSkeleton, Skeleton, TableSkeleton };
