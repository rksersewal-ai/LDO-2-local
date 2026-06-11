/**
 * Rate Limiting
 *
 * Client-side rate limit tracking using a sliding window algorithm.
 * Tracks request counts per endpoint within configurable time windows,
 * preventing excessive API calls from the frontend.
 *
 * Usage:
 *   import { RateLimiter } from "@/lib/security/rateLimiting";
 *
 *   const limiter = new RateLimiter({ "/api/search": { maxRequests: 10, windowMs: 60000 } });
 *   if (!limiter.isLimited("/api/search")) {
 *     limiter.recordRequest("/api/search");
 *     // proceed with request
 *   }
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Configuration for a single endpoint's rate limit */
export interface EndpointLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

/** Map of endpoint paths to their rate limit configurations */
export type RateLimitConfig = Record<string, EndpointLimitConfig>;

/** Result of a rate limit check */
export interface RateLimitCheckResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** Milliseconds until the window resets (oldest request falls off) */
  resetsInMs: number;
  /** Total requests made in the current window */
  currentCount: number;
}

/** Default configuration applied when an endpoint has no specific config */
export interface RateLimiterOptions {
  /** Per-endpoint rate limit configurations */
  endpoints: RateLimitConfig;
  /** Default limit for unconfigured endpoints. If not set, unconfigured endpoints are unlimited. */
  defaultLimit?: EndpointLimitConfig;
}

// ─── Internal Types ───────────────────────────────────────────────────────────

interface RequestRecord {
  timestamp: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Client-side rate limiter using a sliding window algorithm.
 *
 * Maintains in-memory request timestamps per endpoint and checks
 * against configurable limits before allowing new requests.
 */
export class RateLimiter {
  private readonly config: RateLimitConfig;
  private readonly defaultLimit: EndpointLimitConfig | undefined;
  private readonly requests: Map<string, RequestRecord[]>;

  constructor(options: RateLimiterOptions) {
    this.config = options.endpoints;
    this.defaultLimit = options.defaultLimit;
    this.requests = new Map();
  }

  /**
   * Check if a request to the given endpoint is allowed without recording it.
   *
   * @param endpoint - The endpoint path to check
   * @returns Detailed check result including remaining quota
   */
  checkLimit(endpoint: string): RateLimitCheckResult {
    const limit = this.getEndpointLimit(endpoint);

    if (!limit) {
      return { allowed: true, remaining: Infinity, resetsInMs: 0, currentCount: 0 };
    }

    const now = Date.now();
    const records = this.getValidRecords(endpoint, now, limit.windowMs);
    const currentCount = records.length;
    const remaining = Math.max(0, limit.maxRequests - currentCount);
    const allowed = currentCount < limit.maxRequests;

    let resetsInMs = 0;
    if (records.length > 0) {
      const oldestInWindow = records[0].timestamp;
      resetsInMs = Math.max(0, oldestInWindow + limit.windowMs - now);
    }

    return { allowed, remaining, resetsInMs, currentCount };
  }

  /**
   * Record a request to the given endpoint.
   *
   * @param endpoint - The endpoint path to record a request for
   */
  recordRequest(endpoint: string): void {
    const records = this.requests.get(endpoint) ?? [];
    records.push({ timestamp: Date.now() });
    this.requests.set(endpoint, records);
  }

  /**
   * Get the number of remaining requests allowed for an endpoint.
   *
   * @param endpoint - The endpoint path to check
   * @returns Number of remaining requests, or Infinity if unconfigured
   */
  getRemainingRequests(endpoint: string): number {
    return this.checkLimit(endpoint).remaining;
  }

  /**
   * Check if an endpoint is currently rate limited.
   *
   * @param endpoint - The endpoint path to check
   * @returns true if the endpoint has exceeded its request limit
   */
  isLimited(endpoint: string): boolean {
    return !this.checkLimit(endpoint).allowed;
  }

  /**
   * Reset all recorded requests for a specific endpoint.
   *
   * @param endpoint - The endpoint path to reset
   */
  reset(endpoint: string): void {
    this.requests.delete(endpoint);
  }

  /**
   * Reset all recorded requests for all endpoints.
   */
  resetAll(): void {
    this.requests.clear();
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  private getEndpointLimit(endpoint: string): EndpointLimitConfig | undefined {
    return this.config[endpoint] ?? this.defaultLimit;
  }

  private getValidRecords(endpoint: string, now: number, windowMs: number): RequestRecord[] {
    const records = this.requests.get(endpoint) ?? [];
    const cutoff = now - windowMs;
    const validRecords = records.filter((r) => r.timestamp > cutoff);

    // Clean up expired records
    if (validRecords.length !== records.length) {
      this.requests.set(endpoint, validRecords);
    }

    return validRecords;
  }
}
