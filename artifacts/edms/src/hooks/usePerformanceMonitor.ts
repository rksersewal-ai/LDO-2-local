/**
 * usePerformanceMonitor Hook
 *
 * Tracks component render times using the Performance API
 * (performance.mark/performance.measure). Provides metrics on:
 *   - Mount time
 *   - Re-render count
 *   - Average render duration
 *   - Slow renders (>16ms, i.e., frame budget exceeded)
 *
 * Usage:
 *   const metrics = usePerformanceMonitor('DocumentList');
 *   // metrics.renderCount, metrics.averageDuration, etc.
 */

import { useEffect, useLayoutEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

/** Performance metrics tracked by the hook */
export interface PerformanceMetrics {
  /** Name of the monitored component */
  componentName: string;
  /** Time taken for initial mount (ms) */
  mountTime: number;
  /** Total number of renders (including initial mount) */
  renderCount: number;
  /** Average render duration across all renders (ms) */
  averageDuration: number;
  /** Number of renders exceeding 16ms frame budget */
  slowRenderCount: number;
  /** Most recent render duration (ms) */
  lastRenderDuration: number;
  /** All recorded render durations */
  renderDurations: number[];
}

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

/** Frame budget threshold in ms (60fps = ~16.67ms per frame) */
const SLOW_RENDER_THRESHOLD_MS = 16;

/** Maximum number of render durations to retain */
const MAX_RENDER_HISTORY = 100;

// ─────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────

/**
 * React hook that tracks component render performance.
 *
 * Uses Performance API marks and measures to track render timing.
 * Tracks mount time, re-render counts, average duration, and slow renders.
 * Returns a metrics object that is updated after each render via ref mutation.
 *
 * @param componentName - Name identifier for the component being monitored
 * @returns PerformanceMetrics object with current metrics
 */
export function usePerformanceMonitor(componentName: string): PerformanceMetrics {
  const renderStartRef = useRef<number>(0);
  const mountTimeRef = useRef<number>(0);
  const renderCountRef = useRef<number>(0);
  const durationsRef = useRef<number[]>([]);
  const slowCountRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(false);
  const metricsRef = useRef<PerformanceMetrics>({
    componentName,
    mountTime: 0,
    renderCount: 0,
    averageDuration: 0,
    slowRenderCount: 0,
    lastRenderDuration: 0,
    renderDurations: [],
  });

  // Mark render start (runs synchronously on each render)
  renderStartRef.current = performanceNow();
  renderCountRef.current += 1;

  const currentRenderCount = renderCountRef.current;
  const markName = `${componentName}-render-${currentRenderCount}`;
  performanceMark(markName);

  // useLayoutEffect fires synchronously after DOM mutations but before paint
  // This allows us to measure render duration without triggering re-renders
  useLayoutEffect(() => {
    const renderEnd = performanceNow();
    const duration = renderEnd - renderStartRef.current;

    const measureName = `${componentName}-measure-${currentRenderCount}`;
    performanceMeasure(measureName, markName);

    // Track mount time (first render)
    if (!isMountedRef.current) {
      mountTimeRef.current = duration;
      isMountedRef.current = true;
    }

    // Track slow renders
    if (duration > SLOW_RENDER_THRESHOLD_MS) {
      slowCountRef.current += 1;
    }

    // Store duration (with limit)
    durationsRef.current.push(duration);
    if (durationsRef.current.length > MAX_RENDER_HISTORY) {
      durationsRef.current = durationsRef.current.slice(-MAX_RENDER_HISTORY);
    }

    // Calculate average
    const allDurations = durationsRef.current;
    const total = allDurations.reduce((sum, d) => sum + d, 0);
    const average = allDurations.length > 0 ? total / allDurations.length : 0;

    // Mutate the metrics ref object in place (no re-render triggered)
    metricsRef.current.mountTime = mountTimeRef.current;
    metricsRef.current.renderCount = renderCountRef.current;
    metricsRef.current.averageDuration = Math.round(average * 100) / 100;
    metricsRef.current.slowRenderCount = slowCountRef.current;
    metricsRef.current.lastRenderDuration = Math.round(duration * 100) / 100;
    metricsRef.current.renderDurations = [...allDurations];
  });

  // Cleanup performance entries on unmount
  useEffect(() => {
    return () => {
      clearPerformanceEntries(componentName);
    };
  }, [componentName]);

  return metricsRef.current;
}

// ─────────────────────────────────────────────────────────────────────────
// Performance API Wrappers (safe for environments without Performance API)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Safe wrapper for performance.now()
 */
function performanceNow(): number {
  if (typeof performance !== "undefined" && performance.now) {
    return performance.now();
  }
  return Date.now();
}

/**
 * Safe wrapper for performance.mark()
 */
function performanceMark(name: string): void {
  try {
    if (typeof performance !== "undefined" && performance.mark) {
      performance.mark(name);
    }
  } catch {
    // Silently ignore if Performance API is unavailable
  }
}

/**
 * Safe wrapper for performance.measure()
 */
function performanceMeasure(name: string, startMark: string): void {
  try {
    if (typeof performance !== "undefined" && performance.measure) {
      performance.measure(name, startMark);
    }
  } catch {
    // Silently ignore if mark does not exist or API is unavailable
  }
}

/**
 * Get the average render duration for a monitored component.
 * Utility for external consumers.
 */
export function getAverageRenderDuration(metrics: PerformanceMetrics): number {
  return metrics.averageDuration;
}

/**
 * Check if a component has exceeded slow render threshold.
 */
export function hasSlowRenders(metrics: PerformanceMetrics): boolean {
  return metrics.slowRenderCount > 0;
}

/**
 * Clear performance entries for a component.
 */
function clearPerformanceEntries(componentName: string): void {
  try {
    if (typeof performance !== "undefined" && performance.getEntriesByType) {
      const entries = performance.getEntriesByType("mark");
      for (const entry of entries) {
        if (entry.name.startsWith(componentName)) {
          performance.clearMarks(entry.name);
        }
      }
      const measures = performance.getEntriesByType("measure");
      for (const entry of measures) {
        if (entry.name.startsWith(componentName)) {
          performance.clearMeasures(entry.name);
        }
      }
    }
  } catch {
    // Silently ignore
  }
}
