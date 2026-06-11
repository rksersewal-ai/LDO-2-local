import { describe, it, expect, beforeEach } from "vitest";
import { DeadLetterQueue } from "./deadLetterQueue";
import type { DeadLetterEntry } from "./deadLetterQueue";

describe("deadLetterQueue", () => {
  let dlq: DeadLetterQueue;

  beforeEach(() => {
    localStorage.clear();
    dlq = new DeadLetterQueue({ storageKey: "test_dlq" });
  });

  function createEntry(overrides: Partial<DeadLetterEntry> = {}): DeadLetterEntry {
    return {
      id: `dlq-${Math.random().toString(36).slice(2, 8)}`,
      documentId: "DOC-001",
      filename: "test-file.pdf",
      failedAt: new Date().toISOString(),
      errorReason: "Test error",
      retryCount: 0,
      ...overrides,
    };
  }

  describe("enqueue", () => {
    it("adds an entry to the queue", () => {
      const entry = createEntry({ id: "dlq-001" });
      dlq.enqueue(entry);

      const entries = dlq.getAll();
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe("dlq-001");
    });

    it("preserves all entry fields aligned with FailedJob interface", () => {
      const entry: DeadLetterEntry = {
        id: "dlq-002",
        documentId: "DOC-042",
        filename: "thermal-analysis.pdf",
        failedAt: "2024-01-15T10:00:00.000Z",
        errorReason: "OCR timeout",
        retryCount: 2,
      };
      dlq.enqueue(entry);

      const entries = dlq.getAll();
      expect(entries[0]).toEqual(entry);
    });

    it("enforces maximum entry limit", () => {
      const smallDlq = new DeadLetterQueue({
        storageKey: "test_dlq_small",
        maxEntries: 3,
      });

      for (let i = 0; i < 5; i++) {
        smallDlq.enqueue(createEntry({ id: `dlq-${i}` }));
      }

      const entries = smallDlq.getAll();
      expect(entries).toHaveLength(3);
      // Oldest entries should be removed
      expect(entries[0].id).toBe("dlq-2");
      expect(entries[2].id).toBe("dlq-4");
    });

    it("supports optional metadata field", () => {
      const entry = createEntry({
        metadata: { pageNumber: 5, ocrEngine: "tesseract" },
      });
      dlq.enqueue(entry);

      const entries = dlq.getAll();
      expect(entries[0].metadata).toEqual({
        pageNumber: 5,
        ocrEngine: "tesseract",
      });
    });
  });

  describe("peek", () => {
    it("returns the most recent entries without removing them", () => {
      dlq.enqueue(createEntry({ id: "dlq-a" }));
      dlq.enqueue(createEntry({ id: "dlq-b" }));
      dlq.enqueue(createEntry({ id: "dlq-c" }));

      const peeked = dlq.peek(2);
      expect(peeked).toHaveLength(2);
      // Newest first
      expect(peeked[0].id).toBe("dlq-c");
      expect(peeked[1].id).toBe("dlq-b");

      // Queue should still have all entries
      expect(dlq.getAll()).toHaveLength(3);
    });

    it("returns all entries when count exceeds queue size", () => {
      dlq.enqueue(createEntry({ id: "dlq-1" }));
      const peeked = dlq.peek(10);
      expect(peeked).toHaveLength(1);
    });

    it("returns empty array for empty queue", () => {
      expect(dlq.peek()).toEqual([]);
    });
  });

  describe("dequeue", () => {
    it("removes and returns an entry by ID", () => {
      dlq.enqueue(createEntry({ id: "dlq-remove" }));
      dlq.enqueue(createEntry({ id: "dlq-keep" }));

      const removed = dlq.dequeue("dlq-remove");
      expect(removed?.id).toBe("dlq-remove");
      expect(dlq.getAll()).toHaveLength(1);
      expect(dlq.getAll()[0].id).toBe("dlq-keep");
    });

    it("returns undefined for non-existent ID", () => {
      dlq.enqueue(createEntry({ id: "dlq-exists" }));
      expect(dlq.dequeue("dlq-nope")).toBeUndefined();
    });
  });

  describe("getStats", () => {
    it("returns zero stats for empty queue", () => {
      const stats = dlq.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.last24Hours).toBe(0);
      expect(stats.lastHour).toBe(0);
      expect(stats.topErrorReason).toBeNull();
      expect(stats.oldestEntry).toBeNull();
      expect(stats.newestEntry).toBeNull();
    });

    it("counts entries within time windows", () => {
      const now = Date.now();
      dlq.enqueue(
        createEntry({
          id: "old",
          failedAt: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
        }),
      );
      dlq.enqueue(
        createEntry({
          id: "recent",
          failedAt: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
        }),
      );
      dlq.enqueue(
        createEntry({
          id: "very-recent",
          failedAt: new Date(now - 30 * 60 * 1000).toISOString(),
        }),
      );

      const stats = dlq.getStats();
      expect(stats.totalEntries).toBe(3);
      expect(stats.last24Hours).toBe(2);
      expect(stats.lastHour).toBe(1);
    });

    it("identifies the most common error reason", () => {
      dlq.enqueue(createEntry({ errorReason: "Timeout" }));
      dlq.enqueue(createEntry({ errorReason: "Timeout" }));
      dlq.enqueue(createEntry({ errorReason: "Memory exceeded" }));

      const stats = dlq.getStats();
      expect(stats.topErrorReason).toBe("Timeout");
    });

    it("reports oldest and newest timestamps", () => {
      const oldest = "2024-01-01T00:00:00.000Z";
      const newest = "2024-06-15T12:00:00.000Z";

      dlq.enqueue(createEntry({ failedAt: oldest }));
      dlq.enqueue(createEntry({ failedAt: newest }));

      const stats = dlq.getStats();
      expect(stats.oldestEntry).toBe(oldest);
      expect(stats.newestEntry).toBe(newest);
    });
  });

  describe("purgeOlderThan", () => {
    it("removes entries older than the specified date", () => {
      const old = "2024-01-01T00:00:00.000Z";
      const recent = "2024-06-15T00:00:00.000Z";

      dlq.enqueue(createEntry({ id: "old-entry", failedAt: old }));
      dlq.enqueue(createEntry({ id: "recent-entry", failedAt: recent }));

      const purged = dlq.purgeOlderThan(new Date("2024-03-01T00:00:00.000Z"));
      expect(purged).toBe(1);
      expect(dlq.getAll()).toHaveLength(1);
      expect(dlq.getAll()[0].id).toBe("recent-entry");
    });

    it("returns 0 when nothing to purge", () => {
      dlq.enqueue(createEntry({ failedAt: new Date().toISOString() }));
      const purged = dlq.purgeOlderThan(new Date("2020-01-01"));
      expect(purged).toBe(0);
    });
  });

  describe("retryEntry", () => {
    it("removes and returns the entry for reprocessing", () => {
      dlq.enqueue(createEntry({ id: "retry-me" }));
      dlq.enqueue(createEntry({ id: "stay" }));

      const entry = dlq.retryEntry("retry-me");
      expect(entry?.id).toBe("retry-me");
      expect(dlq.getAll()).toHaveLength(1);
    });

    it("returns undefined for non-existent entry", () => {
      expect(dlq.retryEntry("no-such-id")).toBeUndefined();
    });
  });

  describe("clear", () => {
    it("removes all entries from the queue", () => {
      dlq.enqueue(createEntry());
      dlq.enqueue(createEntry());
      dlq.clear();
      expect(dlq.getAll()).toHaveLength(0);
    });
  });

  describe("localStorage persistence", () => {
    it("persists entries across instances with same key", () => {
      dlq.enqueue(createEntry({ id: "persisted" }));

      const dlq2 = new DeadLetterQueue({ storageKey: "test_dlq" });
      const entries = dlq2.getAll();
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe("persisted");
    });

    it("uses separate storage for different keys", () => {
      dlq.enqueue(createEntry({ id: "queue-a" }));

      const otherDlq = new DeadLetterQueue({ storageKey: "other_dlq" });
      expect(otherDlq.getAll()).toHaveLength(0);
    });
  });
});
