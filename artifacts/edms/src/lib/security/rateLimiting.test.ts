import { describe, it, expect, beforeEach, vi } from "vitest";
import { RateLimiter } from "./rateLimiting";

describe("rateLimiting", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new RateLimiter({
      endpoints: {
        "/api/search": { maxRequests: 5, windowMs: 60000 },
        "/api/upload": { maxRequests: 3, windowMs: 30000 },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkLimit", () => {
    it("allows requests when under the limit", () => {
      const result = limiter.checkLimit("/api/search");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
      expect(result.currentCount).toBe(0);
    });

    it("reports correct remaining count after requests", () => {
      limiter.recordRequest("/api/search");
      limiter.recordRequest("/api/search");

      const result = limiter.checkLimit("/api/search");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3);
      expect(result.currentCount).toBe(2);
    });

    it("denies requests when at the limit", () => {
      for (let i = 0; i < 5; i++) {
        limiter.recordRequest("/api/search");
      }

      const result = limiter.checkLimit("/api/search");
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.currentCount).toBe(5);
    });

    it("reports time until window resets", () => {
      vi.setSystemTime(1000);
      limiter.recordRequest("/api/search");

      vi.setSystemTime(5000);
      const result = limiter.checkLimit("/api/search");
      // Oldest request at t=1000, window=60000, so resets at t=61000
      // Current time is t=5000, so resetsInMs = 61000 - 5000 = 56000
      expect(result.resetsInMs).toBe(56000);
    });

    it("allows unlimited requests for unconfigured endpoints", () => {
      for (let i = 0; i < 100; i++) {
        limiter.recordRequest("/api/other");
      }

      const result = limiter.checkLimit("/api/other");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(Infinity);
    });
  });

  describe("recordRequest", () => {
    it("increments the request count for an endpoint", () => {
      expect(limiter.checkLimit("/api/search").currentCount).toBe(0);

      limiter.recordRequest("/api/search");
      expect(limiter.checkLimit("/api/search").currentCount).toBe(1);

      limiter.recordRequest("/api/search");
      expect(limiter.checkLimit("/api/search").currentCount).toBe(2);
    });

    it("does not affect other endpoints", () => {
      limiter.recordRequest("/api/search");
      limiter.recordRequest("/api/search");

      expect(limiter.checkLimit("/api/upload").currentCount).toBe(0);
    });
  });

  describe("getRemainingRequests", () => {
    it("returns max requests when no requests have been made", () => {
      expect(limiter.getRemainingRequests("/api/search")).toBe(5);
    });

    it("returns correct remaining count", () => {
      limiter.recordRequest("/api/search");
      limiter.recordRequest("/api/search");
      expect(limiter.getRemainingRequests("/api/search")).toBe(3);
    });

    it("returns 0 when limit is reached", () => {
      for (let i = 0; i < 5; i++) {
        limiter.recordRequest("/api/search");
      }
      expect(limiter.getRemainingRequests("/api/search")).toBe(0);
    });

    it("returns Infinity for unconfigured endpoints", () => {
      expect(limiter.getRemainingRequests("/api/unknown")).toBe(Infinity);
    });
  });

  describe("isLimited", () => {
    it("returns false when under the limit", () => {
      limiter.recordRequest("/api/search");
      expect(limiter.isLimited("/api/search")).toBe(false);
    });

    it("returns true when at the limit", () => {
      for (let i = 0; i < 5; i++) {
        limiter.recordRequest("/api/search");
      }
      expect(limiter.isLimited("/api/search")).toBe(true);
    });

    it("returns false for unconfigured endpoints", () => {
      expect(limiter.isLimited("/api/unknown")).toBe(false);
    });
  });

  describe("sliding window behavior", () => {
    it("removes expired requests from the window", () => {
      vi.setSystemTime(0);
      for (let i = 0; i < 5; i++) {
        limiter.recordRequest("/api/search");
      }
      expect(limiter.isLimited("/api/search")).toBe(true);

      // Advance past the window
      vi.setSystemTime(61000);
      expect(limiter.isLimited("/api/search")).toBe(false);
      expect(limiter.getRemainingRequests("/api/search")).toBe(5);
    });

    it("handles partial window expiration correctly", () => {
      vi.setSystemTime(0);
      limiter.recordRequest("/api/search"); // t=0
      limiter.recordRequest("/api/search"); // t=0

      vi.setSystemTime(30000);
      limiter.recordRequest("/api/search"); // t=30000
      limiter.recordRequest("/api/search"); // t=30000
      limiter.recordRequest("/api/search"); // t=30000

      expect(limiter.isLimited("/api/search")).toBe(true);

      // Move past first 2 requests but not last 3
      vi.setSystemTime(61000);
      expect(limiter.isLimited("/api/search")).toBe(false);
      expect(limiter.checkLimit("/api/search").currentCount).toBe(3);
    });

    it("uses different windows per endpoint", () => {
      vi.setSystemTime(0);
      for (let i = 0; i < 3; i++) {
        limiter.recordRequest("/api/upload"); // windowMs=30000
      }
      expect(limiter.isLimited("/api/upload")).toBe(true);

      // Move past upload window but not search window
      vi.setSystemTime(31000);
      expect(limiter.isLimited("/api/upload")).toBe(false);
    });
  });

  describe("defaultLimit", () => {
    it("applies default limit to unconfigured endpoints", () => {
      const withDefault = new RateLimiter({
        endpoints: {},
        defaultLimit: { maxRequests: 2, windowMs: 10000 },
      });

      withDefault.recordRequest("/any/endpoint");
      withDefault.recordRequest("/any/endpoint");

      expect(withDefault.isLimited("/any/endpoint")).toBe(true);
    });

    it("specific endpoint config overrides default", () => {
      const withDefault = new RateLimiter({
        endpoints: {
          "/api/special": { maxRequests: 10, windowMs: 60000 },
        },
        defaultLimit: { maxRequests: 2, windowMs: 10000 },
      });

      withDefault.recordRequest("/api/special");
      withDefault.recordRequest("/api/special");

      expect(withDefault.isLimited("/api/special")).toBe(false);
      expect(withDefault.getRemainingRequests("/api/special")).toBe(8);
    });
  });

  describe("reset", () => {
    it("clears requests for a specific endpoint", () => {
      limiter.recordRequest("/api/search");
      limiter.recordRequest("/api/search");
      limiter.reset("/api/search");

      expect(limiter.checkLimit("/api/search").currentCount).toBe(0);
    });

    it("does not affect other endpoints", () => {
      limiter.recordRequest("/api/search");
      limiter.recordRequest("/api/upload");
      limiter.reset("/api/search");

      expect(limiter.checkLimit("/api/upload").currentCount).toBe(1);
    });
  });

  describe("resetAll", () => {
    it("clears all recorded requests", () => {
      limiter.recordRequest("/api/search");
      limiter.recordRequest("/api/upload");
      limiter.resetAll();

      expect(limiter.checkLimit("/api/search").currentCount).toBe(0);
      expect(limiter.checkLimit("/api/upload").currentCount).toBe(0);
    });
  });
});

// Need to import afterEach
import { afterEach } from "vitest";
