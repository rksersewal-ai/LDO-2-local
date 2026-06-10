/**
 * TableSafeWrapper Component
 *
 * Wraps table sections with crash protection:
 * - Loading state handling
 * - Error boundary isolation (prevents table crashes from taking down page)
 * - Retry mechanism for failed table loads
 * - Graceful degradation with empty state
 *
 * Usage:
 *   <TableSafeWrapper
 *     isLoading={loading}
 *     error={error}
 *     onRetry={refetch}
 *     itemCount={items.length}
 *     name="WorkLedgerTable"
 *   >
 *     <table>...</table>
 *   </TableSafeWrapper>
 */

import { ErrorBoundary } from "./ErrorBoundary";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";

interface TableSafeWrapperProps {
  children: React.ReactNode;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void | Promise<void>;
  itemCount?: number;
  emptyMessage?: string;
  name: string;
  minHeight?: string;
}

/**
 * Safe table rendering with error isolation and recovery
 */
export function TableSafeWrapper({
  children,
  isLoading,
  error,
  onRetry,
  itemCount = 0,
  emptyMessage = "No items to display",
  name,
  minHeight = "min-h-[300px]",
}: TableSafeWrapperProps) {
  const showLoading = isLoading && itemCount === 0;

  return (
    <ErrorBoundary name={name}>
      <div className={minHeight}>
        {showLoading ? (
          <LoadingState message="Loading data..." />
        ) : error ? (
          <ErrorState
            variant="server"
            message={`Failed to load ${name}`}
            onRetry={onRetry}
            detail={error?.message}
          />
        ) : itemCount === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">{emptyMessage}</p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-xs text-primary hover:text-primary/90 transition-colors"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </ErrorBoundary>
  );
}
