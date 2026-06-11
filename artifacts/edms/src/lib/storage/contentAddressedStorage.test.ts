import { describe, it, expect } from "vitest";
import {
  generateStoragePath,
  parseStoragePath,
  validateHash,
  hashContent,
} from "./contentAddressedStorage";

describe("contentAddressedStorage", () => {
  // A valid 64-character hex hash for testing
  const VALID_HASH = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

  describe("hashContent", () => {
    it("produces consistent hash for same input", () => {
      const hash1 = hashContent("hello world");
      const hash2 = hashContent("hello world");
      expect(hash1).toBe(hash2);
    });

    it("produces different hashes for different inputs", () => {
      const hash1 = hashContent("file-content-a");
      const hash2 = hashContent("file-content-b");
      expect(hash1).not.toBe(hash2);
    });

    it("returns a 64-character hexadecimal string", () => {
      const hash = hashContent("test content");
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("handles empty string input", () => {
      const hash = hashContent("");
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("handles very long strings", () => {
      const longContent = "x".repeat(100000);
      const hash = hashContent(longContent);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("handles special characters", () => {
      const hash = hashContent("line1\nline2\ttab\r\n\0null");
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("generateStoragePath", () => {
    it("generates path in /aa/bb/hash format", () => {
      const path = generateStoragePath(VALID_HASH);
      expect(path).toBe(`/ab/cd/${VALID_HASH}`);
    });

    it("uses first 2 chars as prefix1 and next 2 as prefix2", () => {
      const hash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const path = generateStoragePath(hash);
      expect(path).toBe(`/01/23/${hash}`);
    });

    it("normalizes uppercase hex to lowercase", () => {
      const upperHash = "ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789";
      const path = generateStoragePath(upperHash);
      expect(path).toBe(`/ab/cd/${upperHash.toLowerCase()}`);
    });

    it("throws on invalid hash (too short)", () => {
      expect(() => generateStoragePath("abc")).toThrow("Invalid hash");
    });

    it("throws on invalid hash (non-hex characters)", () => {
      const invalidHash = "zzzzzz0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
      expect(() => generateStoragePath(invalidHash)).toThrow("Invalid hash");
    });

    it("throws on empty string", () => {
      expect(() => generateStoragePath("")).toThrow("Invalid hash");
    });

    it("works with hashContent output", () => {
      const hash = hashContent("my file content");
      const path = generateStoragePath(hash);
      expect(path).toMatch(/^\/[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{64}$/);
    });
  });

  describe("parseStoragePath", () => {
    it("parses a valid storage path", () => {
      const result = parseStoragePath(`/ab/cd/${VALID_HASH}`);
      expect(result).toEqual({
        prefix1: "ab",
        prefix2: "cd",
        hash: VALID_HASH,
      });
    });

    it("roundtrips with generateStoragePath", () => {
      const path = generateStoragePath(VALID_HASH);
      const parsed = parseStoragePath(path);
      expect(parsed).not.toBeNull();
      expect(parsed!.hash).toBe(VALID_HASH);
      expect(parsed!.prefix1).toBe(VALID_HASH.slice(0, 2));
      expect(parsed!.prefix2).toBe(VALID_HASH.slice(2, 4));
    });

    it("returns null for invalid path format", () => {
      expect(parseStoragePath("/ab/invalid")).toBeNull();
      expect(parseStoragePath("ab/cd/hash")).toBeNull();
      expect(parseStoragePath("")).toBeNull();
      expect(parseStoragePath("/xx/yy/short")).toBeNull();
    });

    it("returns null for path with uppercase hex", () => {
      const upperPath = `/AB/CD/${VALID_HASH.toUpperCase()}`;
      expect(parseStoragePath(upperPath)).toBeNull();
    });

    it("returns null for path with non-hex prefix", () => {
      expect(parseStoragePath(`/zz/qq/${VALID_HASH}`)).toBeNull();
    });

    it("returns null for path with extra segments", () => {
      expect(parseStoragePath(`/ab/cd/ef/${VALID_HASH}`)).toBeNull();
    });
  });

  describe("validateHash", () => {
    it("returns true for a valid 64-char hex hash", () => {
      expect(validateHash(VALID_HASH)).toBe(true);
    });

    it("returns true for all zeros", () => {
      const zeros = "0".repeat(64);
      expect(validateHash(zeros)).toBe(true);
    });

    it("returns true for all f's", () => {
      const fs = "f".repeat(64);
      expect(validateHash(fs)).toBe(true);
    });

    it("returns false for too short", () => {
      expect(validateHash("abcdef")).toBe(false);
    });

    it("returns false for too long", () => {
      expect(validateHash("a".repeat(65))).toBe(false);
    });

    it("returns false for non-hex characters", () => {
      const invalid = "g" + "a".repeat(63);
      expect(validateHash(invalid)).toBe(false);
    });

    it("returns false for uppercase hex", () => {
      const upper = "A".repeat(64);
      expect(validateHash(upper)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(validateHash("")).toBe(false);
    });

    it("validates hashes produced by hashContent", () => {
      const hash = hashContent("some content");
      expect(validateHash(hash)).toBe(true);
    });
  });
});
