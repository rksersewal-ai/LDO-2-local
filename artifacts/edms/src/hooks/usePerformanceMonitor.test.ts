import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  usePerformanceMonitor,
  getAverageRenderDuration,
  hasSlowRenders,
} from "./usePerformanceMonitor";
import type { PerformanceMetrics } from "./usePerformanceMonitor";

describe("usePerformanceMonitor", () => {
  let nowCounter: number;

  beforeEach(() => {
    nowCounter = 0;
    // Mock Performance API for jsdom
    vi.stubGlobal("performance", {
      now: vi.fn(() => {
        nowCounter += 5;
        return nowCounter;
      }),
      mark: vi.fn(),
      measure: vi.fn(),
      getEntriesByType: vi.fn(() => []),
      clearMarks: vi.fn(),
      clearMeasures: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should track component name", () => {
    const { result } = renderHook(() => usePerformanceMonitor("TestComponent"));
    expect(result.current.componentName).toBe("TestComponent");
  });

  it("should track render count", () => {
    const { result, rerender } = renderHook(() => usePerformanceMonitor("TestComponent"));

    const initialCount = result.current.renderCount;
    expect(initialCount).toBeGreaterThanOrEqual(1);

    rerender();

    expect(result.current.renderCount).toBeGreaterThan(initialCount);
  });

  it("should track mount time on first render", () => {
    const { result } = renderHook(() => usePerformanceMonitor("TestComponent"));
    expect(result.current.mountTime).toBeGreaterThanOrEqual(0);
  });

  it("should record render durations", () => {
    const { result, rerender } = renderHook(() => usePerformanceMonitor("TestComponent"));

    rerender();
    rerender();

    expect(result.current.renderDurations.length).toBeGreaterThanOrEqual(1);
  });

  it("should call performance.mark on render", () => {
    renderHook(() => usePerformanceMonitor("MarkedComponent"));
    expect(performance.mark).toHaveBeenCalled();
  });

  it("should call performance.measure after render", () => {
    renderHook(() => usePerformanceMonitor("MeasuredComponent"));
    expect(performance.measure).toHaveBeenCalled();
  });

  it("should detect slow renders when duration exceeds 16ms", () => {
    // Make performance.now return values that create a >16ms gap
    let callIdx = 0;
    vi.stubGlobal("performance", {
      now: vi.fn(() => {
        callIdx++;
        // Odd calls (render start) = 0, Even calls (render end in effect) = 20
        return callIdx % 2 === 1 ? 0 : 20;
      }),
      mark: vi.fn(),
      measure: vi.fn(),
      getEntriesByType: vi.fn(() => []),
      clearMarks: vi.fn(),
      clearMeasures: vi.fn(),
    });

    const { result } = renderHook(() => usePerformanceMonitor("SlowComponent"));
    expect(result.current.slowRenderCount).toBeGreaterThanOrEqual(1);
  });

  it("should calculate average duration", () => {
    const { result, rerender } = renderHook(() => usePerformanceMonitor("AvgComponent"));
    rerender();
    rerender();

    expect(result.current.averageDuration).toBeGreaterThanOrEqual(0);
  });

  it("should clear performance entries on unmount", () => {
    const { unmount } = renderHook(() => usePerformanceMonitor("CleanupComponent"));
    unmount();

    expect(performance.getEntriesByType).toHaveBeenCalled();
  });

  it("should track lastRenderDuration", () => {
    const { result } = renderHook(() => usePerformanceMonitor("LastDurComponent"));
    expect(result.current.lastRenderDuration).toBeGreaterThanOrEqual(0);
  });

  describe("utility functions", () => {
    it("getAverageRenderDuration should return the average", () => {
      const metrics: PerformanceMetrics = {
        componentName: "Test",
        mountTime: 5,
        renderCount: 3,
        averageDuration: 10.5,
        slowRenderCount: 0,
        lastRenderDuration: 8,
        renderDurations: [12, 10, 8],
      };

      expect(getAverageRenderDuration(metrics)).toBe(10.5);
    });

    it("hasSlowRenders should return true when slow renders exist", () => {
      const metrics: PerformanceMetrics = {
        componentName: "Test",
        mountTime: 5,
        renderCount: 3,
        averageDuration: 20,
        slowRenderCount: 2,
        lastRenderDuration: 18,
        renderDurations: [20, 18, 22],
      };

      expect(hasSlowRenders(metrics)).toBe(true);
    });

    it("hasSlowRenders should return false when no slow renders", () => {
      const metrics: PerformanceMetrics = {
        componentName: "Test",
        mountTime: 5,
        renderCount: 3,
        averageDuration: 5,
        slowRenderCount: 0,
        lastRenderDuration: 4,
        renderDurations: [5, 6, 4],
      };

      expect(hasSlowRenders(metrics)).toBe(false);
    });
  });
});
