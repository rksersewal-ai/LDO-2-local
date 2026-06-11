/**
 * Storage Usage Calculator
 *
 * Calculates storage usage per category and forecasts growth using
 * linear regression over historical data points.
 *
 * Usage:
 *   import { StorageUsageCalculator } from "@/lib/storage/storageUsageCalculator";
 *
 *   const calculator = new StorageUsageCalculator();
 *   calculator.recordUsage({ category: "originals", sizeBytes: 1024, fileCount: 10, measuredAt: "..." });
 *   const forecast = calculator.forecastGrowth(30);
 *   console.log(`Projected size in 30 days: ${forecast.projectedSizeBytes}`);
 */

import type { StorageCategory } from "./storageLayout";

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single usage measurement entry */
export interface UsageEntry {
  /** Storage category this measurement applies to */
  category: StorageCategory;
  /** Total size in bytes for this category at measurement time */
  sizeBytes: number;
  /** Number of files in this category at measurement time */
  fileCount: number;
  /** ISO 8601 timestamp when the measurement was taken */
  measuredAt: string;
}

/** Result of a growth forecast calculation */
export interface ForecastResult {
  /** Projected total size in bytes at the end of the forecast period */
  projectedSizeBytes: number;
  /** Average growth rate in bytes per day */
  growthRatePerDay: number;
  /** Number of days until a given limit is reached (Infinity if shrinking or stable) */
  daysUntilLimit: (limitBytes: number) => number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ─── Class ────────────────────────────────────────────────────────────────────

/**
 * Calculates storage usage metrics and forecasts growth.
 *
 * Maintains a history of usage entries and uses linear regression
 * to project future storage needs.
 */
export class StorageUsageCalculator {
  private readonly entries: UsageEntry[] = [];

  /**
   * Record a new usage measurement.
   *
   * @param entry - Usage entry to record
   */
  recordUsage(entry: UsageEntry): void {
    this.entries.push({ ...entry });
  }

  /**
   * Get the latest usage entry for each category.
   *
   * @returns Array of the most recent UsageEntry per category
   */
  getCurrentUsage(): UsageEntry[] {
    const latestByCategory = new Map<StorageCategory, UsageEntry>();

    for (const entry of this.entries) {
      const existing = latestByCategory.get(entry.category);
      if (!existing || entry.measuredAt > existing.measuredAt) {
        latestByCategory.set(entry.category, entry);
      }
    }

    return Array.from(latestByCategory.values());
  }

  /**
   * Get the total size across all categories (latest measurement per category).
   *
   * @returns Total size in bytes
   */
  getTotalSize(): number {
    const current = this.getCurrentUsage();
    return current.reduce((sum, entry) => sum + entry.sizeBytes, 0);
  }

  /**
   * Get the latest usage entry for a specific category.
   *
   * @param category - The storage category to query
   * @returns The latest UsageEntry for that category, or null if no data
   */
  getUsageByCategory(category: StorageCategory): UsageEntry | null {
    let latest: UsageEntry | null = null;

    for (const entry of this.entries) {
      if (entry.category === category) {
        if (!latest || entry.measuredAt > latest.measuredAt) {
          latest = entry;
        }
      }
    }

    return latest;
  }

  /**
   * Forecast storage growth using linear regression.
   *
   * Aggregates total size at each measurement timestamp and fits a line
   * to predict future growth. If fewer than 2 data points exist, assumes
   * zero growth from the current total.
   *
   * @param daysAhead - Number of days into the future to project
   * @returns ForecastResult with projected size, growth rate, and limit function
   */
  forecastGrowth(daysAhead: number): ForecastResult {
    const dataPoints = this.getAggregatedTimeSeries();

    if (dataPoints.length === 0) {
      return createForecastResult(0, 0);
    }

    if (dataPoints.length === 1) {
      return createForecastResult(dataPoints[0].totalSize, 0);
    }

    // Linear regression: y = mx + b
    // where x = days since first measurement, y = total bytes
    const { slope, intercept } = linearRegression(dataPoints);

    const lastPoint = dataPoints[dataPoints.length - 1];
    const projectedSize = Math.max(0, lastPoint.totalSize + slope * daysAhead);

    return createForecastResult(projectedSize, slope);

    function createForecastResult(projected: number, rate: number): ForecastResult {
      return {
        projectedSizeBytes: Math.round(projected),
        growthRatePerDay: rate,
        daysUntilLimit: (limitBytes: number): number => {
          const currentSize = dataPoints.length > 0
            ? dataPoints[dataPoints.length - 1].totalSize
            : 0;

          if (currentSize >= limitBytes) {
            return 0;
          }

          if (rate <= 0) {
            return Infinity;
          }

          return Math.ceil((limitBytes - currentSize) / rate);
        },
      };
    }

    function linearRegression(points: Array<{ dayOffset: number; totalSize: number }>) {
      const n = points.length;
      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumX2 = 0;

      for (const point of points) {
        sumX += point.dayOffset;
        sumY += point.totalSize;
        sumXY += point.dayOffset * point.totalSize;
        sumX2 += point.dayOffset * point.dayOffset;
      }

      const denominator = n * sumX2 - sumX * sumX;

      if (denominator === 0) {
        // All points at same x: no slope determinable
        return { slope: 0, intercept: sumY / n };
      }

      const slopeVal = (n * sumXY - sumX * sumY) / denominator;
      const interceptVal = (sumY - slopeVal * sumX) / n;

      return { slope: slopeVal, intercept: interceptVal };
    }
  }

  /**
   * Get the number of recorded entries.
   *
   * @returns Total number of usage entries recorded
   */
  getEntryCount(): number {
    return this.entries.length;
  }

  /**
   * Clear all recorded entries.
   */
  clear(): void {
    this.entries.length = 0;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Aggregate entries into a time series of total sizes.
   * Groups entries by measurement timestamp and sums sizes.
   */
  private getAggregatedTimeSeries(): Array<{ dayOffset: number; totalSize: number }> {
    if (this.entries.length === 0) return [];

    // Group by measuredAt timestamp
    const byTimestamp = new Map<string, number>();

    for (const entry of this.entries) {
      const current = byTimestamp.get(entry.measuredAt) ?? 0;
      byTimestamp.set(entry.measuredAt, current + entry.sizeBytes);
    }

    // Convert to sorted array
    const sorted = Array.from(byTimestamp.entries())
      .map(([timestamp, totalSize]) => ({
        timestamp,
        time: new Date(timestamp).getTime(),
        totalSize,
      }))
      .sort((a, b) => a.time - b.time);

    if (sorted.length === 0) return [];

    const firstTime = sorted[0].time;

    return sorted.map((point) => ({
      dayOffset: (point.time - firstTime) / MS_PER_DAY,
      totalSize: point.totalSize,
    }));
  }
}
