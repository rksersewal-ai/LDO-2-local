import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HeartbeatTracker } from "./workerHeartbeat";

describe("workerHeartbeat", () => {
  let tracker: HeartbeatTracker;
  const storageKey = "test_worker_heartbeats";

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    tracker = new HeartbeatTracker({
      stalenessThresholdMs: 30000,
      deadThresholdMs: 90000,
      storageKey,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("registerWorker", () => {
    it("registers a new worker", () => {
      tracker.registerWorker("w-1", "Document Processor");
      const workers = tracker.getAllWorkers();
      expect(workers).toHaveLength(1);
      expect(workers[0].id).toBe("w-1");
      expect(workers[0].name).toBe("Document Processor");
      expect(workers[0].status).toBe("alive");
    });

    it("updates an existing worker name on re-registration", () => {
      tracker.registerWorker("w-1", "Old Name");
      tracker.registerWorker("w-1", "New Name");
      const workers = tracker.getAllWorkers();
      expect(workers).toHaveLength(1);
      expect(workers[0].name).toBe("New Name");
    });

    it("registers multiple workers", () => {
      tracker.registerWorker("w-1", "Worker A");
      tracker.registerWorker("w-2", "Worker B");
      tracker.registerWorker("w-3", "Worker C");
      expect(tracker.getAllWorkers()).toHaveLength(3);
    });

    it("sets initial heartbeat to current time", () => {
      vi.setSystemTime(5000);
      tracker.registerWorker("w-1", "Test");
      const info = tracker.getWorkerStatus("w-1");
      expect(info!.lastHeartbeat).toBe(5000);
    });
  });

  describe("recordHeartbeat", () => {
    it("updates lastHeartbeat timestamp", () => {
      vi.setSystemTime(1000);
      tracker.registerWorker("w-1", "Worker");

      vi.setSystemTime(5000);
      tracker.recordHeartbeat("w-1");

      const info = tracker.getWorkerStatus("w-1");
      expect(info!.lastHeartbeat).toBe(5000);
    });

    it("returns true for existing worker", () => {
      tracker.registerWorker("w-1", "Worker");
      const result = tracker.recordHeartbeat("w-1");
      expect(result).toBe(true);
    });

    it("returns false for non-existent worker", () => {
      const result = tracker.recordHeartbeat("non-existent");
      expect(result).toBe(false);
    });

    it("revives a stale worker back to alive", () => {
      vi.setSystemTime(0);
      tracker.registerWorker("w-1", "Worker");

      // Advance past staleness threshold
      vi.setSystemTime(35000);
      expect(tracker.getWorkerStatus("w-1")!.status).toBe("stale");

      // Record heartbeat to revive
      tracker.recordHeartbeat("w-1");
      expect(tracker.getWorkerStatus("w-1")!.status).toBe("alive");
    });
  });

  describe("getWorkerStatus", () => {
    it("returns undefined for non-existent worker", () => {
      expect(tracker.getWorkerStatus("non-existent")).toBeUndefined();
    });

    it("returns alive status for recently active worker", () => {
      vi.setSystemTime(1000);
      tracker.registerWorker("w-1", "Worker");

      vi.setSystemTime(10000);
      const info = tracker.getWorkerStatus("w-1");
      expect(info!.status).toBe("alive");
    });

    it("returns stale status after staleness threshold", () => {
      vi.setSystemTime(0);
      tracker.registerWorker("w-1", "Worker");

      vi.setSystemTime(31000); // 31s > 30s threshold
      const info = tracker.getWorkerStatus("w-1");
      expect(info!.status).toBe("stale");
    });

    it("returns dead status after dead threshold", () => {
      vi.setSystemTime(0);
      tracker.registerWorker("w-1", "Worker");

      vi.setSystemTime(91000); // 91s > 90s threshold
      const info = tracker.getWorkerStatus("w-1");
      expect(info!.status).toBe("dead");
    });

    it("includes all worker info fields", () => {
      vi.setSystemTime(2000);
      tracker.registerWorker("w-1", "Test Worker");

      const info = tracker.getWorkerStatus("w-1");
      expect(info).toEqual({
        id: "w-1",
        name: "Test Worker",
        lastHeartbeat: 2000,
        status: "alive",
        registeredAt: 2000,
      });
    });
  });

  describe("getStaleWorkers", () => {
    it("returns empty array when all workers are alive", () => {
      tracker.registerWorker("w-1", "Worker 1");
      tracker.registerWorker("w-2", "Worker 2");
      expect(tracker.getStaleWorkers()).toEqual([]);
    });

    it("returns workers that exceed the threshold", () => {
      vi.setSystemTime(0);
      tracker.registerWorker("w-1", "Worker 1");
      tracker.registerWorker("w-2", "Worker 2");

      vi.setSystemTime(20000);
      tracker.recordHeartbeat("w-1"); // w-1 is fresh

      vi.setSystemTime(35000); // 35s from w-2 registration

      const stale = tracker.getStaleWorkers();
      expect(stale).toHaveLength(1);
      expect(stale[0].id).toBe("w-2");
    });

    it("uses custom threshold when provided", () => {
      vi.setSystemTime(0);
      tracker.registerWorker("w-1", "Worker");

      vi.setSystemTime(10000);
      // Default threshold (30s) would not trigger, but custom 5s will
      const stale = tracker.getStaleWorkers(5000);
      expect(stale).toHaveLength(1);
      expect(stale[0].id).toBe("w-1");
    });

    it("includes dead workers in stale results", () => {
      vi.setSystemTime(0);
      tracker.registerWorker("w-1", "Worker");

      vi.setSystemTime(100000); // Past dead threshold
      const stale = tracker.getStaleWorkers();
      expect(stale).toHaveLength(1);
      expect(stale[0].status).toBe("dead");
    });
  });

  describe("getAllWorkers", () => {
    it("returns empty array when no workers registered", () => {
      expect(tracker.getAllWorkers()).toEqual([]);
    });

    it("returns all workers with computed status", () => {
      vi.setSystemTime(0);
      tracker.registerWorker("w-1", "Alive Worker");
      tracker.registerWorker("w-2", "Stale Worker");
      tracker.registerWorker("w-3", "Dead Worker");

      vi.setSystemTime(95000); // All are dead now
      tracker.recordHeartbeat("w-1"); // Revive w-1
      vi.setSystemTime(95000); // w-1 alive, w-2 & w-3 dead

      const workers = tracker.getAllWorkers();
      expect(workers).toHaveLength(3);

      const w1 = workers.find((w) => w.id === "w-1")!;
      expect(w1.status).toBe("alive");

      const w2 = workers.find((w) => w.id === "w-2")!;
      expect(w2.status).toBe("dead");
    });
  });

  describe("removeWorker", () => {
    it("removes an existing worker", () => {
      tracker.registerWorker("w-1", "Worker 1");
      tracker.registerWorker("w-2", "Worker 2");

      const result = tracker.removeWorker("w-1");
      expect(result).toBe(true);
      expect(tracker.getAllWorkers()).toHaveLength(1);
      expect(tracker.getWorkerStatus("w-1")).toBeUndefined();
    });

    it("returns false when worker does not exist", () => {
      const result = tracker.removeWorker("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("clear", () => {
    it("removes all workers", () => {
      tracker.registerWorker("w-1", "Worker 1");
      tracker.registerWorker("w-2", "Worker 2");

      tracker.clear();
      expect(tracker.getAllWorkers()).toEqual([]);
    });
  });

  describe("configurable thresholds", () => {
    it("uses custom staleness threshold", () => {
      const customTracker = new HeartbeatTracker({
        stalenessThresholdMs: 5000,
        deadThresholdMs: 15000,
        storageKey: "test_custom_thresholds",
      });

      vi.setSystemTime(0);
      customTracker.registerWorker("w-1", "Worker");

      vi.setSystemTime(6000);
      expect(customTracker.getWorkerStatus("w-1")!.status).toBe("stale");

      vi.setSystemTime(16000);
      expect(customTracker.getWorkerStatus("w-1")!.status).toBe("dead");
    });

    it("defaults to 30s staleness and 90s dead", () => {
      const defaultTracker = new HeartbeatTracker({ storageKey: "test_defaults" });

      vi.setSystemTime(0);
      defaultTracker.registerWorker("w-1", "Worker");

      vi.setSystemTime(29000);
      expect(defaultTracker.getWorkerStatus("w-1")!.status).toBe("alive");

      vi.setSystemTime(31000);
      expect(defaultTracker.getWorkerStatus("w-1")!.status).toBe("stale");

      vi.setSystemTime(91000);
      expect(defaultTracker.getWorkerStatus("w-1")!.status).toBe("dead");
    });
  });

  describe("persistence", () => {
    it("persists workers across tracker instances", () => {
      tracker.registerWorker("w-1", "Worker");
      tracker.recordHeartbeat("w-1");

      const tracker2 = new HeartbeatTracker({
        stalenessThresholdMs: 30000,
        deadThresholdMs: 90000,
        storageKey,
      });

      const workers = tracker2.getAllWorkers();
      expect(workers).toHaveLength(1);
      expect(workers[0].id).toBe("w-1");
    });

    it("handles corrupted localStorage gracefully", () => {
      localStorage.setItem(storageKey, "invalid json{{{");
      const tracker2 = new HeartbeatTracker({ storageKey });
      expect(tracker2.getAllWorkers()).toEqual([]);
    });
  });
});
