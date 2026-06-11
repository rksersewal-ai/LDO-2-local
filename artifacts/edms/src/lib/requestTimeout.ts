/**
 * Request Timeout Wrapper
 *
 * Wraps any Promise with a configurable timeout to prevent hung operations.
 * Integrates with the fetch API pattern using AbortController.
 *
 * Config alignment: config/ocr_pipeline.yaml
 *   ocr_timeout_seconds: 300 (5 minutes for OCR requests)
 *   Default timeout: 30s for normal requests
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimeoutController {
  controller: AbortController;
  signal: AbortSignal;
  /** Clear the timeout timer (call if the operation completes before timeout) */
  clear: () => void;
}

export class TimeoutError extends Error {
  public readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number) {
    super(message);
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

// ─── Constants (aligned with config/ocr_pipeline.yaml) ────────────────────────

/** Default timeout for normal requests: 30 seconds */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** OCR request timeout: 300 seconds (from ocr_pipeline.yaml ocr_timeout_seconds) */
export const OCR_TIMEOUT_MS = 300_000;

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Wrap a promise with a timeout. If the promise does not resolve or reject
 * within the specified time, it rejects with a TimeoutError.
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @param errorMessage - Custom error message for the timeout
 * @returns The resolved value of the promise
 * @throws TimeoutError if the promise does not settle within timeoutMs
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  errorMessage?: string,
): Promise<T> {
  if (timeoutMs <= 0) {
    return promise;
  }

  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const msg = errorMessage ?? `Operation timed out after ${timeoutMs}ms`;
      reject(new TimeoutError(msg, timeoutMs));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

/**
 * Create a timeout controller for use with fetch or other AbortSignal-based APIs.
 * The controller automatically aborts after the specified timeout.
 *
 * Usage:
 *   const { signal, clear } = createTimeoutController(5000);
 *   const response = await fetch(url, { signal });
 *   clear(); // Cancel the timeout if fetch completed
 *
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns TimeoutController with controller, signal, and clear function
 */
export function createTimeoutController(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): TimeoutController {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort(new TimeoutError(`Request aborted after ${timeoutMs}ms`, timeoutMs));
  }, timeoutMs);

  return {
    controller,
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}
