/**
 * ErrorBoundary Component
 *
 * Class component that catches JavaScript errors in child components.
 * Prevents full-page crashes from risky widgets (charts, viewers, third-party).
 *
 * Usage:
 * <ErrorBoundary name="ChartWidget" onError={console.error}>
 *   <ExpensiveChart data={data} />
 * </ErrorBoundary>
 */

import { AlertTriangle } from "lucide-react";
import React, { type ReactNode } from "react";
import { reportError } from "@/lib/logger";

interface ErrorBoundaryProps {
  children: ReactNode;
  name: string;
  fallback?: (error: Error) => ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Report to observability stack
    reportError(error, {
      component: this.props.name,
      componentStack: errorInfo.componentStack ?? undefined,
    });

    // Call user-provided error handler
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback && this.state.error) {
        return this.props.fallback(this.state.error);
      }

      // Default error UI — theme-aware using semantic status tokens
      return (
        <div className="flex flex-col items-center justify-center py-8 px-4 bg-[color:var(--status-danger)]/10 border border-[color:var(--status-danger)]/20 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-[color:var(--status-danger)] flex-shrink-0" />
            <h3 className="text-sm font-semibold text-[color:var(--status-danger)]">
              {this.props.name} encountered an error
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4 max-w-md text-center">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[color:var(--status-danger)]/15 hover:bg-[color:var(--status-danger)]/25 text-[color:var(--status-danger)] border border-[color:var(--status-danger)]/30 transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
