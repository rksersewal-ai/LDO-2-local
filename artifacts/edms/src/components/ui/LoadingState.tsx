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
    sm: "py-8",
    md: "py-16",
    lg: "py-24",
  };

  const spinnerSizes = {
    sm: "w-5 h-5",
    md: "w-8 h-8",
    lg: "w-12 h-12",
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
      {message && <p className="text-muted-foreground text-sm font-medium">{message}</p>}
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
          className="h-12 rounded-xl bg-secondary/40 animate-pulse"
          style={{ opacity: 1 - i * 0.15 }}
        />
      ))}
    </div>
  );
}

export function LoadingCard({ className = "" }: { className?: string }) {
  return (
    <div className={`p-4 rounded-xl bg-secondary/40 space-y-3 animate-pulse ${className}`}>
      <div className="h-4 bg-muted/60 rounded w-3/4" />
      <div className="h-3 bg-muted/40 rounded w-1/2" />
      <div className="h-3 bg-muted/30 rounded w-2/3" />
    </div>
  );
}
