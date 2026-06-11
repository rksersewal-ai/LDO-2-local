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
    network: <WifiOff className="w-8 h-8 text-amber-400" />,
    server: <ServerCrash className="w-8 h-8 text-rose-400" />,
    notfound: <AlertTriangle className="w-8 h-8 text-muted-foreground" />,
    generic: <AlertTriangle className="w-8 h-8 text-rose-400" />,
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
      className={`flex flex-col items-center justify-center py-16 gap-4 text-center ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center">
        {icons[variant]}
      </div>
      <div>
        <p className="text-foreground font-semibold mb-1">{message ?? defaultMessages[variant]}</p>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          {detail ?? defaultDetails[variant]}
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary/60 hover:bg-secondary/60 text-foreground/90 text-sm font-medium border border-border transition-colors"
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
      className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-900/20 border border-rose-500/20 text-rose-300 text-sm ${className}`}
    >
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}
