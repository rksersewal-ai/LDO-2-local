/**
 * API Performance Instrumentation
 *
 * Provides request timing, slow query detection, and metrics collection
 * for monitoring API performance across the EDMS application.
 *
 * Features:
 *   - RequestTimer: start/end/duration tracking for individual requests
 *   - SlowQueryDetector: configurable threshold-based slow query alerts
 *   - RequestMetricsCollector: tracks p50/p95/p99 across requests
 *   - formatMetricsSummary: human-readable metrics output
 *   - Optional localStorage persistence for metrics history
 */

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

/** Timing entry for a single request */
export interface RequestTiming {
  url: string;
  method: string;
  startTime: number;
  endTime: number;
  duration: number;
}

/** Configuration for slow query detection */
export interface SlowQueryConfig {
  /** Duration threshold in ms to consider a query slow (default: 2000) */
  thresholdMs: number;
  /** Maximum number of slow queries to retain */
  maxEntries: number;
}

/** Slow query record */
export interface SlowQueryRecord {
  timing: RequestTiming;
  detectedAt: number;
  exceededBy: number;
}

/** Percentile metrics summary */
export interface PercentileMetrics {
  p50: number;
  p95: number;
  p99: number;
  count: number;
  mean: number;
  min: number;
  max: number;
}

/** Formatted metrics summary output */
export interface MetricsSummary {
  totalRequests: number;
  percentiles: PercentileMetrics;
  slowQueries: number;
  byEndpoint: Record<string, PercentileMetrics>;
}

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_SLOW_THRESHOLD_MS = 2000;
const DEFAULT_MAX_ENTRIES = 100;
const STORAGE_KEY = "edms_api_metrics";

// ─────────────────────────────────────────────────────────────────────────
// RequestTimer
// ─────────────────────────────────────────────────────────────────────────

/**
 * Tracks timing for a single API request.
 *
 * Usage:
 *   const timer = new RequestTimer('/api/documents', 'GET');
 *   timer.start();
 *   // ... perform request ...
 *   timer.end();
 *   console.log(timer.duration); // duration in ms
 */
export class RequestTimer {
  public readonly url: string;
  public readonly method: string;
  private _startTime: number = 0;
  private _endTime: number = 0;
  private _started: boolean = false;
  private _ended: boolean = false;

  constructor(url: string, method: string = "GET") {
    this.url = url;
    this.method = method.toUpperCase();
  }

  /** Start the timer */
  start(): void {
    this._startTime = performance.now();
    this._started = true;
    this._ended = false;
  }

  /** End the timer */
  end(): void {
    if (!this._started) {
      throw new Error("Timer has not been started");
    }
    this._endTime = performance.now();
    this._ended = true;
  }

  /** Get the start time */
  get startTime(): number {
    return this._startTime;
  }

  /** Get the end time */
  get endTime(): number {
    return this._endTime;
  }

  /** Get the duration in milliseconds */
  get duration(): number {
    if (!this._ended) {
      throw new Error("Timer has not been ended");
    }
    return this._endTime - this._startTime;
  }

  /** Whether the timer is currently running */
  get isRunning(): boolean {
    return this._started && !this._ended;
  }

  /** Convert to RequestTiming record */
  toTiming(): RequestTiming {
    return {
      url: this.url,
      method: this.method,
      startTime: this._startTime,
      endTime: this._endTime,
      duration: this.duration,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SlowQueryDetector
// ─────────────────────────────────────────────────────────────────────────

/**
 * Detects slow API queries based on configurable threshold.
 *
 * Usage:
 *   const detector = new SlowQueryDetector({ thresholdMs: 2000 });
 *   detector.check(timing); // returns SlowQueryRecord | null
 */
export class SlowQueryDetector {
  private config: SlowQueryConfig;
  private records: SlowQueryRecord[] = [];

  constructor(config?: Partial<SlowQueryConfig>) {
    this.config = {
      thresholdMs: config?.thresholdMs ?? DEFAULT_SLOW_THRESHOLD_MS,
      maxEntries: config?.maxEntries ?? DEFAULT_MAX_ENTRIES,
    };
  }

  /** Check a timing against the threshold. Returns record if slow, null otherwise. */
  check(timing: RequestTiming): SlowQueryRecord | null {
    if (timing.duration <= this.config.thresholdMs) {
      return null;
    }

    const record: SlowQueryRecord = {
      timing,
      detectedAt: Date.now(),
      exceededBy: timing.duration - this.config.thresholdMs,
    };

    this.records.push(record);

    // Trim to max entries
    if (this.records.length > this.config.maxEntries) {
      this.records = this.records.slice(-this.config.maxEntries);
    }

    return record;
  }

  /** Get all detected slow queries */
  getRecords(): SlowQueryRecord[] {
    return [...this.records];
  }

  /** Get the current threshold */
  get threshold(): number {
    return this.config.thresholdMs;
  }

  /** Clear all records */
  clear(): void {
    this.records = [];
  }
}

// ─────────────────────────────────────────────────────────────────────────
// RequestMetricsCollector
// ─────────────────────────────────────────────────────────────────────────

/**
 * Collects request timings and computes percentile-based metrics.
 *
 * Usage:
 *   const collector = new RequestMetricsCollector();
 *   collector.record(timing);
 *   const metrics = collector.getMetrics();
 *   console.log(metrics.p95);
 */
export class RequestMetricsCollector {
  private timings: RequestTiming[] = [];
  private maxTimings: number;
  private persistToStorage: boolean;

  constructor(options?: { maxTimings?: number; persist?: boolean }) {
    this.maxTimings = options?.maxTimings ?? 1000;
    this.persistToStorage = options?.persist ?? false;

    if (this.persistToStorage) {
      this.loadFromStorage();
    }
  }

  /** Record a new request timing */
  record(timing: RequestTiming): void {
    this.timings.push(timing);

    if (this.timings.length > this.maxTimings) {
      this.timings = this.timings.slice(-this.maxTimings);
    }

    if (this.persistToStorage) {
      this.saveToStorage();
    }
  }

  /** Get percentile metrics for all recorded timings */
  getMetrics(): PercentileMetrics {
    return calculatePercentiles(this.timings.map((t) => t.duration));
  }

  /** Get percentile metrics grouped by endpoint (URL) */
  getMetricsByEndpoint(): Record<string, PercentileMetrics> {
    const grouped: Record<string, number[]> = {};

    for (const timing of this.timings) {
      const key = `${timing.method} ${timing.url}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(timing.duration);
    }

    const result: Record<string, PercentileMetrics> = {};
    for (const [key, durations] of Object.entries(grouped)) {
      result[key] = calculatePercentiles(durations);
    }

    return result;
  }

  /** Get the total number of recorded timings */
  get count(): number {
    return this.timings.length;
  }

  /** Clear all timings */
  clear(): void {
    this.timings = [];
    if (this.persistToStorage) {
      this.saveToStorage();
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.timings = JSON.parse(stored);
      }
    } catch {
      // Silently fail if storage is unavailable
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.timings));
    } catch {
      // Silently fail if storage is full or unavailable
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────

/**
 * Calculate percentile metrics from an array of durations.
 */
export function calculatePercentiles(durations: number[]): PercentileMetrics {
  if (durations.length === 0) {
    return { p50: 0, p95: 0, p99: 0, count: 0, mean: 0, min: 0, max: 0 };
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, d) => acc + d, 0);

  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    count,
    mean: sum / count,
    min: sorted[0],
    max: sorted[count - 1],
  };
}

/**
 * Get a specific percentile value from a sorted array.
 */
function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const index = (pct / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sorted[lower];

  const fraction = index - lower;
  return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
}

/**
 * Format metrics into a human-readable summary.
 */
export function formatMetricsSummary(
  collector: RequestMetricsCollector,
  detector?: SlowQueryDetector,
): MetricsSummary {
  return {
    totalRequests: collector.count,
    percentiles: collector.getMetrics(),
    slowQueries: detector?.getRecords().length ?? 0,
    byEndpoint: collector.getMetricsByEndpoint(),
  };
}
