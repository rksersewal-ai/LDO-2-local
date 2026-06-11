/**
 * Safe Cleanup Utility
 *
 * Provides a cleanup scope that registers cleanup functions and executes
 * them in reverse order (LIFO). Individual cleanup failures are caught
 * and logged without aborting remaining cleanups.
 *
 * Implements try-finally pattern for resource management.
 *
 * Config alignment: config/ocr_pipeline.yaml
 *   cleanup_policy: on_success
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type CleanupFn = () => void | Promise<void>;

export interface CleanupError {
  /** Index of the cleanup function that failed */
  index: number;
  /** The error that occurred */
  error: unknown;
  /** Error message string */
  message: string;
}

export interface CleanupResult {
  /** Whether all cleanups completed without errors */
  success: boolean;
  /** Total number of registered cleanups */
  totalRegistered: number;
  /** Number of cleanups that executed successfully */
  successCount: number;
  /** Number of cleanups that failed */
  failureCount: number;
  /** Details of any failures */
  errors: CleanupError[];
}

export interface CleanupScope {
  /** Register a cleanup function to be called on dispose */
  register: (fn: CleanupFn) => void;
  /** Execute all registered cleanups in reverse order */
  cleanup: () => Promise<CleanupResult>;
  /** Alias for cleanup - disposes all resources */
  dispose: () => Promise<CleanupResult>;
  /** Number of registered cleanup functions */
  readonly size: number;
  /** Whether the scope has already been cleaned up */
  readonly disposed: boolean;
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Create a new cleanup scope for managing resources.
 *
 * Cleanup functions are executed in reverse registration order (LIFO),
 * matching the typical resource acquisition/release pattern.
 *
 * Usage:
 *   const scope = createCleanupScope();
 *   const tempFile = createTempFile();
 *   scope.register(() => deleteTempFile(tempFile));
 *   const connection = openConnection();
 *   scope.register(() => connection.close());
 *
 *   try {
 *     // ... do work ...
 *   } finally {
 *     await scope.cleanup();
 *   }
 *
 * @returns A CleanupScope instance
 */
export function createCleanupScope(): CleanupScope {
  const cleanups: CleanupFn[] = [];
  let isDisposed = false;

  const cleanup = async (): Promise<CleanupResult> => {
    if (isDisposed) {
      return {
        success: true,
        totalRegistered: 0,
        successCount: 0,
        failureCount: 0,
        errors: [],
      };
    }

    isDisposed = true;
    const totalRegistered = cleanups.length;
    let successCount = 0;
    const errors: CleanupError[] = [];

    // Execute in reverse order (LIFO)
    for (let i = cleanups.length - 1; i >= 0; i--) {
      try {
        await cleanups[i]();
        successCount++;
      } catch (error) {
        errors.push({
          index: i,
          error,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Clear the array after cleanup
    cleanups.length = 0;

    return {
      success: errors.length === 0,
      totalRegistered,
      successCount,
      failureCount: errors.length,
      errors,
    };
  };

  return {
    register(fn: CleanupFn): void {
      if (isDisposed) {
        throw new Error("Cannot register cleanup on a disposed scope");
      }
      cleanups.push(fn);
    },
    cleanup,
    dispose: cleanup,
    get size() {
      return cleanups.length;
    },
    get disposed() {
      return isDisposed;
    },
  };
}

/**
 * Execute a function with automatic cleanup on completion or error.
 *
 * This is a convenience wrapper that creates a scope, passes it to the
 * function, and ensures cleanup runs regardless of outcome.
 *
 * @param fn - Function that receives a cleanup scope and performs work
 * @returns The result of the function
 */
export async function withCleanup<T>(
  fn: (scope: CleanupScope) => Promise<T>,
): Promise<{ result?: T; error?: unknown; cleanup: CleanupResult }> {
  const scope = createCleanupScope();
  let result: T | undefined;
  let error: unknown;

  try {
    result = await fn(scope);
  } catch (e) {
    error = e;
  }

  const cleanupResult = await scope.cleanup();

  if (error) {
    return { error, cleanup: cleanupResult };
  }

  return { result, cleanup: cleanupResult };
}
