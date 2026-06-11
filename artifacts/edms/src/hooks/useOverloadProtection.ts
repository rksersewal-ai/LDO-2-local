/**
 * useOverloadProtection Hooks
 *
 * Shared utilities for preventing browser/server overload:
 * - Debounce: delay rapid function calls (search, filter changes)
 * - Throttle: limit call frequency (scroll, resize events)
 * - Concurrency limiter: prevent request floods (bulk operations)
 */

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Debounce Hook: Delay expensive operations until user stops changing input
 *
 * Usage:
 *   const debouncedSearch = useDebounce(searchQuery, 300);
 *   useEffect(() => {
 *     if (debouncedSearch) performSearch(debouncedSearch);
 *   }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

/**
 * Throttle Hook: Limit how frequently a function can be called
 *
 * Usage:
 *   const throttledScroll = useThrottle(scrollY, 100);
 *   useEffect(() => {
 *     console.log('Scroll position:', throttledScroll);
 *   }, [throttledScroll]);
 */
export function useThrottle<T>(value: T, intervalMs: number = 200): T {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastUpdatedRef = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    if (now >= lastUpdatedRef.current + intervalMs) {
      lastUpdatedRef.current = now;
      setThrottledValue(value);
      return undefined;
    } else {
      const timer = setTimeout(
        () => {
          lastUpdatedRef.current = Date.now();
          setThrottledValue(value);
        },
        intervalMs - (now - lastUpdatedRef.current),
      );

      return () => clearTimeout(timer);
    }
  }, [value, intervalMs]);

  return throttledValue;
}

/**
 * Debounced Callback: Combines useCallback with debounce for handlers
 *
 * Usage:
 *   const debouncedSearch = useDebouncedCallback((query) => {
 *     performSearch(query);
 *   }, 300, []);
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delayMs: number = 300,
  deps: React.DependencyList = [],
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return useCallback(
    (...args: unknown[]) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delayMs);
    },
    [callback, delayMs, ...deps],
  ) as unknown as T;
}

/**
 * Throttled Callback: Combines useCallback with throttle for handlers
 *
 * Usage:
 *   const throttledResize = useThrottledCallback(() => {
 *     recalculateLayout();
 *   }, 100, []);
 */
export function useThrottledCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  intervalMs: number = 200,
  deps: React.DependencyList = [],
): T {
  const lastCalledRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return useCallback(
    (...args: unknown[]) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCalledRef.current;

      if (timeSinceLastCall >= intervalMs) {
        lastCalledRef.current = now;
        callback(...args);
      } else {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          lastCalledRef.current = Date.now();
          callback(...args);
        }, intervalMs - timeSinceLastCall);
      }
    },
    [callback, intervalMs, ...deps],
  ) as unknown as T;
}

/**
 * Concurrency Limiter: Limit simultaneous async operations
 *
 * Usage:
 *   const limiter = useConcurrencyLimiter(3); // Max 3 concurrent
 *   const results = await limiter.run(async () => {
 *     return await apiCall();
 *   });
 */
export function useConcurrencyLimiter(maxConcurrent: number = 5) {
  const [activeCount, setActiveCount] = useState(0);
  const queueRef = useRef<Array<() => void>>([]);

  const processQueue = useCallback(() => {
    if (activeCount < maxConcurrent && queueRef.current.length > 0) {
      const task = queueRef.current.shift();
      if (task) task();
    }
  }, [activeCount, maxConcurrent]);

  useEffect(() => {
    processQueue();
  }, [processQueue]);

  const run = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      return new Promise((resolve, reject) => {
        const execute = async () => {
          setActiveCount((c) => c + 1);
          try {
            const result = await fn();
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            setActiveCount((c) => c - 1);
            processQueue();
          }
        };

        if (activeCount < maxConcurrent) {
          execute();
        } else {
          queueRef.current.push(execute);
        }
      });
    },
    [activeCount, maxConcurrent, processQueue],
  );

  return { run, activeCount };
}

/**
 * Batch Operations: Group multiple updates into single async operation
 *
 * Usage:
 *   const batcher = useBatcher(performBulkUpdate, 300);
 *   items.forEach(item => batcher.add(item));
 *   // After 300ms idle or batch full, all items processed together
 */
export function useBatcher<T>(
  batchFn: (items: T[]) => Promise<void>,
  flushDelayMs: number = 500,
  maxBatchSize: number = 100,
) {
  const [pending, setPending] = useState(0);
  const batchRef = useRef<T[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (batchRef.current.length === 0) return;

    const batch = batchRef.current;
    batchRef.current = [];

    setPending((p) => p + batch.length);
    try {
      await batchFn(batch);
    } finally {
      setPending((p) => Math.max(0, p - batch.length));
    }
  }, [batchFn]);

  const add = useCallback(
    (item: T) => {
      batchRef.current.push(item);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (batchRef.current.length >= maxBatchSize) {
        flush();
      } else {
        timeoutRef.current = setTimeout(flush, flushDelayMs);
      }
    },
    [flush, maxBatchSize, flushDelayMs],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { add, pending, flush };
}
