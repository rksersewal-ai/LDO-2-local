import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BackupTracker } from "./backupVerification";
import type { BackupRecord } from "./backupVerification";

describe("backupVerification", () => {
  let tracker: BackupTracker;
  const storageKey = "test_backup_tracker";

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    tracker = new BackupTracker({ storageKey });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("recordBackup", () => {
    it("records a new backup entry", () => {
      const record: BackupRecord = {
        id: "bk-1",
        type: "full",
        status: "completed",
        startedAt: 1000,
        completedAt: 2000,
        sizeBytes: 1024,
        checksum: "abc123",
      };

      tracker.recordBackup(record);
      const history = tracker.getBackupHistory();
      expect(history).toHaveLength(1);
      expect(history[0].record).toEqual(record);
    });

    it("updates an existing backup by id", () => {
      const record: BackupRecord = {
        id: "bk-1",
        type: "full",
        status: "in_progress",
        startedAt: 1000,
      };

      tracker.recordBackup(record);

      const updatedRecord: BackupRecord = {
        ...record,
        status: "completed",
        completedAt: 2000,
        sizeBytes: 512,
        checksum: "def456",
      };

      tracker.recordBackup(updatedRecord);
      const history = tracker.getBackupHistory();
      expect(history).toHaveLength(1);
      expect(history[0].record.status).toBe("completed");
      expect(history[0].record.sizeBytes).toBe(512);
    });

    it("stores multiple backup records", () => {
      tracker.recordBackup({
        id: "bk-1",
        type: "full",
        status: "completed",
        startedAt: 1000,
        completedAt: 2000,
      });
      tracker.recordBackup({
        id: "bk-2",
        type: "incremental",
        status: "completed",
        startedAt: 3000,
        completedAt: 4000,
      });
      tracker.recordBackup({
        id: "bk-3",
        type: "differential",
        status: "failed",
        startedAt: 5000,
      });

      const history = tracker.getBackupHistory();
      expect(history).toHaveLength(3);
    });
  });

  describe("verifyBackup", () => {
    it("returns undefined for non-existent backup", () => {
      const result = tracker.verifyBackup("non-existent");
      expect(result).toBeUndefined();
    });

    it("verifies a valid completed backup", () => {
      tracker.recordBackup({
        id: "bk-1",
        type: "full",
        status: "completed",
        startedAt: 1000,
        completedAt: 2000,
        sizeBytes: 1024,
        checksum: "abc123",
      });

      const result = tracker.verifyBackup("bk-1", "abc123", 1024);
      expect(result).toBeDefined();
      expect(result!.checksumValid).toBe(true);
      expect(result!.sizeMatch).toBe(true);
      expect(result!.restorable).toBe(true);
      expect(result!.verifiedAt).toBeGreaterThan(0);
    });

    it("detects checksum mismatch", () => {
      tracker.recordBackup({
        id: "bk-1",
        type: "full",
        status: "completed",
        startedAt: 1000,
        completedAt: 2000,
        sizeBytes: 1024,
        checksum: "abc123",
      });

      const result = tracker.verifyBackup("bk-1", "wrong_checksum", 1024);
      expect(result!.checksumValid).toBe(false);
      expect(result!.restorable).toBe(false);
      expect(result!.details).toContain("checksum invalid");
    });

    it("detects size mismatch", () => {
      tracker.recordBackup({
        id: "bk-1",
        type: "full",
        status: "completed",
        startedAt: 1000,
        completedAt: 2000,
        sizeBytes: 1024,
        checksum: "abc123",
      });

      const result = tracker.verifyBackup("bk-1", "abc123", 2048);
      expect(result!.sizeMatch).toBe(false);
      expect(result!.restorable).toBe(false);
      expect(result!.details).toContain("size mismatch");
    });

    it("marks incomplete backup as not restorable", () => {
      tracker.recordBackup({
        id: "bk-1",
        type: "full",
        status: "in_progress",
        startedAt: 1000,
        sizeBytes: 1024,
        checksum: "abc123",
      });

      const result = tracker.verifyBackup("bk-1", "abc123", 1024);
      expect(result!.restorable).toBe(false);
      expect(result!.details).toContain("status is in_progress");
    });

    it("stores verification result on the entry", () => {
      tracker.recordBackup({
        id: "bk-1",
        type: "full",
        status: "completed",
        startedAt: 1000,
        completedAt: 2000,
        sizeBytes: 1024,
        checksum: "abc123",
      });

      tracker.verifyBackup("bk-1", "abc123", 1024);
      const history = tracker.getBackupHistory();
      expect(history[0].verification).toBeDefined();
      expect(history[0].verification!.restorable).toBe(true);
    });

    it("verifies without expected values using presence checks", () => {
      tracker.recordBackup({
        id: "bk-1",
        type: "full",
        status: "completed",
        startedAt: 1000,
        completedAt: 2000,
        sizeBytes: 1024,
        checksum: "abc123",
      });

      const result = tracker.verifyBackup("bk-1");
      expect(result!.checksumValid).toBe(true);
      expect(result!.sizeMatch).toBe(true);
      expect(result!.restorable).toBe(true);
    });

    it("fails presence check when checksum is missing", () => {
      tracker.recordBackup({
        id: "bk-1",
        type: "full",
        status: "completed",
        startedAt: 1000,
        completedAt: 2000,
        sizeBytes: 1024,
      });

      const result = tracker.verifyBackup("bk-1");
      expect(result!.checksumValid).toBe(false);
      expect(result!.restorable).toBe(false);
    });
  });

  describe("getLastSuccessful", () => {
    it("returns undefined when no backups exist", () => {
      expect(tracker.getLastSuccessful()).toBeUndefined();
    });

    it("returns undefined when no completed backups exist", () => {
      tracker.recordBackup({
        id: "bk-1",
        type: "full",
        status: "failed",
        startedAt: 1000,
      });

      expect(tracker.getLastSuccessful()).toBeUndefined();
    });

    it("returns the most recently completed backup", () => {
      tracker.recordBackup({
        id: "bk-1",
        type: "full",
        status: "completed",
        startedAt: 1000,
        completedAt: 2000,
      });
      tracker.recordBackup({
        id: "bk-2",
        type: "incremental",
        status: "completed",
        startedAt: 3000,
        completedAt: 5000,
      });
      tracker.recordBackup({
        id: "bk-3",
        type: "full",
        status: "completed",
        startedAt: 4000,
        completedAt: 4500,
      });

      const last = tracker.getLastSuccessful();
      expect(last).toBeDefined();
      expect(last!.record.id).toBe("bk-2"); // completedAt: 5000 is latest
    });
  });

  describe("isOverdue", () => {
    it("returns true when no backups exist", () => {
      expect(tracker.isOverdue(24)).toBe(true);
    });

    it("returns true when last backup is older than threshold", () => {
      vi.setSystemTime(0);
      tracker.recordBackup({
        id: "bk-1",
        type: "full",
        status: "completed",
        startedAt: 0,
        completedAt: 1000,
      });

      // Advance 25 hours
      vi.setSystemTime(25 * 3600 * 1000);
      expect(tracker.isOverdue(24)).toBe(true);
    });

    it("returns false when last backup is within threshold", () => {
      vi.setSystemTime(0);
      tracker.recordBackup({
        id: "bk-1",
        type: "full",
        status: "completed",
        startedAt: 0,
        completedAt: 1000,
      });

      // Advance 12 hours
      vi.setSystemTime(12 * 3600 * 1000);
      expect(tracker.isOverdue(24)).toBe(false);
    });

    it("ignores failed backups when checking overdue", () => {
      vi.setSystemTime(0);
      tracker.recordBackup({
        id: "bk-1",
        type: "full",
        status: "completed",
        startedAt: 0,
        completedAt: 1000,
      });

      // Advance 25 hours
      vi.setSystemTime(25 * 3600 * 1000);

      // Record a failed backup (should not reset overdue)
      tracker.recordBackup({
        id: "bk-2",
        type: "full",
        status: "failed",
        startedAt: 25 * 3600 * 1000,
      });

      expect(tracker.isOverdue(24)).toBe(true);
    });
  });

  describe("getBackupHistory", () => {
    it("returns empty array when no backups recorded", () => {
      expect(tracker.getBackupHistory()).toEqual([]);
    });

    it("returns all backup entries", () => {
      tracker.recordBackup({
        id: "bk-1",
        type: "full",
        status: "completed",
        startedAt: 1000,
        completedAt: 2000,
      });
      tracker.recordBackup({
        id: "bk-2",
        type: "incremental",
        status: "in_progress",
        startedAt: 3000,
      });

      const history = tracker.getBackupHistory();
      expect(history).toHaveLength(2);
      expect(history[0].record.id).toBe("bk-1");
      expect(history[1].record.id).toBe("bk-2");
    });
  });

  describe("removeBackup", () => {
    it("removes a backup by id", () => {
      tracker.recordBackup({
        id: "bk-1",
        type: "full",
        status: "completed",
        startedAt: 1000,
        completedAt: 2000,
      });
      tracker.recordBackup({
        id: "bk-2",
        type: "incremental",
        status: "completed",
        startedAt: 3000,
        completedAt: 4000,
      });

      tracker.removeBackup("bk-1");
      const history = tracker.getBackupHistory();
      expect(history).toHaveLength(1);
      expect(history[0].record.id).toBe("bk-2");
    });
  });

  describe("clear", () => {
    it("removes all backup data", () => {
      tracker.recordBackup({
        id: "bk-1",
        type: "full",
        status: "completed",
        startedAt: 1000,
        completedAt: 2000,
      });

      tracker.clear();
      expect(tracker.getBackupHistory()).toEqual([]);
    });
  });

  describe("persistence", () => {
    it("persists data across tracker instances", () => {
      tracker.recordBackup({
        id: "bk-1",
        type: "full",
        status: "completed",
        startedAt: 1000,
        completedAt: 2000,
        checksum: "abc",
        sizeBytes: 512,
      });

      // Create new instance with same key
      const tracker2 = new BackupTracker({ storageKey });
      const history = tracker2.getBackupHistory();
      expect(history).toHaveLength(1);
      expect(history[0].record.id).toBe("bk-1");
    });

    it("handles corrupted localStorage gracefully", () => {
      localStorage.setItem(storageKey, "not valid json{{{");
      const tracker2 = new BackupTracker({ storageKey });
      expect(tracker2.getBackupHistory()).toEqual([]);
    });
  });
});
