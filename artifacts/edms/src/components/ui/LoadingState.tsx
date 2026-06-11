/**
 * LoadingState — Section/page-level loading indicator with message.
 *
 * Use this when an entire section, card, or page is loading data.
 * Provides a centered spinner with optional message text.
 *
 * For inline/button-level loading, use `<Spinner />` instead.
 *
 * @example
 * if (isLoading) return <LoadingState message="Loading documents..." />;
 */
interface LoadingStateProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingState({
  message = "Loading...",
  size = "md",
  className = "",
}: LoadingStateProps) {
  const sizeClasses = {
    sm: "py-6",
    md: "py-10",
    lg: "py-14",
  };

  const spinnerSizes = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${sizeClasses[size]} ${className}`}
    >
      <div className={`${spinnerSizes[size]} relative`}>
        <div className={`absolute inset-0 rounded-full border-2 border-border`} />
        <div
          className={`absolute inset-0 rounded-full border-2 border-transparent border-t-primary`}
          style={{ animation: "spin 0.8s linear infinite" }}
        />
      </div>
      {message && <p className="text-xs font-medium text-muted-foreground">{message}</p>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function LoadingRows({ count = 5, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-9 animate-pulse rounded-md bg-secondary"
          style={{ opacity: 1 - i * 0.15 }}
        />
      ))}
    </div>
  );
}

export function LoadingCard({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse space-y-2 rounded-md bg-secondary p-3 ${className}`}>
      <div className="h-4 bg-muted/60 rounded w-3/4" />
      <div className="h-3 bg-muted/40 rounded w-1/2" />
      <div className="h-3 bg-muted/30 rounded w-2/3" />
    </div>
  );
}
