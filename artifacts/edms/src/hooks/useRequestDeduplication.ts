/**
 * useRequestDeduplication Hook
 *
 * Prevents duplicate API calls by maintaining an in-flight request map
 * keyed by URL + params hash. If the same request is already in-flight,
 * returns the existing promise instead of making a new call.
 *
 * Also exports a standalone deduplicateRequest() function for use outside
 * React components.
 *
 * Usage:
 *   const { deduplicate } = useRequestDeduplication();
 *   const data = await deduplicate('/api/docs', params, () => fetchDocs(params));
 */

import { useCallback, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

/** Options for request deduplication */
export interface DeduplicationOptions {
  /** Time-to-live for cached promises in ms (default: 0, no caching after resolution) */
  cacheTtlMs?: number;
}

/** Return value from the useRequestDeduplication hook */
export interface UseRequestDeduplicationResult {
  /** Deduplicate a request - returns existing promise if same request is in-flight */
  deduplicate: <T>(
    key: string,
    params: Record<string, unknown>,
    fetcher: () => Promise<T>,
  ) => Promise<T>;
  /** Get the number of currently in-flight requests */
  getInflightCount: () => number;
  /** Clear all in-flight tracking (does not cancel requests) */
  clear: () => void;
}

// ─────────────────────────────────────────────────────────────────────────
// Standalone Request Map (module-level for deduplicateRequest)
// ─────────────────────────────────────────────────────────────────────────

const globalInflightMap = new Map<string, Promise<unknown>>();

/**
 * Generate a hash key for deduplication based on URL and params.
 */
export function generateRequestKey(
  url: string,
  params: Record<string, unknown>,
): string {
  const paramStr = JSON.stringify(params, Object.keys(params).sort());
  return `${url}::${paramStr}`;
}

/**
 * Standalone request deduplication function.
 * Can be used outside React components.
 *
 * @param url - The request URL (or logical key)
 * @param params - Request parameters (used for key generation)
 * @param fetcher - The function that performs the actual request
 * @returns The result of the fetch (shared if deduplicated)
 */
export async function deduplicateRequest<T>(
  url: string,
  params: Record<string, unknown>,
  fetcher: () => Promise<T>,
): Promise<T> {
  const key = generateRequestKey(url, params);

  const existing = globalInflightMap.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fetcher().finally(() => {
    globalInflightMap.delete(key);
  });

  globalInflightMap.set(key, promise);
  return promise;
}

/**
 * Get the current size of the global inflight map (for testing).
 */
export function getGlobalInflightCount(): number {
  return globalInflightMap.size;
}

/**
 * Clear the global inflight map (for testing).
 */
export function clearGlobalInflightMap(): void {
  globalInflightMap.clear();
}

// ─────────────────────────────────────────────────────────────────────────
// React Hook
// ─────────────────────────────────────────────────────────────────────────

/**
 * React hook that prevents duplicate API calls.
 * Maintains an in-flight request map keyed by URL + params hash.
 * If the same request is already in-flight, returns the existing promise.
 * Cleans up tracking on unmount.
 */
export function useRequestDeduplication(
  options?: DeduplicationOptions,
): UseRequestDeduplicationResult {
  const inflightMapRef = useRef<Map<string, Promise<unknown>>>(new Map());
  const mountedRef = useRef(true);
  const cacheTtlMs = options?.cacheTtlMs ?? 0;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      inflightMapRef.current.clear();
    };
  }, []);

  const deduplicate = useCallback(
    <T>(
      key: string,
      params: Record<string, unknown>,
      fetcher: () => Promise<T>,
    ): Promise<T> => {
      const requestKey = generateRequestKey(key, params);
      const map = inflightMapRef.current;

      const existing = map.get(requestKey);
      if (existing) {
        return existing as Promise<T>;
      }

      const promise = fetcher().finally(() => {
        if (cacheTtlMs > 0) {
          setTimeout(() => {
            if (mountedRef.current) {
              map.delete(requestKey);
            }
          }, cacheTtlMs);
        } else {
          map.delete(requestKey);
        }
      });

      map.set(requestKey, promise);
      return promise;
    },
    [cacheTtlMs],
  );

  const getInflightCount = useCallback((): number => {
    return inflightMapRef.current.size;
  }, []);

  const clear = useCallback((): void => {
    inflightMapRef.current.clear();
  }, []);

  return { deduplicate, getInflightCount, clear };
}
