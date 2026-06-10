import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

interface TableSkeletonProps {
  columns: number;
  rows?: number;
  className?: string;
}

export function TableSkeleton({ columns, rows = 5, className = "" }: TableSkeletonProps) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
      role="status"
      aria-label="Loading table"
    >
      <div className="w-full">
        <div className="flex gap-4 border-b border-border bg-muted/50 px-4 py-3">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn("h-3.5", i === 0 ? "w-1/4" : "w-1/6")}
            />
          ))}
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="flex min-h-10 items-center gap-4 px-4 py-3">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton
                  key={colIndex}
                  className={cn(
                    "h-3.5",
                    colIndex === 0 ? "w-1/3" : colIndex === columns - 1 ? "w-12 ml-auto" : "w-1/6",
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading table data</span>
    </div>
  );
}
