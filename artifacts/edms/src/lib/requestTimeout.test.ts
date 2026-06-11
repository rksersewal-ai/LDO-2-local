import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  withTimeout,
  createTimeoutController,
  TimeoutError,
  DEFAULT_TIMEOUT_MS,
  OCR_TIMEOUT_MS,
} from "./requestTimeout";

describe("requestTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constants", () => {
    it("DEFAULT_TIMEOUT_MS is 30 seconds", () => {
      expect(DEFAULT_TIMEOUT_MS).toBe(30_000);
    });

    it("OCR_TIMEOUT_MS is 300 seconds from config", () => {
      expect(OCR_TIMEOUT_MS).toBe(300_000);
    });
  });

  describe("TimeoutError", () => {
    it("is an Error with name TimeoutError", () => {
      const err = new TimeoutError("test", 5000);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe("TimeoutError");
      expect(err.message).toBe("test");
      expect(err.timeoutMs).toBe(5000);
    });
  });

  describe("withTimeout", () => {
    it("resolves when promise resolves before timeout", async () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve("done"), 100);
      });

      const resultPromise = withTimeout(promise, 5000);
      vi.advanceTimersByTime(100);
      const result = await resultPromise;
      expect(result).toBe("done");
    });

    it("rejects with TimeoutError when promise exceeds timeout", async () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve("done"), 10000);
      });

      const resultPromise = withTimeout(promise, 1000);
      vi.advanceTimersByTime(1000);

      await expect(resultPromise).rejects.toThrow(TimeoutError);
      await expect(resultPromise).rejects.toThrow("Operation timed out after 1000ms");
    });

    it("uses custom error message", async () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve("done"), 10000);
      });

      const resultPromise = withTimeout(promise, 500, "OCR timed out");
      vi.advanceTimersByTime(500);

      await expect(resultPromise).rejects.toThrow("OCR timed out");
    });

    it("preserves the timeout value in the error", async () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve("done"), 10000);
      });

      const resultPromise = withTimeout(promise, 2500);
      vi.advanceTimersByTime(2500);

      try {
        await resultPromise;
      } catch (e) {
        expect(e).toBeInstanceOf(TimeoutError);
        expect((e as TimeoutError).timeoutMs).toBe(2500);
      }
    });

    it("passes through rejection from the original promise", async () => {
      const promise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error("network error")), 100);
      });

      const resultPromise = withTimeout(promise, 5000);
      vi.advanceTimersByTime(100);

      await expect(resultPromise).rejects.toThrow("network error");
    });

    it("returns the promise directly when timeout is 0 or negative", async () => {
      const promise = Promise.resolve("immediate");
      const result = await withTimeout(promise, 0);
      expect(result).toBe("immediate");
    });

    it("cleans up timeout when promise resolves first", async () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve("fast"), 50);
      });

      const resultPromise = withTimeout(promise, 10000);
      vi.advanceTimersByTime(50);
      await resultPromise;

      // Should not throw even after advancing past the timeout
      vi.advanceTimersByTime(20000);
    });
  });

  describe("createTimeoutController", () => {
    it("returns controller, signal, and clear function", () => {
      const tc = createTimeoutController(5000);
      expect(tc.controller).toBeInstanceOf(AbortController);
      expect(tc.signal).toBeDefined();
      expect(typeof tc.clear).toBe("function");
      tc.clear();
    });

    it("aborts after timeout", () => {
      const tc = createTimeoutController(3000);
      expect(tc.signal.aborted).toBe(false);
      vi.advanceTimersByTime(3000);
      expect(tc.signal.aborted).toBe(true);
    });

    it("does not abort when cleared before timeout", () => {
      const tc = createTimeoutController(3000);
      tc.clear();
      vi.advanceTimersByTime(5000);
      expect(tc.signal.aborted).toBe(false);
    });

    it("uses default timeout when no argument provided", () => {
      const tc = createTimeoutController();
      vi.advanceTimersByTime(DEFAULT_TIMEOUT_MS - 1);
      expect(tc.signal.aborted).toBe(false);
      vi.advanceTimersByTime(1);
      expect(tc.signal.aborted).toBe(true);
    });
  });
});
