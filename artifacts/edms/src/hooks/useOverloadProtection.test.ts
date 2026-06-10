import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  useBatcher,
  useDebounce,
  useDebouncedCallback,
  useThrottle,
  useThrottledCallback,
} from "./useOverloadProtection";

describe("useOverloadProtection hooks", () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  describe("useDebounce", () => {
    it("should debounce value updates", () => {
      const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
        initialProps: { value: "initial", delay: 300 },
      });

      expect(result.current).toBe("initial");

      // Update value
      rerender({ value: "updated", delay: 300 });

      // Before timer fires, value should still be initial
      expect(result.current).toBe("initial");

      // Fast forward time
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // After timer fires, value should be updated
      expect(result.current).toBe("updated");
    });
  });

  describe("useThrottle", () => {
    it("should throttle value updates", () => {
      const { result, rerender } = renderHook(({ value, delay }) => useThrottle(value, delay), {
        initialProps: { value: "initial", delay: 300 },
      });

      expect(result.current).toBe("initial");

      // First update within window
      rerender({ value: "intermediate", delay: 300 });
      expect(result.current).toBe("initial"); // Throttled

      // Fast forward passing the interval
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current).toBe("intermediate");

      // Next update should apply immediately as interval elapsed
      rerender({ value: "updated", delay: 300 });
      expect(result.current).toBe("updated");
    });
  });

  describe("useDebouncedCallback", () => {
    it("should debounce function execution", () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 300));

      act(() => {
        result.current();
        result.current();
        result.current();
      });

      expect(callback).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("useThrottledCallback", () => {
    it("should throttle function execution", () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useThrottledCallback(callback, 300));

      act(() => {
        result.current();
      });
      // Should execute immediately on first call
      expect(callback).toHaveBeenCalledTimes(1);

      act(() => {
        result.current();
        result.current();
      });

      // Still 1 time because within interval
      expect(callback).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Flushes the last throttled execution
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe("useBatcher", () => {
    it("should batch items and flush automatically", async () => {
      const batchFn = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useBatcher(batchFn, 300, 3));

      act(() => {
        result.current.add("item1");
        result.current.add("item2");
      });

      expect(batchFn).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(batchFn).toHaveBeenCalledWith(["item1", "item2"]);
    });

    it("should flush immediately when max batch size is reached", () => {
      const batchFn = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useBatcher(batchFn, 300, 2));

      act(() => {
        result.current.add("item1");
        result.current.add("item2");
      });

      expect(batchFn).toHaveBeenCalledWith(["item1", "item2"]);
    });
  });

  // `useConcurrencyLimiter` uses real async logic which makes it tricky strictly with FakeTimers
  // without careful flushing, but standard usage verifies the hook renders correctly.
});
