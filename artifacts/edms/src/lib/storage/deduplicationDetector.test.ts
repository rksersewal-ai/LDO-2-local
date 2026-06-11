import { describe, it, expect, beforeEach } from "vitest";
import { DeduplicationIndex } from "./deduplicationDetector";
import type { DuplicateMatch } from "./deduplicationDetector";

describe("DeduplicationDetector", () => {
  let index: DeduplicationIndex;

  beforeEach(() => {
    index = new DeduplicationIndex();
  });

  describe("addFile", () => {
    it("returns null for a unique file", () => {
      const result = index.addFile("file-1", "hash-aaa");
      expect(result).toBeNull();
    });

    it("returns DuplicateMatch for a duplicate file", () => {
      index.addFile("file-1", "hash-aaa");
      const result = index.addFile("file-2", "hash-aaa");

      expect(result).not.toBeNull();
      expect(result!.originalId).toBe("file-1");
      expect(result!.duplicateId).toBe("file-2");
      expect(result!.hash).toBe("hash-aaa");
      expect(result!.detectedAt).toBeTruthy();
    });

    it("returns DuplicateMatch referencing first file for third duplicate", () => {
      index.addFile("file-1", "hash-aaa");
      index.addFile("file-2", "hash-aaa");
      const result = index.addFile("file-3", "hash-aaa");

      expect(result).not.toBeNull();
      expect(result!.originalId).toBe("file-1");
      expect(result!.duplicateId).toBe("file-3");
    });

    it("detectedAt is a valid ISO date string", () => {
      index.addFile("file-1", "hash-aaa");
      const result = index.addFile("file-2", "hash-aaa") as DuplicateMatch;

      const date = new Date(result.detectedAt);
      expect(date.toISOString()).toBe(result.detectedAt);
    });
  });

  describe("findDuplicate", () => {
    it("returns null for unknown hash", () => {
      expect(index.findDuplicate("unknown-hash")).toBeNull();
    });

    it("returns first file ID for known hash", () => {
      index.addFile("file-1", "hash-aaa");
      expect(index.findDuplicate("hash-aaa")).toBe("file-1");
    });

    it("still returns first file ID after multiple duplicates added", () => {
      index.addFile("file-1", "hash-aaa");
      index.addFile("file-2", "hash-aaa");
      index.addFile("file-3", "hash-aaa");
      expect(index.findDuplicate("hash-aaa")).toBe("file-1");
    });

    it("returns correct ID for different hashes", () => {
      index.addFile("file-1", "hash-aaa");
      index.addFile("file-2", "hash-bbb");
      expect(index.findDuplicate("hash-aaa")).toBe("file-1");
      expect(index.findDuplicate("hash-bbb")).toBe("file-2");
    });
  });

  describe("getDuplicateGroups", () => {
    it("returns empty map when no duplicates exist", () => {
      index.addFile("file-1", "hash-aaa");
      index.addFile("file-2", "hash-bbb");
      const groups = index.getDuplicateGroups();
      expect(groups.size).toBe(0);
    });

    it("returns group for duplicate files", () => {
      index.addFile("file-1", "hash-aaa");
      index.addFile("file-2", "hash-aaa");
      const groups = index.getDuplicateGroups();
      expect(groups.size).toBe(1);
      expect(groups.get("hash-aaa")).toEqual(["file-1", "file-2"]);
    });

    it("returns multiple groups for multiple sets of duplicates", () => {
      index.addFile("file-1", "hash-aaa");
      index.addFile("file-2", "hash-aaa");
      index.addFile("file-3", "hash-bbb");
      index.addFile("file-4", "hash-bbb");
      index.addFile("file-5", "hash-ccc");

      const groups = index.getDuplicateGroups();
      expect(groups.size).toBe(2);
      expect(groups.get("hash-aaa")).toEqual(["file-1", "file-2"]);
      expect(groups.get("hash-bbb")).toEqual(["file-3", "file-4"]);
    });

    it("returns a copy of the IDs array (not a reference)", () => {
      index.addFile("file-1", "hash-aaa");
      index.addFile("file-2", "hash-aaa");
      const groups = index.getDuplicateGroups();
      const ids = groups.get("hash-aaa")!;
      ids.push("file-999");
      // Original should be unchanged
      const groups2 = index.getDuplicateGroups();
      expect(groups2.get("hash-aaa")).toEqual(["file-1", "file-2"]);
    });
  });

  describe("getStats", () => {
    it("returns zeros for empty index", () => {
      const stats = index.getStats();
      expect(stats.totalFiles).toBe(0);
      expect(stats.uniqueFiles).toBe(0);
      expect(stats.duplicateCount).toBe(0);
      expect(stats.potentialSpaceSaved).toBe(0);
    });

    it("counts unique files correctly", () => {
      index.addFile("file-1", "hash-aaa");
      index.addFile("file-2", "hash-bbb");
      index.addFile("file-3", "hash-ccc");
      const stats = index.getStats();
      expect(stats.totalFiles).toBe(3);
      expect(stats.uniqueFiles).toBe(3);
      expect(stats.duplicateCount).toBe(0);
    });

    it("counts duplicates correctly", () => {
      index.addFile("file-1", "hash-aaa");
      index.addFile("file-2", "hash-aaa");
      index.addFile("file-3", "hash-bbb");
      const stats = index.getStats();
      expect(stats.totalFiles).toBe(3);
      expect(stats.uniqueFiles).toBe(2);
      expect(stats.duplicateCount).toBe(1);
    });

    it("calculates potential space saved with size map", () => {
      index.addFile("file-1", "hash-aaa");
      index.addFile("file-2", "hash-aaa");
      index.addFile("file-3", "hash-aaa");

      const sizeMap = new Map<string, number>([
        ["file-1", 1000],
        ["file-2", 1000],
        ["file-3", 1000],
      ]);

      const stats = index.getStats(sizeMap);
      // file-2 and file-3 are duplicates of file-1, so 2000 bytes saved
      expect(stats.potentialSpaceSaved).toBe(2000);
    });

    it("returns 0 space saved when no size map provided", () => {
      index.addFile("file-1", "hash-aaa");
      index.addFile("file-2", "hash-aaa");
      const stats = index.getStats();
      expect(stats.potentialSpaceSaved).toBe(0);
    });
  });

  describe("removeFile", () => {
    it("removes a file from the index", () => {
      index.addFile("file-1", "hash-aaa");
      index.removeFile("file-1");
      expect(index.findDuplicate("hash-aaa")).toBeNull();
    });

    it("does not affect other files with different hashes", () => {
      index.addFile("file-1", "hash-aaa");
      index.addFile("file-2", "hash-bbb");
      index.removeFile("file-1");
      expect(index.findDuplicate("hash-bbb")).toBe("file-2");
    });

    it("does nothing for unknown file ID", () => {
      index.addFile("file-1", "hash-aaa");
      index.removeFile("unknown");
      expect(index.findDuplicate("hash-aaa")).toBe("file-1");
    });
  });

  describe("clear", () => {
    it("removes all entries", () => {
      index.addFile("file-1", "hash-aaa");
      index.addFile("file-2", "hash-bbb");
      index.clear();
      expect(index.findDuplicate("hash-aaa")).toBeNull();
      expect(index.findDuplicate("hash-bbb")).toBeNull();
      const stats = index.getStats();
      expect(stats.totalFiles).toBe(0);
    });
  });
});
