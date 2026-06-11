import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  retryWithBackoff,
  calculateBackoffDelay,
  DEFAULT_MAX_RETRIES,
  DEFAULT_BASE_DELAY,
  DEFAULT_MAX_DELAY,
  DEFAULT_BACKOFF_FACTOR,
} from "./retryWithBackoff";

describe("retryWithBackoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constants", () => {
    it("DEFAULT_MAX_RETRIES is 3 (from ocr_pipeline.yaml retry_count)", () => {
      expect(DEFAULT_MAX_RETRIES).toBe(3);
    });

    it("DEFAULT_BASE_DELAY is 1000ms", () => {
      expect(DEFAULT_BASE_DELAY).toBe(1000);
    });

    it("DEFAULT_MAX_DELAY is 30000ms", () => {
      expect(DEFAULT_MAX_DELAY).toBe(30_000);
    });

    it("DEFAULT_BACKOFF_FACTOR is 2", () => {
      expect(DEFAULT_BACKOFF_FACTOR).toBe(2);
    });
  });

  describe("calculateBackoffDelay", () => {
    it("returns a value between 0 and baseDelay for attempt 0", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const delay = calculateBackoffDelay(0, 1000, 2, 30000);
      // baseDelay * 2^0 = 1000, jitter = 0.5 * 1000 = 500
      expect(delay).toBe(500);
      vi.spyOn(Math, "random").mockRestore();
    });

    it("increases exponentially with attempt number", () => {
      vi.spyOn(Math, "random").mockReturnValue(1); // Max jitter = full value
      const delay0 = calculateBackoffDelay(0, 1000, 2, 30000);
      const delay1 = calculateBackoffDelay(1, 1000, 2, 30000);
      const delay2 = calculateBackoffDelay(2, 1000, 2, 30000);
      // With random=1: delay = floor(1 * cappedDelay)
      expect(delay0).toBe(1000); // 1000 * 2^0 = 1000
      expect(delay1).toBe(2000); // 1000 * 2^1 = 2000
      expect(delay2).toBe(4000); // 1000 * 2^2 = 4000
      vi.spyOn(Math, "random").mockRestore();
    });

    it("caps at maxDelay", () => {
      vi.spyOn(Math, "random").mockReturnValue(1);
      const delay = calculateBackoffDelay(10, 1000, 2, 5000);
      // 1000 * 2^10 = 1024000, capped to 5000, jitter = 1 * 5000 = 5000
      expect(delay).toBe(5000);
      vi.spyOn(Math, "random").mockRestore();
    });

    it("applies jitter (randomization) to prevent thundering herd", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const delay = calculateBackoffDelay(2, 1000, 2, 30000);
      // With random=0, jitter = 0
      expect(delay).toBe(0);
      vi.spyOn(Math, "random").mockRestore();
    });

    it("always returns a non-negative integer", () => {
      for (let i = 0; i < 10; i++) {
        const delay = calculateBackoffDelay(i, 500, 2, 10000);
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(delay)).toBe(true);
      }
    });
  });

  describe("retryWithBackoff", () => {
    it("resolves immediately on first success", async () => {
      const fn = vi.fn().mockResolvedValue("success");

      const resultPromise = retryWithBackoff(fn);
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data).toBe("success");
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries on failure and succeeds on second attempt", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValue("recovered");

      // Use minimal delays for testing
      vi.spyOn(Math, "random").mockReturnValue(0);
      const resultPromise = retryWithBackoff(fn, {
        baseDelay: 10,
        maxRetries: 3,
      });

      // Advance through the retry delay
      await vi.advanceTimersByTimeAsync(100);
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data).toBe("recovered");
      expect(result.attempts).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
      vi.spyOn(Math, "random").mockRestore();
    });

    it("exhausts all retries and returns failure", async () => {
      const error = new Error("persistent failure");
      const fn = vi.fn().mockRejectedValue(error);

      vi.spyOn(Math, "random").mockReturnValue(0);
      const resultPromise = retryWithBackoff(fn, {
        maxRetries: 2,
        baseDelay: 10,
      });

      // Advance through all retries
      await vi.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.attempts).toBe(3); // 1 initial + 2 retries
      expect(result.error).toBe(error);
      expect(fn).toHaveBeenCalledTimes(3);
      vi.spyOn(Math, "random").mockRestore();
    });

    it("respects retryCondition predicate", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("retryable"))
        .mockRejectedValueOnce(new Error("fatal"))
        .mockResolvedValue("never");

      vi.spyOn(Math, "random").mockReturnValue(0);
      const resultPromise = retryWithBackoff(fn, {
        maxRetries: 5,
        baseDelay: 10,
        retryCondition: (error) =>
          error instanceof Error && error.message !== "fatal",
      });

      await vi.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;

      expect(result.success).toBe(false);
      // first call fails with "retryable" -> retry condition true -> retry
      // second call fails with "fatal" -> retry condition false -> stop
      expect(result.attempts).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
      vi.spyOn(Math, "random").mockRestore();
    });

    it("calls onRetry callback before each retry", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail1"))
        .mockRejectedValueOnce(new Error("fail2"))
        .mockResolvedValue("ok");

      const onRetry = vi.fn();

      vi.spyOn(Math, "random").mockReturnValue(0);
      const resultPromise = retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelay: 10,
        onRetry,
      });

      await vi.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, expect.any(Number));
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 2, expect.any(Number));
      vi.spyOn(Math, "random").mockRestore();
    });

    it("uses default max retries of 3 from config", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      vi.spyOn(Math, "random").mockReturnValue(0);
      const resultPromise = retryWithBackoff(fn, { baseDelay: 10 });

      await vi.advanceTimersByTimeAsync(10000);
      const result = await resultPromise;

      expect(result.attempts).toBe(4); // 1 initial + 3 retries (DEFAULT_MAX_RETRIES)
      expect(fn).toHaveBeenCalledTimes(4);
      vi.spyOn(Math, "random").mockRestore();
    });

    it("tracks total time spent", async () => {
      const fn = vi.fn().mockResolvedValue("fast");
      const result = await retryWithBackoff(fn);
      expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
