import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HealthCheckPoller } from "./healthCheckEndpoints";
import type { ServiceCheckConfig, HealthCheckResult } from "./healthCheckEndpoints";

describe("healthCheckEndpoints", () => {
  let poller: HealthCheckPoller;
  let services: ServiceCheckConfig[];

  beforeEach(() => {
    vi.useFakeTimers();
    services = [
      { name: "DB", checkFn: () => Promise.resolve(true) },
      { name: "Redis", checkFn: () => Promise.resolve(true) },
      { name: "OCR", checkFn: () => Promise.resolve(true) },
      { name: "Storage", checkFn: () => Promise.resolve(true) },
    ];
    poller = new HealthCheckPoller({ services });
  });

  afterEach(() => {
    poller.stopPolling();
    vi.useRealTimers();
  });

  describe("startPolling / stopPolling", () => {
    it("starts polling and sets isPolling to true", () => {
      expect(poller.isPolling()).toBe(false);
      poller.startPolling(5000);
      expect(poller.isPolling()).toBe(true);
    });

    it("does not double-start polling", () => {
      poller.startPolling(5000);
      poller.startPolling(5000); // should be no-op
      expect(poller.isPolling()).toBe(true);
    });

    it("stops polling and sets isPolling to false", () => {
      poller.startPolling(5000);
      poller.stopPolling();
      expect(poller.isPolling()).toBe(false);
    });

    it("runs an immediate check on start", async () => {
      poller.startPolling(5000);
      // Allow promises to resolve
      await vi.advanceTimersByTimeAsync(0);
      const status = poller.getStatus("DB");
      expect(status).toBeDefined();
      expect(status!.status).toBe("healthy");
    });
  });

  describe("getStatus", () => {
    it("returns undefined for unchecked service", () => {
      expect(poller.getStatus("DB")).toBeUndefined();
    });

    it("returns the result after polling", async () => {
      poller.startPolling(5000);
      await vi.advanceTimersByTimeAsync(0);

      const status = poller.getStatus("Redis");
      expect(status).toBeDefined();
      expect(status!.serviceName).toBe("Redis");
      expect(status!.status).toBe("healthy");
      expect(status!.latencyMs).toBeGreaterThanOrEqual(0);
      expect(status!.lastChecked).toBeGreaterThan(0);
    });
  });

  describe("getOverallHealth", () => {
    it("returns healthy when all services are healthy", async () => {
      poller.startPolling(5000);
      await vi.advanceTimersByTimeAsync(0);

      const overall = poller.getOverallHealth();
      expect(overall.status).toBe("healthy");
      expect(overall.healthyCount).toBe(4);
      expect(overall.degradedCount).toBe(0);
      expect(overall.unhealthyCount).toBe(0);
      expect(overall.services).toHaveLength(4);
    });

    it("returns unhealthy when any service is unhealthy", async () => {
      const unhealthyServices: ServiceCheckConfig[] = [
        { name: "DB", checkFn: () => Promise.resolve(true) },
        { name: "Redis", checkFn: () => Promise.reject(new Error("Connection refused")) },
      ];
      const p = new HealthCheckPoller({ services: unhealthyServices });
      p.startPolling(5000);
      await vi.advanceTimersByTimeAsync(0);

      const overall = p.getOverallHealth();
      expect(overall.status).toBe("unhealthy");
      expect(overall.unhealthyCount).toBe(1);
      expect(overall.healthyCount).toBe(1);
      p.stopPolling();
    });

    it("returns degraded when a service exceeds latency threshold", async () => {
      // Use a check function that manipulates Date.now to simulate latency
      let callCount = 0;
      const originalDateNow = Date.now;
      const slowServices: ServiceCheckConfig[] = [
        {
          name: "SlowDB",
          checkFn: async () => {
            // Advance the fake clock by 600ms during the check to simulate latency
            callCount++;
            vi.advanceTimersByTime(600);
            return true;
          },
          degradedThresholdMs: 500,
        },
      ];
      const p = new HealthCheckPoller({ services: slowServices });
      p.startPolling(5000);
      await vi.advanceTimersByTimeAsync(0);

      const status = p.getStatus("SlowDB");
      expect(status).toBeDefined();
      expect(status!.latencyMs).toBeGreaterThanOrEqual(600);
      expect(status!.status).toBe("degraded");
      expect(callCount).toBe(1);
      p.stopPolling();
    });

    it("returns empty aggregation when no checks have run", () => {
      const overall = poller.getOverallHealth();
      expect(overall.status).toBe("healthy");
      expect(overall.services).toHaveLength(0);
    });
  });

  describe("onStatusChange", () => {
    it("notifies callback on initial status detection", async () => {
      const changes: HealthCheckResult[] = [];
      poller.onStatusChange((result) => changes.push(result));
      poller.startPolling(5000);
      await vi.advanceTimersByTimeAsync(0);

      // First check triggers change from undefined to healthy
      expect(changes.length).toBe(4);
      expect(changes.every((c) => c.status === "healthy")).toBe(true);
    });

    it("notifies callback when a service becomes unhealthy", async () => {
      let isHealthy = true;
      const dynamicServices: ServiceCheckConfig[] = [
        { name: "DB", checkFn: () => Promise.resolve(isHealthy) },
      ];
      const p = new HealthCheckPoller({ services: dynamicServices });

      const changes: HealthCheckResult[] = [];
      p.onStatusChange((result) => changes.push(result));

      p.startPolling(5000);
      await vi.advanceTimersByTimeAsync(0);
      expect(changes).toHaveLength(1);
      expect(changes[0].status).toBe("healthy");

      // Simulate failure
      isHealthy = false;
      await vi.advanceTimersByTimeAsync(5000);
      expect(changes).toHaveLength(2);
      expect(changes[1].status).toBe("unhealthy");
      p.stopPolling();
    });

    it("does not notify when status stays the same", async () => {
      const changes: HealthCheckResult[] = [];
      poller.onStatusChange((result) => changes.push(result));
      poller.startPolling(5000);
      await vi.advanceTimersByTimeAsync(0);

      const initialCount = changes.length;
      // Next poll - same status
      await vi.advanceTimersByTimeAsync(5000);
      expect(changes.length).toBe(initialCount);
    });

    it("supports multiple callbacks", async () => {
      const changes1: HealthCheckResult[] = [];
      const changes2: HealthCheckResult[] = [];
      poller.onStatusChange((r) => changes1.push(r));
      poller.onStatusChange((r) => changes2.push(r));

      poller.startPolling(5000);
      await vi.advanceTimersByTimeAsync(0);

      expect(changes1.length).toBeGreaterThan(0);
      expect(changes2.length).toBeGreaterThan(0);
      expect(changes1.length).toBe(changes2.length);
    });
  });

  describe("error handling", () => {
    it("marks service as unhealthy when checkFn throws", async () => {
      const errorServices: ServiceCheckConfig[] = [
        { name: "FailDB", checkFn: () => Promise.reject(new Error("timeout")) },
      ];
      const p = new HealthCheckPoller({ services: errorServices });
      p.startPolling(5000);
      await vi.advanceTimersByTimeAsync(0);

      const status = p.getStatus("FailDB");
      expect(status).toBeDefined();
      expect(status!.status).toBe("unhealthy");
      expect(status!.errorMessage).toBe("timeout");
      p.stopPolling();
    });

    it("marks service as unhealthy when checkFn returns false", async () => {
      const falseServices: ServiceCheckConfig[] = [
        { name: "DownRedis", checkFn: () => Promise.resolve(false) },
      ];
      const p = new HealthCheckPoller({ services: falseServices });
      p.startPolling(5000);
      await vi.advanceTimersByTimeAsync(0);

      const status = p.getStatus("DownRedis");
      expect(status!.status).toBe("unhealthy");
      expect(status!.errorMessage).toBe("Check returned unhealthy");
      p.stopPolling();
    });
  });
});
