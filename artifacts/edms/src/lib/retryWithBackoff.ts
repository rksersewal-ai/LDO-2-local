/**
 * Retry with Exponential Backoff
 *
 * Provides a retry mechanism with exponential backoff and jitter
 * to handle transient failures while preventing thundering herd problems.
 *
 * Config alignment: config/ocr_pipeline.yaml
 *   retry_count: 3 (default max retries)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RetryOptions {
  /** Maximum number of retries. Default: 3 (from ocr_pipeline.yaml retry_count) */
  maxRetries?: number;
  /** Base delay in milliseconds before first retry. Default: 1000 */
  baseDelay?: number;
  /** Maximum delay in milliseconds between retries. Default: 30000 */
  maxDelay?: number;
  /** Backoff multiplier applied to each successive retry. Default: 2 */
  backoffFactor?: number;
  /** Predicate to determine if a retry should be attempted. Default: always retry */
  retryCondition?: (error: unknown, attempt: number) => boolean;
  /** Optional callback invoked before each retry */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

export interface RetryResult<T> {
  /** The resolved value (undefined if all retries failed) */
  data?: T;
  /** Whether the operation succeeded */
  success: boolean;
  /** Total number of attempts made (1 = no retries needed) */
  attempts: number;
  /** Total time spent in milliseconds */
  totalTimeMs: number;
  /** The last error if all attempts failed */
  error?: unknown;
}

// ─── Constants (aligned with config/ocr_pipeline.yaml) ────────────────────────

/** Default max retries from ocr_pipeline.yaml retry_count */
export const DEFAULT_MAX_RETRIES = 3;

/** Default base delay: 1 second */
export const DEFAULT_BASE_DELAY = 1000;

/** Default max delay: 30 seconds */
export const DEFAULT_MAX_DELAY = 30_000;

/** Default backoff factor */
export const DEFAULT_BACKOFF_FACTOR = 2;

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Calculate the delay for a given attempt using exponential backoff with jitter.
 * Jitter prevents thundering herd by randomizing delay within 0-100% of calculated value.
 *
 * @param attempt - The attempt number (0-indexed)
 * @param baseDelay - Base delay in milliseconds
 * @param backoffFactor - Exponential multiplier
 * @param maxDelay - Maximum cap for the delay
 * @returns The calculated delay with jitter applied
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelay: number = DEFAULT_BASE_DELAY,
  backoffFactor: number = DEFAULT_BACKOFF_FACTOR,
  maxDelay: number = DEFAULT_MAX_DELAY,
): number {
  // Exponential delay: baseDelay * (backoffFactor ^ attempt)
  const exponentialDelay = baseDelay * Math.pow(backoffFactor, attempt);
  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  // Apply full jitter: random value between 0 and cappedDelay
  const jitter = Math.random() * cappedDelay;
  return Math.floor(jitter);
}

/**
 * Retry a function with exponential backoff.
 *
 * The function will be called up to (maxRetries + 1) times total. Between each
 * retry, it waits with exponential backoff and jitter.
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @returns RetryResult with outcome, attempt count, and timing
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<RetryResult<T>> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelay = options?.baseDelay ?? DEFAULT_BASE_DELAY;
  const maxDelay = options?.maxDelay ?? DEFAULT_MAX_DELAY;
  const backoffFactor = options?.backoffFactor ?? DEFAULT_BACKOFF_FACTOR;
  const retryCondition = options?.retryCondition;
  const onRetry = options?.onRetry;

  const startTime = Date.now();
  let lastError: unknown;
  let attemptsMade = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attemptsMade = attempt + 1;
    try {
      const data = await fn();
      return {
        data,
        success: true,
        attempts: attemptsMade,
        totalTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error;

      // Check if we've exhausted retries
      if (attempt >= maxRetries) {
        break;
      }

      // Check retry condition
      if (retryCondition && !retryCondition(error, attempt + 1)) {
        break;
      }

      // Calculate delay and wait
      const delay = calculateBackoffDelay(attempt, baseDelay, backoffFactor, maxDelay);

      if (onRetry) {
        onRetry(error, attempt + 1, delay);
      }

      await sleep(delay);
    }
  }

  return {
    success: false,
    attempts: attemptsMade,
    totalTimeMs: Date.now() - startTime,
    error: lastError,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
