import { AlertTriangle, RefreshCw, ServerCrash, WifiOff } from "lucide-react";

interface ErrorStateProps {
  message?: string;
  detail?: string;
  variant?: "network" | "server" | "notfound" | "generic";
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  message,
  detail,
  variant = "generic",
  onRetry,
  className = "",
}: ErrorStateProps) {
  const icons = {
    network: <WifiOff className="w-8 h-8 text-[color:var(--status-warning)]" />,
    server: <ServerCrash className="w-8 h-8 text-[color:var(--status-danger)]" />,
    notfound: <AlertTriangle className="w-8 h-8 text-muted-foreground" />,
    generic: <AlertTriangle className="w-8 h-8 text-[color:var(--status-danger)]" />,
  };

  const defaultMessages = {
    network: "Connection Error",
    server: "Server Error",
    notfound: "Not Found",
    generic: "Something Went Wrong",
  };

  const defaultDetails = {
    network: "Unable to reach the server. Check your connection and try again.",
    server: "The server returned an unexpected error. Please try again.",
    notfound: "The requested resource could not be found.",
    generic: "An unexpected error occurred. Please try again.",
  };

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-10 text-center ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-card shadow-[var(--shadow-card)]">
        {icons[variant]}
      </div>
      <div>
        <p className="text-foreground font-semibold mb-1">{message ?? defaultMessages[variant]}</p>
        <p className="mx-auto max-w-sm text-xs text-muted-foreground">
          {detail ?? defaultDetails[variant]}
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex h-8 items-center gap-2 rounded-md border border-border bg-secondary px-3 text-xs font-medium text-foreground/90 transition-colors hover:bg-muted hover:text-foreground"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      )}
    </div>
  );
}

export function InlineError({ message, className = "" }: { message: string; className?: string }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md border border-[color:var(--status-danger)]/20 bg-[color:var(--status-danger)]/10 px-3 py-2 text-xs text-[color:var(--status-danger)] ${className}`}
    >
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}
