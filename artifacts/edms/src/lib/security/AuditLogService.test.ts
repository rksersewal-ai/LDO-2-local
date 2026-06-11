import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuditLogService, deterministicHash } from "./AuditLogService";
import type { AuditLogEntry } from "./AuditLogService";

// Mock the feature flag module
vi.mock("../featureFlags", () => ({
  isFeatureEnabled: vi.fn((flag: string) => flag === "AUDIT_HASH_CHAIN"),
}));

describe("AuditLogService", () => {
  let service: AuditLogService;

  beforeEach(() => {
    localStorage.clear();
    service = new AuditLogService({ storageKey: "test_audit_log" });
  });

  describe("deterministicHash", () => {
    it("produces consistent hash for same input", () => {
      const hash1 = deterministicHash("hello world");
      const hash2 = deterministicHash("hello world");
      expect(hash1).toBe(hash2);
    });

    it("produces different hashes for different inputs", () => {
      const hash1 = deterministicHash("input-a");
      const hash2 = deterministicHash("input-b");
      expect(hash1).not.toBe(hash2);
    });

    it("returns a hexadecimal string", () => {
      const hash = deterministicHash("test");
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it("handles empty string input", () => {
      const hash = deterministicHash("");
      expect(hash).toBeTruthy();
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe("logOperation", () => {
    it("creates an audit entry with all required fields", () => {
      const entry = service.logOperation({
        userId: "user-1",
        operation: "view",
        documentId: "doc-1",
      });

      expect(entry).not.toBeNull();
      expect(entry!.id).toMatch(/^audit-/);
      expect(entry!.timestamp).toBeTruthy();
      expect(entry!.userId).toBe("user-1");
      expect(entry!.operation).toBe("view");
      expect(entry!.documentId).toBe("doc-1");
      expect(entry!.previousHash).toBe("");
      expect(entry!.currentHash).toBeTruthy();
    });

    it("chains hashes between consecutive entries", () => {
      const entry1 = service.logOperation({
        userId: "user-1",
        operation: "create",
        documentId: "doc-1",
      });

      const entry2 = service.logOperation({
        userId: "user-1",
        operation: "update",
        documentId: "doc-1",
      });

      expect(entry2!.previousHash).toBe(entry1!.currentHash);
    });

    it("first entry has empty string as previousHash (genesis)", () => {
      const entry = service.logOperation({
        userId: "user-1",
        operation: "create",
        documentId: "doc-1",
      });

      expect(entry!.previousHash).toBe("");
    });

    it("persists entries to localStorage", () => {
      service.logOperation({
        userId: "user-1",
        operation: "view",
        documentId: "doc-1",
      });

      const raw = localStorage.getItem("test_audit_log");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveLength(1);
    });

    it("tracks all supported operation types", () => {
      const operations = ["view", "download", "create", "update", "delete", "approve", "reject"] as const;

      for (const op of operations) {
        const entry = service.logOperation({
          userId: "user-1",
          operation: op,
          documentId: "doc-1",
        });
        expect(entry!.operation).toBe(op);
      }
    });

    it("enforces maxEntries limit", () => {
      const smallService = new AuditLogService({
        storageKey: "test_audit_small",
        maxEntries: 3,
      });

      for (let i = 0; i < 5; i++) {
        smallService.logOperation({
          userId: "user-1",
          operation: "view",
          documentId: `doc-${i}`,
        });
      }

      const trail = smallService.getAuditTrail();
      expect(trail).toHaveLength(3);
    });
  });

  describe("getAuditTrail", () => {
    it("returns empty array when no entries exist", () => {
      const trail = service.getAuditTrail();
      expect(trail).toEqual([]);
    });

    it("returns all entries in chronological order", () => {
      service.logOperation({ userId: "user-1", operation: "create", documentId: "doc-1" });
      service.logOperation({ userId: "user-1", operation: "update", documentId: "doc-1" });
      service.logOperation({ userId: "user-1", operation: "approve", documentId: "doc-1" });

      const trail = service.getAuditTrail();
      expect(trail).toHaveLength(3);
      expect(trail[0].operation).toBe("create");
      expect(trail[1].operation).toBe("update");
      expect(trail[2].operation).toBe("approve");
    });
  });

  describe("verifyChainIntegrity", () => {
    it("returns valid for empty log", () => {
      const result = service.verifyChainIntegrity();
      expect(result.valid).toBe(true);
      expect(result.entriesChecked).toBe(0);
      expect(result.firstInvalidIndex).toBe(-1);
    });

    it("returns valid for untampered chain", () => {
      service.logOperation({ userId: "user-1", operation: "create", documentId: "doc-1" });
      service.logOperation({ userId: "user-1", operation: "update", documentId: "doc-1" });
      service.logOperation({ userId: "user-2", operation: "approve", documentId: "doc-1" });

      const result = service.verifyChainIntegrity();
      expect(result.valid).toBe(true);
      expect(result.entriesChecked).toBe(3);
      expect(result.firstInvalidIndex).toBe(-1);
    });

    it("detects tampered currentHash", () => {
      service.logOperation({ userId: "user-1", operation: "create", documentId: "doc-1" });
      service.logOperation({ userId: "user-1", operation: "update", documentId: "doc-1" });

      // Tamper with the first entry's hash
      const raw = localStorage.getItem("test_audit_log")!;
      const entries: AuditLogEntry[] = JSON.parse(raw);
      entries[0].currentHash = "tampered-hash";
      localStorage.setItem("test_audit_log", JSON.stringify(entries));

      const result = service.verifyChainIntegrity();
      expect(result.valid).toBe(false);
      expect(result.firstInvalidIndex).toBe(0);
      expect(result.error).toContain("invalid currentHash");
    });

    it("detects broken previousHash linkage", () => {
      service.logOperation({ userId: "user-1", operation: "create", documentId: "doc-1" });
      service.logOperation({ userId: "user-1", operation: "update", documentId: "doc-1" });

      // Break the chain by modifying second entry's previousHash
      const raw = localStorage.getItem("test_audit_log")!;
      const entries: AuditLogEntry[] = JSON.parse(raw);
      entries[1].previousHash = "wrong-hash";
      localStorage.setItem("test_audit_log", JSON.stringify(entries));

      const result = service.verifyChainIntegrity();
      expect(result.valid).toBe(false);
      expect(result.firstInvalidIndex).toBe(1);
      expect(result.error).toContain("invalid previousHash");
    });

    it("detects tampered entry content (userId changed)", () => {
      service.logOperation({ userId: "user-1", operation: "create", documentId: "doc-1" });

      // Tamper with the userId but keep the hash
      const raw = localStorage.getItem("test_audit_log")!;
      const entries: AuditLogEntry[] = JSON.parse(raw);
      entries[0].userId = "hacker";
      localStorage.setItem("test_audit_log", JSON.stringify(entries));

      const result = service.verifyChainIntegrity();
      expect(result.valid).toBe(false);
      expect(result.firstInvalidIndex).toBe(0);
    });
  });

  describe("getEntriesByDocument", () => {
    it("returns only entries for the specified document", () => {
      service.logOperation({ userId: "user-1", operation: "create", documentId: "doc-1" });
      service.logOperation({ userId: "user-1", operation: "create", documentId: "doc-2" });
      service.logOperation({ userId: "user-2", operation: "view", documentId: "doc-1" });

      const entries = service.getEntriesByDocument("doc-1");
      expect(entries).toHaveLength(2);
      expect(entries.every((e) => e.documentId === "doc-1")).toBe(true);
    });

    it("returns empty array for unknown document", () => {
      service.logOperation({ userId: "user-1", operation: "create", documentId: "doc-1" });
      expect(service.getEntriesByDocument("doc-999")).toEqual([]);
    });
  });

  describe("getEntriesByUser", () => {
    it("returns only entries for the specified user", () => {
      service.logOperation({ userId: "user-1", operation: "create", documentId: "doc-1" });
      service.logOperation({ userId: "user-2", operation: "view", documentId: "doc-1" });
      service.logOperation({ userId: "user-1", operation: "update", documentId: "doc-2" });

      const entries = service.getEntriesByUser("user-1");
      expect(entries).toHaveLength(2);
      expect(entries.every((e) => e.userId === "user-1")).toBe(true);
    });

    it("returns empty array for unknown user", () => {
      service.logOperation({ userId: "user-1", operation: "create", documentId: "doc-1" });
      expect(service.getEntriesByUser("unknown")).toEqual([]);
    });
  });

  describe("feature flag gating", () => {
    it("returns null from logOperation when flag is disabled", async () => {
      const { isFeatureEnabled } = await import("../featureFlags");
      vi.mocked(isFeatureEnabled).mockReturnValue(false);

      const entry = service.logOperation({
        userId: "user-1",
        operation: "view",
        documentId: "doc-1",
      });

      expect(entry).toBeNull();

      // Restore mock
      vi.mocked(isFeatureEnabled).mockReturnValue(true);
    });

    it("returns empty audit trail when flag is disabled", async () => {
      // First log with flag enabled
      service.logOperation({ userId: "user-1", operation: "view", documentId: "doc-1" });

      const { isFeatureEnabled } = await import("../featureFlags");
      vi.mocked(isFeatureEnabled).mockReturnValue(false);

      expect(service.getAuditTrail()).toEqual([]);

      // Restore mock
      vi.mocked(isFeatureEnabled).mockReturnValue(true);
    });

    it("returns valid verification when flag is disabled", async () => {
      const { isFeatureEnabled } = await import("../featureFlags");
      vi.mocked(isFeatureEnabled).mockReturnValue(false);

      const result = service.verifyChainIntegrity();
      expect(result.valid).toBe(true);
      expect(result.entriesChecked).toBe(0);

      // Restore mock
      vi.mocked(isFeatureEnabled).mockReturnValue(true);
    });
  });

  describe("localStorage persistence", () => {
    it("persists entries across service instances with same key", () => {
      service.logOperation({ userId: "user-1", operation: "create", documentId: "doc-1" });

      const service2 = new AuditLogService({ storageKey: "test_audit_log" });
      const trail = service2.getAuditTrail();
      expect(trail).toHaveLength(1);
      expect(trail[0].documentId).toBe("doc-1");
    });

    it("uses separate storage for different keys", () => {
      service.logOperation({ userId: "user-1", operation: "create", documentId: "doc-1" });

      const other = new AuditLogService({ storageKey: "other_audit_log" });
      expect(other.getAuditTrail()).toEqual([]);
    });

    it("handles corrupted localStorage gracefully", () => {
      localStorage.setItem("test_audit_log", "not-valid-json");
      expect(service.getAuditTrail()).toEqual([]);
    });
  });
});
