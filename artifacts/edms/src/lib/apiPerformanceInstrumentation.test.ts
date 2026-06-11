import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  RequestTimer,
  SlowQueryDetector,
  RequestMetricsCollector,
  calculatePercentiles,
  formatMetricsSummary,
} from "./apiPerformanceInstrumentation";
import type { RequestTiming } from "./apiPerformanceInstrumentation";

describe("apiPerformanceInstrumentation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("RequestTimer", () => {
    it("should track start and end times", () => {
      const timer = new RequestTimer("/api/documents", "GET");

      timer.start();
      expect(timer.isRunning).toBe(true);

      timer.end();
      expect(timer.isRunning).toBe(false);
      expect(timer.duration).toBeGreaterThanOrEqual(0);
    });

    it("should throw if ended before starting", () => {
      const timer = new RequestTimer("/api/docs", "POST");
      expect(() => timer.end()).toThrow("Timer has not been started");
    });

    it("should throw if duration accessed before ending", () => {
      const timer = new RequestTimer("/api/docs", "GET");
      timer.start();
      expect(() => timer.duration).toThrow("Timer has not been ended");
    });

    it("should uppercase the method", () => {
      const timer = new RequestTimer("/api/docs", "post");
      expect(timer.method).toBe("POST");
    });

    it("should produce a RequestTiming record", () => {
      const timer = new RequestTimer("/api/docs", "GET");
      timer.start();
      timer.end();

      const timing = timer.toTiming();
      expect(timing.url).toBe("/api/docs");
      expect(timing.method).toBe("GET");
      expect(timing.duration).toBeGreaterThanOrEqual(0);
      expect(timing.startTime).toBeLessThanOrEqual(timing.endTime);
    });
  });

  describe("SlowQueryDetector", () => {
    it("should detect queries exceeding the threshold", () => {
      const detector = new SlowQueryDetector({ thresholdMs: 100 });

      const slowTiming: RequestTiming = {
        url: "/api/search",
        method: "GET",
        startTime: 0,
        endTime: 150,
        duration: 150,
      };

      const result = detector.check(slowTiming);
      expect(result).not.toBeNull();
      expect(result!.exceededBy).toBe(50);
    });

    it("should return null for queries within threshold", () => {
      const detector = new SlowQueryDetector({ thresholdMs: 200 });

      const fastTiming: RequestTiming = {
        url: "/api/docs",
        method: "GET",
        startTime: 0,
        endTime: 100,
        duration: 100,
      };

      const result = detector.check(fastTiming);
      expect(result).toBeNull();
    });

    it("should use default threshold of 2000ms", () => {
      const detector = new SlowQueryDetector();
      expect(detector.threshold).toBe(2000);
    });

    it("should trim records to max entries", () => {
      const detector = new SlowQueryDetector({ thresholdMs: 10, maxEntries: 2 });

      for (let i = 0; i < 5; i++) {
        detector.check({
          url: `/api/endpoint${i}`,
          method: "GET",
          startTime: 0,
          endTime: 100,
          duration: 100,
        });
      }

      expect(detector.getRecords().length).toBe(2);
    });

    it("should clear all records", () => {
      const detector = new SlowQueryDetector({ thresholdMs: 10 });
      detector.check({ url: "/test", method: "GET", startTime: 0, endTime: 50, duration: 50 });
      expect(detector.getRecords().length).toBe(1);

      detector.clear();
      expect(detector.getRecords().length).toBe(0);
    });
  });

  describe("RequestMetricsCollector", () => {
    it("should record timings and compute metrics", () => {
      const collector = new RequestMetricsCollector();

      const timings: RequestTiming[] = [
        { url: "/api/docs", method: "GET", startTime: 0, endTime: 100, duration: 100 },
        { url: "/api/docs", method: "GET", startTime: 0, endTime: 200, duration: 200 },
        { url: "/api/docs", method: "GET", startTime: 0, endTime: 300, duration: 300 },
      ];

      timings.forEach((t) => collector.record(t));

      const metrics = collector.getMetrics();
      expect(metrics.count).toBe(3);
      expect(metrics.mean).toBe(200);
      expect(metrics.min).toBe(100);
      expect(metrics.max).toBe(300);
    });

    it("should group metrics by endpoint", () => {
      const collector = new RequestMetricsCollector();

      collector.record({ url: "/api/docs", method: "GET", startTime: 0, endTime: 100, duration: 100 });
      collector.record({ url: "/api/search", method: "POST", startTime: 0, endTime: 200, duration: 200 });
      collector.record({ url: "/api/docs", method: "GET", startTime: 0, endTime: 150, duration: 150 });

      const byEndpoint = collector.getMetricsByEndpoint();
      expect(byEndpoint["GET /api/docs"]).toBeDefined();
      expect(byEndpoint["GET /api/docs"].count).toBe(2);
      expect(byEndpoint["POST /api/search"]).toBeDefined();
      expect(byEndpoint["POST /api/search"].count).toBe(1);
    });

    it("should trim to max timings", () => {
      const collector = new RequestMetricsCollector({ maxTimings: 3 });

      for (let i = 0; i < 10; i++) {
        collector.record({ url: "/api/docs", method: "GET", startTime: 0, endTime: i * 10, duration: i * 10 });
      }

      expect(collector.count).toBe(3);
    });

    it("should persist to localStorage when enabled", () => {
      const collector = new RequestMetricsCollector({ persist: true });
      collector.record({ url: "/api/docs", method: "GET", startTime: 0, endTime: 100, duration: 100 });

      const stored = localStorage.getItem("edms_api_metrics");
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.length).toBe(1);
    });

    it("should load from localStorage when persist is enabled", () => {
      const existingData = [
        { url: "/api/docs", method: "GET", startTime: 0, endTime: 50, duration: 50 },
      ];
      localStorage.setItem("edms_api_metrics", JSON.stringify(existingData));

      const collector = new RequestMetricsCollector({ persist: true });
      expect(collector.count).toBe(1);
    });

    it("should clear timings and storage", () => {
      const collector = new RequestMetricsCollector({ persist: true });
      collector.record({ url: "/api/docs", method: "GET", startTime: 0, endTime: 100, duration: 100 });
      collector.clear();

      expect(collector.count).toBe(0);
      expect(localStorage.getItem("edms_api_metrics")).toBe("[]");
    });
  });

  describe("calculatePercentiles", () => {
    it("should return zeros for empty array", () => {
      const result = calculatePercentiles([]);
      expect(result.p50).toBe(0);
      expect(result.p95).toBe(0);
      expect(result.p99).toBe(0);
      expect(result.count).toBe(0);
    });

    it("should handle single value", () => {
      const result = calculatePercentiles([42]);
      expect(result.p50).toBe(42);
      expect(result.p95).toBe(42);
      expect(result.p99).toBe(42);
      expect(result.count).toBe(1);
      expect(result.mean).toBe(42);
    });

    it("should compute correct percentiles for larger dataset", () => {
      // 1 through 100
      const durations = Array.from({ length: 100 }, (_, i) => i + 1);
      const result = calculatePercentiles(durations);

      expect(result.count).toBe(100);
      expect(result.min).toBe(1);
      expect(result.max).toBe(100);
      expect(result.mean).toBeCloseTo(50.5);
      // p50 should be around 50.5
      expect(result.p50).toBeCloseTo(50.5, 0);
      // p95 should be around 95.05
      expect(result.p95).toBeGreaterThan(94);
      expect(result.p95).toBeLessThan(96);
    });
  });

  describe("formatMetricsSummary", () => {
    it("should format a complete metrics summary", () => {
      const collector = new RequestMetricsCollector();
      const detector = new SlowQueryDetector({ thresholdMs: 100 });

      collector.record({ url: "/api/docs", method: "GET", startTime: 0, endTime: 50, duration: 50 });
      collector.record({ url: "/api/docs", method: "GET", startTime: 0, endTime: 150, duration: 150 });

      detector.check({ url: "/api/docs", method: "GET", startTime: 0, endTime: 150, duration: 150 });

      const summary = formatMetricsSummary(collector, detector);
      expect(summary.totalRequests).toBe(2);
      expect(summary.slowQueries).toBe(1);
      expect(summary.percentiles.count).toBe(2);
      expect(summary.byEndpoint["GET /api/docs"]).toBeDefined();
    });

    it("should handle missing detector", () => {
      const collector = new RequestMetricsCollector();
      collector.record({ url: "/api/docs", method: "GET", startTime: 0, endTime: 50, duration: 50 });

      const summary = formatMetricsSummary(collector);
      expect(summary.slowQueries).toBe(0);
    });
  });
});
