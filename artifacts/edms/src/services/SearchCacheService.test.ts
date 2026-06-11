import { describe, it, expect, beforeEach, vi } from "vitest";
import { SearchCacheService, generateCacheKey } from "./SearchCacheService";
import type { SearchFilterOptions } from "./SearchService";

// ─────────────────────────────────────────────────────────────────────────
// generateCacheKey
// ─────────────────────────────────────────────────────────────────────────

describe("generateCacheKey", () => {
  it("generates a deterministic key for the same query and filters", () => {
    const key1 = generateCacheKey("valve", { source: "scanner_a" });
    const key2 = generateCacheKey("valve", { source: "scanner_a" });
    expect(key1).toBe(key2);
  });

  it("generates different keys for different queries", () => {
    const key1 = generateCacheKey("valve");
    const key2 = generateCacheKey("pressure");
    expect(key1).not.toBe(key2);
  });

  it("generates different keys for different filters", () => {
    const key1 = generateCacheKey("valve", { source: "scanner_a" });
    const key2 = generateCacheKey("valve", { source: "scanner_b" });
    expect(key1).not.toBe(key2);
  });

  it("normalizes query case", () => {
    const key1 = generateCacheKey("VALVE");
    const key2 = generateCacheKey("valve");
    expect(key1).toBe(key2);
  });

  it("trims whitespace from query", () => {
    const key1 = generateCacheKey("  valve  ");
    const key2 = generateCacheKey("valve");
    expect(key1).toBe(key2);
  });

  it("produces keys starting with q_ prefix", () => {
    const key = generateCacheKey("test");
    expect(key.startsWith("q_")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// SearchCacheService - Basic Operations
// ─────────────────────────────────────────────────────────────────────────

describe("SearchCacheService", () => {
  let cache: SearchCacheService;

  beforeEach(() => {
    localStorage.clear();
    cache = new SearchCacheService();
  });

  describe("set and get", () => {
    it("stores and retrieves a cached value", () => {
      const data = { results: [{ id: "1", title: "Test" }] };
      cache.set("valve", {}, data);
      const result = cache.get("valve", {});
      expect(result).toEqual(data);
    });

    it("returns null for non-existent entry", () => {
      const result = cache.get("nonexistent", {});
      expect(result).toBeNull();
    });

    it("stores entries with different filters separately", () => {
      cache.set("valve", { source: "a" }, { data: "a" });
      cache.set("valve", { source: "b" }, { data: "b" });

      expect(cache.get("valve", { source: "a" })).toEqual({ data: "a" });
      expect(cache.get("valve", { source: "b" })).toEqual({ data: "b" });
    });

    it("overwrites existing entry with same key", () => {
      cache.set("valve", {}, { data: "old" });
      cache.set("valve", {}, { data: "new" });
      expect(cache.get("valve", {})).toEqual({ data: "new" });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TTL Expiry
  // ─────────────────────────────────────────────────────────────────────────

  describe("TTL expiry", () => {
    it("returns cached value before TTL expires", () => {
      vi.useFakeTimers();
      cache.set("valve", {}, { data: "test" }, 60000); // 60 seconds TTL
      vi.advanceTimersByTime(30000); // 30 seconds later
      expect(cache.get("valve", {})).toEqual({ data: "test" });
      vi.useRealTimers();
    });

    it("returns null after TTL expires", () => {
      vi.useFakeTimers();
      cache.set("valve", {}, { data: "test" }, 60000); // 60 seconds TTL
      vi.advanceTimersByTime(61000); // 61 seconds later
      expect(cache.get("valve", {})).toBeNull();
      vi.useRealTimers();
    });

    it("uses default TTL when not specified", () => {
      vi.useFakeTimers();
      cache.set("valve", {}, { data: "test" }); // Default 5 min TTL
      vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes later
      expect(cache.get("valve", {})).toEqual({ data: "test" });
      vi.advanceTimersByTime(2 * 60 * 1000); // 6 minutes total
      expect(cache.get("valve", {})).toBeNull();
      vi.useRealTimers();
    });

    it("custom TTL overrides default", () => {
      vi.useFakeTimers();
      cache.set("valve", {}, { data: "test" }, 1000); // 1 second TTL
      vi.advanceTimersByTime(1500);
      expect(cache.get("valve", {})).toBeNull();
      vi.useRealTimers();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // LRU Eviction
  // ─────────────────────────────────────────────────────────────────────────

  describe("LRU eviction", () => {
    it("evicts least recently used entry when max entries exceeded", () => {
      const smallCache = new SearchCacheService({ maxEntries: 3 });

      smallCache.set("query1", {}, { data: "1" });
      smallCache.set("query2", {}, { data: "2" });
      smallCache.set("query3", {}, { data: "3" });

      // Adding a 4th entry should evict query1 (LRU)
      smallCache.set("query4", {}, { data: "4" });

      expect(smallCache.get("query1", {})).toBeNull();
      expect(smallCache.get("query2", {})).toEqual({ data: "2" });
      expect(smallCache.get("query3", {})).toEqual({ data: "3" });
      expect(smallCache.get("query4", {})).toEqual({ data: "4" });
    });

    it("accessing an entry moves it to most-recently-used position", () => {
      const smallCache = new SearchCacheService({ maxEntries: 3 });

      smallCache.set("query1", {}, { data: "1" });
      smallCache.set("query2", {}, { data: "2" });
      smallCache.set("query3", {}, { data: "3" });

      // Access query1 to make it MRU
      smallCache.get("query1", {});

      // Adding new entry should evict query2 (now LRU)
      smallCache.set("query4", {}, { data: "4" });

      expect(smallCache.get("query1", {})).toEqual({ data: "1" });
      expect(smallCache.get("query2", {})).toBeNull();
    });

    it("respects maxEntries limit of 50 by default", () => {
      for (let i = 0; i < 55; i++) {
        cache.set(`query${i}`, {}, { data: i });
      }
      expect(cache.getSize()).toBeLessThanOrEqual(50);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Statistics
  // ─────────────────────────────────────────────────────────────────────────

  describe("statistics", () => {
    it("tracks hits", () => {
      cache.set("valve", {}, { data: "test" });
      cache.get("valve", {});
      cache.get("valve", {});
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
    });

    it("tracks misses", () => {
      cache.get("nonexistent", {});
      cache.get("also-missing", {});
      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });

    it("calculates hit rate correctly", () => {
      cache.set("valve", {}, { data: "test" });
      cache.get("valve", {}); // hit
      cache.get("valve", {}); // hit
      cache.get("missing", {}); // miss
      const stats = cache.getStats();
      // 2 hits / 3 total = 67%
      expect(stats.hitRate).toBe(67);
    });

    it("returns 0 hitRate when no requests made", () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });

    it("tracks current size", () => {
      cache.set("query1", {}, { data: "1" });
      cache.set("query2", {}, { data: "2" });
      const stats = cache.getStats();
      expect(stats.size).toBe(2);
    });

    it("tracks evictions", () => {
      const smallCache = new SearchCacheService({ maxEntries: 2 });
      smallCache.set("query1", {}, { data: "1" });
      smallCache.set("query2", {}, { data: "2" });
      smallCache.set("query3", {}, { data: "3" }); // triggers eviction

      const stats = smallCache.getStats();
      expect(stats.evictions).toBeGreaterThanOrEqual(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Cache Invalidation
  // ─────────────────────────────────────────────────────────────────────────

  describe("invalidation", () => {
    it("invalidates a specific entry", () => {
      cache.set("valve", {}, { data: "test" });
      cache.invalidate("valve", {});
      expect(cache.get("valve", {})).toBeNull();
    });

    it("clear removes all entries", () => {
      cache.set("query1", {}, { data: "1" });
      cache.set("query2", {}, { data: "2" });
      cache.set("query3", {}, { data: "3" });
      cache.clear();
      expect(cache.getSize()).toBe(0);
      expect(cache.get("query1", {})).toBeNull();
      expect(cache.get("query2", {})).toBeNull();
    });

    it("clear resets statistics", () => {
      cache.set("valve", {}, { data: "test" });
      cache.get("valve", {});
      cache.clear();
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // has()
  // ─────────────────────────────────────────────────────────────────────────

  describe("has", () => {
    it("returns true for existing valid entry", () => {
      cache.set("valve", {}, { data: "test" });
      expect(cache.has("valve", {})).toBe(true);
    });

    it("returns false for non-existent entry", () => {
      expect(cache.has("nonexistent", {})).toBe(false);
    });

    it("returns false for expired entry", () => {
      vi.useFakeTimers();
      cache.set("valve", {}, { data: "test" }, 1000);
      vi.advanceTimersByTime(2000);
      expect(cache.has("valve", {})).toBe(false);
      vi.useRealTimers();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────────────

  describe("configuration", () => {
    it("uses custom storage key prefix", () => {
      const customCache = new SearchCacheService({ storageKeyPrefix: "custom_" });
      customCache.set("test", {}, { data: "value" });

      // Verify the custom prefix is used by checking the entry can be retrieved
      // and that a default-prefixed cache does not see it
      const defaultCache = new SearchCacheService({ storageKeyPrefix: "other_" });
      expect(customCache.get("test", {})).toEqual({ data: "value" });
      expect(defaultCache.get("test", {})).toBeNull();
    });

    it("uses custom max entries", () => {
      const smallCache = new SearchCacheService({ maxEntries: 5 });
      for (let i = 0; i < 10; i++) {
        smallCache.set(`query${i}`, {}, { data: i });
      }
      expect(smallCache.getSize()).toBeLessThanOrEqual(5);
    });
  });
});
