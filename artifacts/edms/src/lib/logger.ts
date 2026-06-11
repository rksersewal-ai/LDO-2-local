/**
 * Structured Frontend Logger
 *
 * Provides consistent, structured logging for the EDMS frontend.
 * In production, logs can be piped to a backend endpoint or third-party
 * service (Sentry, Datadog, etc.) by replacing the transport.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("Document loaded", { docId: "DOC-001", size: 1024 });
 *   logger.error("Upload failed", { error, retryCount: 3 });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  /** Stack trace for errors */
  stack?: string;
}

type LogTransport = (entry: LogEntry) => void;

// ─── Default Console Transport ────────────────────────────────────────────────

const consoleTransport: LogTransport = (entry) => {
  const prefix = `[${entry.level.toUpperCase()}] ${entry.timestamp}`;
  const args: unknown[] = [prefix, entry.message];
  if (entry.context) args.push(entry.context);

  switch (entry.level) {
    case "debug":
      console.debug(...args);
      break;
    case "info":
      console.info(...args);
      break;
    case "warn":
      console.warn(...args);
      break;
    case "error":
      console.error(...args);
      if (entry.stack) console.error(entry.stack);
      break;
  }
};

// ─── Logger Class ─────────────────────────────────────────────────────────────

class Logger {
  private transports: LogTransport[] = [consoleTransport];
  private minLevel: LogLevel = import.meta.env.PROD ? "info" : "debug";

  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  /** Add a custom transport (e.g., Sentry, backend API) */
  addTransport(transport: LogTransport) {
    this.transports.push(transport);
  }

  /** Set minimum log level */
  setMinLevel(level: LogLevel) {
    this.minLevel = level;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    if (this.levelPriority[level] < this.levelPriority[this.minLevel]) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    if (level === "error" && context?.error instanceof Error) {
      entry.stack = context.error.stack;
    }

    for (const transport of this.transports) {
      try {
        transport(entry);
      } catch {
        // Transport failure should never crash the app
      }
    }
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log("debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.log("error", message, context);
  }
}

/** Singleton logger instance */
export const logger = new Logger();

// ─── Error Reporting ──────────────────────────────────────────────────────────

/**
 * Report an error to the observability stack.
 * This is a convenience wrapper that integrates with the logger and can be
 * extended to send errors to Sentry, Datadog, or a custom backend.
 *
 * Usage:
 *   reportError(error, { component: "DocumentUpload", action: "upload" });
 */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  const err = error instanceof Error ? error : new Error(String(error));

  logger.error(err.message, {
    ...context,
    error: err,
    errorName: err.name,
  });

  // TODO: Wire to Sentry when configured
  // if (window.__SENTRY__) {
  //   Sentry.captureException(err, { extra: context });
  // }
}

// ─── Performance Metrics ──────────────────────────────────────────────────────

/**
 * Report Web Vitals metrics.
 * Call this from the app entry point to capture CLS, LCP, FID, etc.
 *
 * Usage (in main.tsx):
 *   import { reportWebVitals } from "@/lib/logger";
 *   reportWebVitals();
 */
export function reportWebVitals() {
  if (typeof window === "undefined") return;

  // Use the Performance Observer API for Core Web Vitals
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        logger.info(`[WebVital] ${entry.entryType}`, {
          name: entry.name,
          value: entry.startTime,
          duration: "duration" in entry ? (entry as PerformanceEntry & { duration: number }).duration : undefined,
        });
      }
    });

    observer.observe({ type: "largest-contentful-paint", buffered: true });
    observer.observe({ type: "layout-shift", buffered: true });
    observer.observe({ type: "first-input", buffered: true });
  } catch {
    // PerformanceObserver not supported in test environment
  }
}
