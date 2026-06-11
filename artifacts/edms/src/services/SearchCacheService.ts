/**
 * Search Cache Service
 *
 * Frontend localStorage-backed caching for search results.
 * Provides TTL-based expiry and LRU eviction to keep the cache bounded.
 *
 * Features:
 *   - TTL-based automatic expiry (default: 5 minutes)
 *   - LRU eviction when max entries (50) exceeded
 *   - Cache key generation from query + filters hash
 *   - Hit/miss statistics tracking
 *   - Manual invalidation by pattern or full flush
 *
 * Backend Strategy (documented for future implementation):
 *   In production, this cache layer would be replaced by Redis with:
 *   - Redis SETEX for TTL-based caching
 *   - Redis LRU eviction policy (maxmemory-policy allkeys-lru)
 *   - Cache key format: "search:{hash(query+filters)}"
 *   - Cache invalidation via pub/sub on document updates
 *   - Cluster mode for horizontal scaling at 600K+ documents
 */

import type { SearchFilterOptions } from "./SearchService";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

/** A single cached search result entry */
export interface CacheEntry<T = unknown> {
  /** The cached data */
  data: T;
  /** Timestamp when the entry was created (ms since epoch) */
  createdAt: number;
  /** Timestamp when the entry was last accessed (ms since epoch) */
  lastAccessedAt: number;
  /** TTL in milliseconds */
  ttlMs: number;
  /** Cache key for this entry */
  key: string;
}

/** Cache statistics */
export interface CacheStats {
  /** Total cache hits since last reset */
  hits: number;
  /** Total cache misses since last reset */
  misses: number;
  /** Current number of entries in cache */
  size: number;
  /** Total number of evictions performed */
  evictions: number;
  /** Hit rate as a percentage (0-100) */
  hitRate: number;
}

/** Cache configuration options */
export interface CacheConfig {
  /** Maximum number of entries before LRU eviction (default: 50) */
  maxEntries: number;
  /** Default TTL in milliseconds (default: 5 minutes) */
  defaultTtlMs: number;
  /** localStorage key prefix */
  storageKeyPrefix: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: CacheConfig = {
  maxEntries: 50,
  defaultTtlMs: 5 * 60 * 1000, // 5 minutes
  storageKeyPrefix: "search_cache_",
};

const STATS_STORAGE_KEY = "search_cache_stats";
const INDEX_STORAGE_KEY = "search_cache_index";

// ─────────────────────────────────────────────────────────────────────────
// Cache Key Generation
// ─────────────────────────────────────────────────────────────────────────

/**
 * Generates a deterministic cache key from a search query and filters.
 * Uses a simple string hash for fast key generation.
 *
 * @param query - Search query string
 * @param filters - Applied search filters
 * @returns A deterministic cache key string
 */
export function generateCacheKey(query: string, filters: SearchFilterOptions = {}): string {
  const normalized = query.trim().toLowerCase();
  const filterString = JSON.stringify(filters, Object.keys(filters).sort());
  const combined = `${normalized}|${filterString}`;

  return `q_${simpleHash(combined)}`;
}

/**
 * Simple string hash function (djb2 variant).
 * Not cryptographic - used only for cache key generation.
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash).toString(36);
}

// ─────────────────────────────────────────────────────────────────────────
// Search Cache Service
// ─────────────────────────────────────────────────────────────────────────

/**
 * localStorage-backed search result cache with TTL expiry and LRU eviction.
 *
 * Usage:
 *   const cache = new SearchCacheService();
 *   cache.set("valve", {}, searchResults);
 *   const cached = cache.get<CrossEntityResults>("valve", {});
 */
export class SearchCacheService {
  private config: CacheConfig;
  private stats: CacheStats;
  private index: string[]; // Ordered list of keys (most recent last)

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = this.loadStats();
    this.index = this.loadIndex();
  }

  // ─── Public API ──────────────────────────────────────────────────────

  /**
   * Retrieves a cached search result.
   * Returns null if not found, expired, or evicted.
   *
   * @param query - Original search query
   * @param filters - Applied search filters
   * @returns Cached data or null
   */
  get<T = unknown>(query: string, filters: SearchFilterOptions = {}): T | null {
    const key = generateCacheKey(query, filters);
    const entry = this.loadEntry<T>(key);

    if (!entry) {
      this.stats.misses++;
      this.saveStats();
      return null;
    }

    // Check TTL expiry
    const now = Date.now();
    if (now - entry.createdAt > entry.ttlMs) {
      this.removeEntry(key);
      this.stats.misses++;
      this.saveStats();
      return null;
    }

    // Update last accessed time (LRU tracking)
    entry.lastAccessedAt = now;
    this.saveEntry(key, entry);
    this.touchIndex(key);

    this.stats.hits++;
    this.saveStats();

    return entry.data;
  }

  /**
   * Stores a search result in the cache.
   * Triggers LRU eviction if max entries exceeded.
   *
   * @param query - Search query string
   * @param filters - Applied search filters
   * @param data - Data to cache
   * @param ttlMs - Optional TTL override in milliseconds
   */
  set<T = unknown>(
    query: string,
    filters: SearchFilterOptions = {},
    data: T,
    ttlMs?: number,
  ): void {
    const key = generateCacheKey(query, filters);
    const now = Date.now();

    const entry: CacheEntry<T> = {
      data,
      createdAt: now,
      lastAccessedAt: now,
      ttlMs: ttlMs ?? this.config.defaultTtlMs,
      key,
    };

    // Evict if at capacity (before adding new entry)
    while (this.index.length >= this.config.maxEntries) {
      this.evictLRU();
    }

    this.saveEntry(key, entry);
    this.addToIndex(key);
  }

  /**
   * Checks if a cache entry exists and is valid (not expired).
   *
   * @param query - Search query string
   * @param filters - Applied search filters
   * @returns true if a valid cache entry exists
   */
  has(query: string, filters: SearchFilterOptions = {}): boolean {
    const key = generateCacheKey(query, filters);
    const entry = this.loadEntry(key);

    if (!entry) return false;

    const now = Date.now();
    if (now - entry.createdAt > entry.ttlMs) {
      this.removeEntry(key);
      return false;
    }

    return true;
  }

  /**
   * Invalidates cache entries matching a query pattern.
   * Uses substring matching on the original query.
   *
   * @param pattern - Pattern to match against cached queries
   */
  invalidateByPattern(pattern: string): void {
    const keysToRemove: string[] = [];

    for (const key of this.index) {
      const entry = this.loadEntry(key);
      if (entry && entry.key.includes(pattern)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      this.removeEntry(key);
    }
  }

  /**
   * Invalidates a specific cache entry.
   *
   * @param query - Search query string
   * @param filters - Applied search filters
   */
  invalidate(query: string, filters: SearchFilterOptions = {}): void {
    const key = generateCacheKey(query, filters);
    this.removeEntry(key);
  }

  /**
   * Clears all cache entries and resets statistics.
   */
  clear(): void {
    for (const key of [...this.index]) {
      this.removeStorageEntry(key);
    }
    this.index = [];
    this.saveIndex();
    this.stats = { hits: 0, misses: 0, size: 0, evictions: 0, hitRate: 0 };
    this.saveStats();
  }

  /**
   * Returns current cache statistics.
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.index.length,
      hitRate: total > 0 ? Math.round((this.stats.hits / total) * 100) : 0,
    };
  }

  /**
   * Returns the current number of cached entries.
   */
  getSize(): number {
    return this.index.length;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────

  private evictLRU(): void {
    if (this.index.length === 0) return;

    // The first item in the index is the least recently used
    const lruKey = this.index[0];
    this.removeEntry(lruKey);
    this.stats.evictions++;
    this.saveStats();
  }

  private touchIndex(key: string): void {
    const idx = this.index.indexOf(key);
    if (idx >= 0) {
      this.index.splice(idx, 1);
    }
    this.index.push(key);
    this.saveIndex();
  }

  private addToIndex(key: string): void {
    const idx = this.index.indexOf(key);
    if (idx >= 0) {
      this.index.splice(idx, 1);
    }
    this.index.push(key);
    this.saveIndex();
  }

  private removeEntry(key: string): void {
    const idx = this.index.indexOf(key);
    if (idx >= 0) {
      this.index.splice(idx, 1);
      this.saveIndex();
    }
    this.removeStorageEntry(key);
  }

  private loadEntry<T = unknown>(key: string): CacheEntry<T> | null {
    try {
      const raw = localStorage.getItem(this.config.storageKeyPrefix + key);
      if (!raw) return null;
      return JSON.parse(raw) as CacheEntry<T>;
    } catch {
      return null;
    }
  }

  private saveEntry<T>(key: string, entry: CacheEntry<T>): void {
    try {
      localStorage.setItem(this.config.storageKeyPrefix + key, JSON.stringify(entry));
    } catch {
      // Storage full - evict and retry
      this.evictLRU();
      try {
        localStorage.setItem(this.config.storageKeyPrefix + key, JSON.stringify(entry));
      } catch {
        // Still failing - give up silently
      }
    }
  }

  private removeStorageEntry(key: string): void {
    localStorage.removeItem(this.config.storageKeyPrefix + key);
  }

  private loadStats(): CacheStats {
    try {
      const raw = localStorage.getItem(STATS_STORAGE_KEY);
      if (!raw) return { hits: 0, misses: 0, size: 0, evictions: 0, hitRate: 0 };
      return JSON.parse(raw) as CacheStats;
    } catch {
      return { hits: 0, misses: 0, size: 0, evictions: 0, hitRate: 0 };
    }
  }

  private saveStats(): void {
    try {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(this.stats));
    } catch {
      // Non-critical - stats loss is acceptable
    }
  }

  private loadIndex(): string[] {
    try {
      const raw = localStorage.getItem(INDEX_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  }

  private saveIndex(): void {
    try {
      localStorage.setItem(INDEX_STORAGE_KEY, JSON.stringify(this.index));
    } catch {
      // Non-critical
    }
  }
}
