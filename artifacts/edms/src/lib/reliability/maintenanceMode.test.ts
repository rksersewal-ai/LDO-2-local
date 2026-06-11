import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MaintenanceDetector, DEFAULT_MAINTENANCE_MESSAGE } from "./maintenanceMode";
import type { MaintenanceInfo } from "./maintenanceMode";

describe("maintenanceMode", () => {
  let detector: MaintenanceDetector;
  const storageKey = "test_maintenance_mode";

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    detector = new MaintenanceDetector({ storageKey, simulationMode: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkMaintenanceStatus", () => {
    it("returns not in maintenance by default", async () => {
      const info = await detector.checkMaintenanceStatus();
      expect(info.inMaintenance).toBe(false);
      expect(info.message).toBe("");
    });

    it("detects maintenance when flag is set in localStorage", async () => {
      detector.enableMaintenance("Upgrading database");
      const info = await detector.checkMaintenanceStatus();
      expect(info.inMaintenance).toBe(true);
      expect(info.message).toBe("Upgrading database");
    });

    it("detects maintenance cleared when flag is removed", async () => {
      detector.enableMaintenance("Upgrade in progress");
      await detector.checkMaintenanceStatus();
      expect(detector.isInMaintenance()).toBe(true);

      detector.disableMaintenance();
      await detector.checkMaintenanceStatus();
      expect(detector.isInMaintenance()).toBe(false);
    });

    it("includes estimated end time", async () => {
      const endTime = "2025-01-15T10:00:00Z";
      detector.enableMaintenance("Scheduled maintenance", endTime);
      const info = await detector.checkMaintenanceStatus();
      expect(info.estimatedEndTime).toBe(endTime);
    });

    it("uses custom check function when provided", async () => {
      const customInfo: MaintenanceInfo = {
        inMaintenance: true,
        message: "Custom maintenance check",
        estimatedEndTime: "2025-01-20T12:00:00Z",
      };

      const customDetector = new MaintenanceDetector({
        simulationMode: false,
        customCheckFn: () => Promise.resolve(customInfo),
      });

      const info = await customDetector.checkMaintenanceStatus();
      expect(info.inMaintenance).toBe(true);
      expect(info.message).toBe("Custom maintenance check");
      expect(info.estimatedEndTime).toBe("2025-01-20T12:00:00Z");
    });
  });

  describe("isInMaintenance", () => {
    it("returns false before any check", () => {
      expect(detector.isInMaintenance()).toBe(false);
    });

    it("returns true after detecting maintenance", async () => {
      detector.enableMaintenance();
      await detector.checkMaintenanceStatus();
      expect(detector.isInMaintenance()).toBe(true);
    });

    it("returns false after maintenance is disabled", async () => {
      detector.enableMaintenance();
      await detector.checkMaintenanceStatus();
      detector.disableMaintenance();
      await detector.checkMaintenanceStatus();
      expect(detector.isInMaintenance()).toBe(false);
    });
  });

  describe("getMaintenanceMessage", () => {
    it("returns empty string when not in maintenance", () => {
      expect(detector.getMaintenanceMessage()).toBe("");
    });

    it("returns the maintenance message", async () => {
      detector.enableMaintenance("Server is being updated");
      await detector.checkMaintenanceStatus();
      expect(detector.getMaintenanceMessage()).toBe("Server is being updated");
    });

    it("uses default message when none specified", async () => {
      detector.enableMaintenance();
      await detector.checkMaintenanceStatus();
      expect(detector.getMaintenanceMessage()).toBe(DEFAULT_MAINTENANCE_MESSAGE);
    });
  });

  describe("getEstimatedEndTime", () => {
    it("returns undefined when not in maintenance", () => {
      expect(detector.getEstimatedEndTime()).toBeUndefined();
    });

    it("returns the estimated end time", async () => {
      detector.enableMaintenance("Maintenance", "2025-06-01T15:00:00Z");
      await detector.checkMaintenanceStatus();
      expect(detector.getEstimatedEndTime()).toBe("2025-06-01T15:00:00Z");
    });
  });

  describe("onMaintenanceChange", () => {
    it("notifies when transitioning to maintenance mode", async () => {
      const notifications: MaintenanceInfo[] = [];
      detector.onMaintenanceChange((info) => notifications.push(info));

      detector.enableMaintenance("Going down");
      await detector.checkMaintenanceStatus();

      expect(notifications).toHaveLength(1);
      expect(notifications[0].inMaintenance).toBe(true);
      expect(notifications[0].message).toBe("Going down");
    });

    it("notifies when transitioning out of maintenance mode", async () => {
      detector.enableMaintenance("Maintenance");
      await detector.checkMaintenanceStatus();

      const notifications: MaintenanceInfo[] = [];
      detector.onMaintenanceChange((info) => notifications.push(info));

      detector.disableMaintenance();
      await detector.checkMaintenanceStatus();

      expect(notifications).toHaveLength(1);
      expect(notifications[0].inMaintenance).toBe(false);
    });

    it("does not notify when status does not change", async () => {
      detector.enableMaintenance("Maintenance");
      await detector.checkMaintenanceStatus();

      const notifications: MaintenanceInfo[] = [];
      detector.onMaintenanceChange((info) => notifications.push(info));

      // Check again without changing state
      await detector.checkMaintenanceStatus();
      expect(notifications).toHaveLength(0);
    });

    it("supports multiple callbacks", async () => {
      const cb1: MaintenanceInfo[] = [];
      const cb2: MaintenanceInfo[] = [];
      detector.onMaintenanceChange((info) => cb1.push(info));
      detector.onMaintenanceChange((info) => cb2.push(info));

      detector.enableMaintenance("Updating");
      await detector.checkMaintenanceStatus();

      expect(cb1).toHaveLength(1);
      expect(cb2).toHaveLength(1);
    });
  });

  describe("simulation mode", () => {
    it("enableMaintenance has no effect when simulation is disabled", async () => {
      const nonSimDetector = new MaintenanceDetector({
        simulationMode: false,
        storageKey,
        customCheckFn: () => Promise.resolve({ inMaintenance: false, message: "" }),
      });

      nonSimDetector.enableMaintenance("Test");
      const info = await nonSimDetector.checkMaintenanceStatus();
      expect(info.inMaintenance).toBe(false);
    });

    it("disableMaintenance has no effect when simulation is disabled", () => {
      const nonSimDetector = new MaintenanceDetector({
        simulationMode: false,
        storageKey,
      });

      // Should not throw
      nonSimDetector.disableMaintenance();
    });

    it("handles corrupted localStorage gracefully", async () => {
      localStorage.setItem(storageKey, "invalid json{{{");
      const info = await detector.checkMaintenanceStatus();
      expect(info.inMaintenance).toBe(false);
    });
  });

  describe("getCurrentInfo", () => {
    it("returns a copy of current info", async () => {
      detector.enableMaintenance("Test message", "2025-01-01T00:00:00Z");
      await detector.checkMaintenanceStatus();

      const info = detector.getCurrentInfo();
      expect(info.inMaintenance).toBe(true);
      expect(info.message).toBe("Test message");
      expect(info.estimatedEndTime).toBe("2025-01-01T00:00:00Z");
    });
  });
});
