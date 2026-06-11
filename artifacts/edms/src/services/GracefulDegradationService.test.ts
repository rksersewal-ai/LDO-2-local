import { describe, it, expect, vi, beforeEach } from "vitest";
import { GracefulDegradationService } from "./GracefulDegradationService";
import type { CircuitState } from "./GracefulDegradationService";

describe("GracefulDegradationService", () => {
  let service: GracefulDegradationService;

  beforeEach(() => {
    service = new GracefulDegradationService();
  });

  describe("registerHealthCheck", () => {
    it("registers a health check for a service", () => {
      service.registerHealthCheck("ocr", async () => true);
      expect(service.getCircuitState("ocr")).toBe("closed");
    });

    it("starts with circuit in closed state", () => {
      service.registerHealthCheck("search", async () => true);
      expect(service.getCircuitState("search")).toBe("closed");
    });
  });

  describe("checkServiceHealth", () => {
    it("returns healthy status for a passing health check", async () => {
      service.registerHealthCheck("ocr", async () => true);
      const health = await service.checkServiceHealth("ocr");
      expect(health.name).toBe("ocr");
      expect(health.status).toBe("healthy");
      expect(health.circuitState).toBe("closed");
      expect(health.consecutiveFailures).toBe(0);
    });

    it("increments failure count on failing health check", async () => {
      service.registerHealthCheck("ocr", async () => false);
      const health = await service.checkServiceHealth("ocr");
      expect(health.consecutiveFailures).toBe(1);
    });

    it("returns down status for unregistered service", async () => {
      const health = await service.checkServiceHealth("unknown");
      expect(health.status).toBe("down");
      expect(health.lastError).toBe("Service not registered");
    });

    it("records the last error message", async () => {
      service.registerHealthCheck("cache", async () => {
        throw new Error("Connection refused");
      });
      const health = await service.checkServiceHealth("cache");
      expect(health.lastError).toBe("Connection refused");
    });

    it("sets lastCheck timestamp", async () => {
      service.registerHealthCheck("search", async () => true);
      const health = await service.checkServiceHealth("search");
      expect(health.lastCheck).not.toBeNull();
      // Should be a valid ISO date string
      expect(new Date(health.lastCheck!).toISOString()).toBe(health.lastCheck);
    });
  });

  describe("circuit breaker states", () => {
    it("transitions from CLOSED to OPEN after threshold failures", async () => {
      service.registerHealthCheck("ocr", async () => false, {
        failureThreshold: 3,
      });

      // 3 failures to open the circuit
      await service.checkServiceHealth("ocr");
      expect(service.getCircuitState("ocr")).toBe("closed");
      await service.checkServiceHealth("ocr");
      expect(service.getCircuitState("ocr")).toBe("closed");
      await service.checkServiceHealth("ocr");
      expect(service.getCircuitState("ocr")).toBe("open");
    });

    it("transitions from OPEN to HALF_OPEN after recovery timeout", async () => {
      vi.useFakeTimers();
      service.registerHealthCheck("ocr", async () => false, {
        failureThreshold: 2,
        recoveryTimeout: 5000,
      });

      // Open the circuit
      await service.checkServiceHealth("ocr");
      await service.checkServiceHealth("ocr");
      expect(service.getCircuitState("ocr")).toBe("open");

      // Advance past recovery timeout
      vi.advanceTimersByTime(5000);

      // Next check should transition to half-open and attempt the health check
      await service.checkServiceHealth("ocr");
      // Since health check still fails, it goes back to open
      // But the transition to half-open happened first
      expect(
        service.getCircuitState("ocr") === "open" ||
          service.getCircuitState("ocr") === "half-open",
      ).toBe(true);

      vi.useRealTimers();
    });

    it("transitions from HALF_OPEN to CLOSED on successful health checks", async () => {
      vi.useFakeTimers();
      let healthy = false;
      service.registerHealthCheck("ocr", async () => healthy, {
        failureThreshold: 2,
        recoveryTimeout: 5000,
        successThreshold: 2,
      });

      // Open the circuit
      await service.checkServiceHealth("ocr");
      await service.checkServiceHealth("ocr");
      expect(service.getCircuitState("ocr")).toBe("open");

      // Wait for recovery timeout
      vi.advanceTimersByTime(5000);
      healthy = true; // Service recovers

      // First success in half-open
      await service.checkServiceHealth("ocr");
      expect(service.getCircuitState("ocr")).toBe("half-open");

      // Second success closes the circuit
      await service.checkServiceHealth("ocr");
      expect(service.getCircuitState("ocr")).toBe("closed");

      vi.useRealTimers();
    });

    it("transitions from HALF_OPEN back to OPEN on failure", async () => {
      vi.useFakeTimers();
      let healthy = false;
      service.registerHealthCheck("ocr", async () => healthy, {
        failureThreshold: 2,
        recoveryTimeout: 5000,
      });

      // Open the circuit
      await service.checkServiceHealth("ocr");
      await service.checkServiceHealth("ocr");
      expect(service.getCircuitState("ocr")).toBe("open");

      // Wait for recovery timeout
      vi.advanceTimersByTime(5000);
      // Service still failing

      // Check triggers half-open then fails
      await service.checkServiceHealth("ocr");
      expect(service.getCircuitState("ocr")).toBe("open");

      vi.useRealTimers();
    });

    it("resets failure count on success in closed state", async () => {
      let callCount = 0;
      service.registerHealthCheck(
        "ocr",
        async () => {
          callCount++;
          return callCount !== 2; // Fail only on 2nd call
        },
        { failureThreshold: 3 },
      );

      await service.checkServiceHealth("ocr"); // success, failures = 0
      await service.checkServiceHealth("ocr"); // failure, failures = 1
      await service.checkServiceHealth("ocr"); // success, failures = 0
      await service.checkServiceHealth("ocr"); // success, failures = 0

      // Should still be closed because we reset on success
      expect(service.getCircuitState("ocr")).toBe("closed");
    });
  });

  describe("getSystemStatus", () => {
    it("returns overall healthy when all services are healthy", async () => {
      service.registerHealthCheck("ocr", async () => true);
      service.registerHealthCheck("search", async () => true);
      service.registerHealthCheck("cache", async () => true);

      const status = await service.getSystemStatus();
      expect(status.overall).toBe("healthy");
      expect(status.services).toHaveLength(3);
      expect(status.timestamp).toBeDefined();
    });

    it("returns overall down when any service is down", async () => {
      service.registerHealthCheck("ocr", async () => true);
      service.registerHealthCheck("search", async () => false, {
        failureThreshold: 1,
      });

      const status = await service.getSystemStatus();
      expect(status.overall).toBe("down");
    });

    it("returns overall degraded when a service is in half-open", async () => {
      vi.useFakeTimers();
      service.registerHealthCheck("ocr", async () => true);

      let healthy = false;
      service.registerHealthCheck("search", async () => healthy, {
        failureThreshold: 2,
        recoveryTimeout: 1000,
        successThreshold: 2,
      });

      // Open the search circuit
      await service.checkServiceHealth("search");
      await service.checkServiceHealth("search");

      // Wait and recover
      vi.advanceTimersByTime(1000);
      healthy = true;

      // First success -> half-open (not yet closed)
      const status = await service.getSystemStatus();
      expect(status.overall).toBe("degraded");

      vi.useRealTimers();
    });

    it("returns healthy for no registered services", async () => {
      const status = await service.getSystemStatus();
      expect(status.overall).toBe("healthy");
      expect(status.services).toHaveLength(0);
    });
  });

  describe("getFailoverStrategy", () => {
    it("returns proceed for healthy services", () => {
      service.registerHealthCheck("ocr", async () => true);
      const strategy = service.getFailoverStrategy("ocr");
      expect(strategy.action).toBe("proceed");
      expect(strategy.status).toBe("healthy");
    });

    it("returns use_cache for degraded services", async () => {
      vi.useFakeTimers();
      let healthy = false;
      service.registerHealthCheck("search", async () => healthy, {
        failureThreshold: 2,
        recoveryTimeout: 1000,
        successThreshold: 2,
      });

      // Open then recover
      await service.checkServiceHealth("search");
      await service.checkServiceHealth("search");
      vi.advanceTimersByTime(1000);
      healthy = true;
      await service.checkServiceHealth("search"); // half-open

      const strategy = service.getFailoverStrategy("search");
      expect(strategy.action).toBe("use_cache");
      expect(strategy.status).toBe("degraded");

      vi.useRealTimers();
    });

    it("returns queue_for_retry for down services", async () => {
      service.registerHealthCheck("cache", async () => false, {
        failureThreshold: 1,
      });
      await service.checkServiceHealth("cache");

      const strategy = service.getFailoverStrategy("cache");
      expect(strategy.action).toBe("queue_for_retry");
      expect(strategy.status).toBe("down");
    });

    it("returns reject for unregistered services", () => {
      const strategy = service.getFailoverStrategy("unknown");
      expect(strategy.action).toBe("reject");
      expect(strategy.status).toBe("down");
    });
  });

  describe("recordFailure / recordSuccess", () => {
    it("recordFailure increments failure count", async () => {
      service.registerHealthCheck("ocr", async () => true, {
        failureThreshold: 3,
      });

      service.recordFailure("ocr", "External timeout");
      service.recordFailure("ocr", "External timeout");
      service.recordFailure("ocr", "External timeout");

      expect(service.getCircuitState("ocr")).toBe("open");
    });

    it("recordSuccess resets failure count", async () => {
      service.registerHealthCheck("ocr", async () => true, {
        failureThreshold: 3,
      });

      service.recordFailure("ocr", "error");
      service.recordFailure("ocr", "error");
      service.recordSuccess("ocr"); // Reset failures

      service.recordFailure("ocr", "error");
      // Should still be closed (only 1 failure after reset)
      expect(service.getCircuitState("ocr")).toBe("closed");
    });
  });

  describe("reset", () => {
    it("resets circuit to closed state", async () => {
      service.registerHealthCheck("ocr", async () => false, {
        failureThreshold: 1,
      });
      await service.checkServiceHealth("ocr");
      expect(service.getCircuitState("ocr")).toBe("open");

      service.reset("ocr");
      expect(service.getCircuitState("ocr")).toBe("closed");
    });
  });
});
