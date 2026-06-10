/**
 * SafeSection Component
 *
 * Wraps a section with error boundary + loading/error states.
 * Safe wrapper for charts, viewers, analytics, and risky third-party widgets.
 *
 * Features:
 * - Catches render errors automatically
 * - Shows loading state while data loads
 * - Shows error state if loading fails
 * - Shows error fallback if component crashes
 * - Retry button for all error types
 *
 * Usage:
 * <SafeSection
 *   name="Dashboard Analytics"
 *   isLoading={loading}
 *   error={error}
 *   onRetry={refetch}
 * >
 *   <Analytics data={data} />
 * </SafeSection>
 */

import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";

interface SafeSectionProps {
  children: ReactNode;
  name: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
  minHeight?: string;
}

/**
 * Renders a section protected by error boundaries
 * Handles: loading state, API errors, render crashes
 */
export function SafeSection({
  children,
  name,
  isLoading = false,
  error = null,
  onRetry,
  className = "",
  minHeight = "min-h-[200px]",
}: SafeSectionProps) {
  // Show loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${minHeight} ${className}`}>
        <LoadingState />
      </div>
    );
  }

  // Show API/data loading error
  if (error) {
    return (
      <div className={`${minHeight} ${className}`}>
        <ErrorState
          message={`${name} failed to load`}
          detail={error}
          variant="generic"
          onRetry={onRetry}
        />
      </div>
    );
  }

  // Wrap in error boundary to catch render crashes
  return (
    <ErrorBoundary
      name={name}
      onReset={onRetry}
      onError={(error) => {
        console.error(`${name} crashed:`, error);
      }}
      fallback={(error) => (
        <div
          className={`flex flex-col items-center justify-center ${minHeight} px-4 bg-rose-900/10 border border-rose-500/20 rounded-lg ${className}`}
        >
          <AlertTriangle className="w-6 h-6 text-rose-400 mb-2" />
          <p className="text-sm font-semibold text-rose-300 mb-1">{name} Error</p>
          <p className="text-xs text-rose-300/70 text-center mb-4 max-w-sm">{error.message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
