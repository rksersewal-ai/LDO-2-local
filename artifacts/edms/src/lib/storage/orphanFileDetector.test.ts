import { describe, it, expect, beforeEach } from "vitest";
import { OrphanDetector } from "./orphanFileDetector";

describe("OrphanFileDetector", () => {
  const KNOWN_HASH_1 = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
  const KNOWN_HASH_2 = "1111111111111111111111111111111111111111111111111111111111111111";
  const UNKNOWN_HASH = "9999999999999999999999999999999999999999999999999999999999999999";

  const knownPath1 = `/ab/cd/${KNOWN_HASH_1}`;
  const knownPath2 = `/11/11/${KNOWN_HASH_2}`;
  const unknownPath = `/99/99/${UNKNOWN_HASH}`;

  let detector: OrphanDetector;

  beforeEach(() => {
    const knownIds = new Set([KNOWN_HASH_1, KNOWN_HASH_2]);
    detector = new OrphanDetector(knownIds);
  });

  describe("isOrphan", () => {
    it("returns false for a known file path", () => {
      expect(detector.isOrphan(knownPath1)).toBe(false);
      expect(detector.isOrphan(knownPath2)).toBe(false);
    });

    it("returns true for an unknown file path", () => {
      expect(detector.isOrphan(unknownPath)).toBe(true);
    });

    it("returns true for an invalid path format", () => {
      expect(detector.isOrphan("/some/random/path.txt")).toBe(true);
      expect(detector.isOrphan("")).toBe(true);
      expect(detector.isOrphan("/ab/invalid")).toBe(true);
    });

    it("correctly handles paths with matching prefix but different hash", () => {
      const differentHash =
        "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456780";
      const path = `/ab/cd/${differentHash}`;
      expect(detector.isOrphan(path)).toBe(true);
    });
  });

  describe("scanPaths", () => {
    it("returns empty orphans for all known paths", () => {
      const result = detector.scanPaths([knownPath1, knownPath2]);
      expect(result.orphanPaths).toEqual([]);
      expect(result.orphanCount).toBe(0);
      expect(result.totalScanned).toBe(2);
    });

    it("identifies orphan paths among mixed input", () => {
      const result = detector.scanPaths([knownPath1, unknownPath, knownPath2]);
      expect(result.orphanPaths).toEqual([unknownPath]);
      expect(result.orphanCount).toBe(1);
      expect(result.totalScanned).toBe(3);
    });

    it("identifies all orphans when none are known", () => {
      const emptyDetector = new OrphanDetector(new Set());
      const result = emptyDetector.scanPaths([knownPath1, knownPath2, unknownPath]);
      expect(result.orphanCount).toBe(3);
      expect(result.orphanPaths).toHaveLength(3);
    });

    it("handles empty path array", () => {
      const result = detector.scanPaths([]);
      expect(result.orphanPaths).toEqual([]);
      expect(result.orphanCount).toBe(0);
      expect(result.totalScanned).toBe(0);
    });

    it("includes detectedAt as a valid ISO date", () => {
      const result = detector.scanPaths([knownPath1]);
      const date = new Date(result.detectedAt);
      expect(date.toISOString()).toBe(result.detectedAt);
    });

    it("handles large datasets efficiently", () => {
      const largePaths: string[] = [];
      for (let i = 0; i < 10000; i++) {
        const hash = i.toString(16).padStart(64, "0");
        largePaths.push(`/${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}`);
      }
      // Only KNOWN_HASH_1 and KNOWN_HASH_2 are known
      const result = detector.scanPaths(largePaths);
      expect(result.totalScanned).toBe(10000);
      // Most will be orphans since only 2 hashes are known
      expect(result.orphanCount).toBeGreaterThan(9990);
    });

    it("treats invalid format paths as orphans in scan", () => {
      const result = detector.scanPaths([
        "/invalid/path",
        knownPath1,
        "not-a-path",
      ]);
      expect(result.orphanPaths).toEqual(["/invalid/path", "not-a-path"]);
      expect(result.orphanCount).toBe(2);
    });
  });

  describe("extractFileId", () => {
    it("extracts hash from valid content-addressed path", () => {
      expect(detector.extractFileId(knownPath1)).toBe(KNOWN_HASH_1);
    });

    it("returns null for invalid path format", () => {
      expect(detector.extractFileId("/invalid")).toBeNull();
      expect(detector.extractFileId("")).toBeNull();
      expect(detector.extractFileId("/ab/cd/too-short")).toBeNull();
    });

    it("extracts hash regardless of whether it is known", () => {
      expect(detector.extractFileId(unknownPath)).toBe(UNKNOWN_HASH);
    });
  });
});
