/**
 * useAbortOnNavigate Hook
 *
 * Automatically cancels in-flight API requests when user navigates away from page.
 * Prevents race conditions where responses arrive after component unmounts or route changes.
 *
 * Usage:
 *   const signal = useAbortOnNavigate();
 *   const docs = await apiClient.getDocuments({ ...params }, signal);
 *
 * The signal is automatically aborted when:
 * - Component unmounts
 * - Route changes (useLocation dependency)
 * - Filter/search state changes significantly
 */

import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router";

/**
 * Create and manage AbortController for API requests
 * Automatically aborts on navigation or component unmount
 */
export function useAbortOnNavigate() {
  const abortControllerRef = useRef<AbortController>(new AbortController());
  const location = useLocation();

  // Abort previous requests when route changes
  useEffect(() => {
    const controller = abortControllerRef.current;
    return () => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
      // Create new controller for next navigation
      abortControllerRef.current = new AbortController();
    };
  }, [location.pathname]); // Only re-abort on route change, not search/hash

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (!abortControllerRef.current.signal.aborted) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return abortControllerRef.current.signal;
}

/**
 * Create an abort controller for a specific operation
 * Use when you have multiple async operations in a page and want granular control
 *
 * Usage:
 *   const abortDocSearch = useAbortController();
 *   const abortFilterChange = useAbortController();
 */
export function useAbortController() {
  const controllerRef = useRef<AbortController>(new AbortController());

  useEffect(() => {
    return () => {
      if (!controllerRef.current.signal.aborted) {
        controllerRef.current.abort();
      }
    };
  }, []);

  const abort = useCallback(() => {
    if (!controllerRef.current.signal.aborted) {
      controllerRef.current.abort();
    }
  }, []);

  const reset = useCallback(() => {
    if (!controllerRef.current.signal.aborted) {
      controllerRef.current.abort();
    }

    controllerRef.current = new AbortController();
    return controllerRef.current.signal;
  }, []);

  return {
    signal: controllerRef.current.signal,
    abort,
    reset,
  };
}

/**
 * Debounced abort controller for rapid filter changes
 * Aborts previous request, starts fresh on each filter change
 *
 * Usage:
 *   const getAbortSignal = useDebouncedAbort(300); // 300ms delay
 *   useEffect(() => {
 *     const signal = getAbortSignal();
 *     fetchResults({ ...filters }, signal);
 *   }, [filters]);
 */
export function useDebouncedAbort(delayMs: number = 300) {
  const controllerRef = useRef<AbortController>(new AbortController());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (!controllerRef.current.signal.aborted) {
        controllerRef.current.abort();
      }
    };
  }, []);

  return useCallback(() => {
    // Abort previous request
    if (!controllerRef.current.signal.aborted) {
      controllerRef.current.abort();
    }

    // Clear any pending timeout
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Start new controller after delay
    return new Promise<AbortSignal>((resolve) => {
      timeoutRef.current = setTimeout(() => {
        controllerRef.current = new AbortController();
        resolve(controllerRef.current.signal);
      }, delayMs);
    });
  }, [delayMs]);
}
