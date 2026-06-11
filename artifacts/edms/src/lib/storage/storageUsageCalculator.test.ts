import { describe, it, expect, beforeEach } from "vitest";
import { StorageUsageCalculator } from "./storageUsageCalculator";
import type { UsageEntry } from "./storageUsageCalculator";

describe("StorageUsageCalculator", () => {
  let calculator: StorageUsageCalculator;

  beforeEach(() => {
    calculator = new StorageUsageCalculator();
  });

  /** Helper to create a date N days ago */
  function daysAgo(days: number): string {
    const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return date.toISOString();
  }

  /** Helper to create a specific date for deterministic tests */
  function specificDate(year: number, month: number, day: number): string {
    return new Date(year, month - 1, day).toISOString();
  }

  describe("recordUsage", () => {
    it("records a usage entry", () => {
      calculator.recordUsage({
        category: "originals",
        sizeBytes: 1000,
        fileCount: 5,
        measuredAt: daysAgo(0),
      });
      expect(calculator.getEntryCount()).toBe(1);
    });

    it("records multiple entries", () => {
      calculator.recordUsage({
        category: "originals",
        sizeBytes: 1000,
        fileCount: 5,
        measuredAt: daysAgo(1),
      });
      calculator.recordUsage({
        category: "previews",
        sizeBytes: 500,
        fileCount: 3,
        measuredAt: daysAgo(0),
      });
      expect(calculator.getEntryCount()).toBe(2);
    });
  });

  describe("getCurrentUsage", () => {
    it("returns empty array when no entries recorded", () => {
      expect(calculator.getCurrentUsage()).toEqual([]);
    });

    it("returns latest entry per category", () => {
      calculator.recordUsage({
        category: "originals",
        sizeBytes: 1000,
        fileCount: 5,
        measuredAt: specificDate(2024, 1, 1),
      });
      calculator.recordUsage({
        category: "originals",
        sizeBytes: 2000,
        fileCount: 10,
        measuredAt: specificDate(2024, 1, 10),
      });

      const current = calculator.getCurrentUsage();
      expect(current).toHaveLength(1);
      expect(current[0].sizeBytes).toBe(2000);
      expect(current[0].fileCount).toBe(10);
    });

    it("returns one entry per category", () => {
      calculator.recordUsage({
        category: "originals",
        sizeBytes: 1000,
        fileCount: 5,
        measuredAt: daysAgo(0),
      });
      calculator.recordUsage({
        category: "previews",
        sizeBytes: 500,
        fileCount: 3,
        measuredAt: daysAgo(0),
      });

      const current = calculator.getCurrentUsage();
      expect(current).toHaveLength(2);
    });
  });

  describe("getTotalSize", () => {
    it("returns 0 when no entries", () => {
      expect(calculator.getTotalSize()).toBe(0);
    });

    it("sums latest size across categories", () => {
      calculator.recordUsage({
        category: "originals",
        sizeBytes: 1000,
        fileCount: 5,
        measuredAt: daysAgo(0),
      });
      calculator.recordUsage({
        category: "previews",
        sizeBytes: 500,
        fileCount: 3,
        measuredAt: daysAgo(0),
      });
      expect(calculator.getTotalSize()).toBe(1500);
    });

    it("uses only the latest measurement per category", () => {
      calculator.recordUsage({
        category: "originals",
        sizeBytes: 1000,
        fileCount: 5,
        measuredAt: specificDate(2024, 1, 1),
      });
      calculator.recordUsage({
        category: "originals",
        sizeBytes: 3000,
        fileCount: 15,
        measuredAt: specificDate(2024, 1, 10),
      });
      expect(calculator.getTotalSize()).toBe(3000);
    });
  });

  describe("getUsageByCategory", () => {
    it("returns null for category with no data", () => {
      expect(calculator.getUsageByCategory("originals")).toBeNull();
    });

    it("returns latest entry for specified category", () => {
      calculator.recordUsage({
        category: "originals",
        sizeBytes: 1000,
        fileCount: 5,
        measuredAt: specificDate(2024, 1, 1),
      });
      calculator.recordUsage({
        category: "originals",
        sizeBytes: 2000,
        fileCount: 10,
        measuredAt: specificDate(2024, 1, 10),
      });

      const result = calculator.getUsageByCategory("originals");
      expect(result).not.toBeNull();
      expect(result!.sizeBytes).toBe(2000);
    });

    it("does not return entries from other categories", () => {
      calculator.recordUsage({
        category: "previews",
        sizeBytes: 1000,
        fileCount: 5,
        measuredAt: daysAgo(0),
      });

      expect(calculator.getUsageByCategory("originals")).toBeNull();
    });
  });

  describe("forecastGrowth", () => {
    it("returns zero projection with no data", () => {
      const forecast = calculator.forecastGrowth(30);
      expect(forecast.projectedSizeBytes).toBe(0);
      expect(forecast.growthRatePerDay).toBe(0);
    });

    it("returns current size with single data point (no growth)", () => {
      calculator.recordUsage({
        category: "originals",
        sizeBytes: 5000,
        fileCount: 10,
        measuredAt: daysAgo(0),
      });

      const forecast = calculator.forecastGrowth(30);
      expect(forecast.projectedSizeBytes).toBe(5000);
      expect(forecast.growthRatePerDay).toBe(0);
    });

    it("projects linear growth with two data points", () => {
      // Day 0: 1000 bytes, Day 10: 2000 bytes => 100 bytes/day
      calculator.recordUsage({
        category: "originals",
        sizeBytes: 1000,
        fileCount: 5,
        measuredAt: specificDate(2024, 1, 1),
      });
      calculator.recordUsage({
        category: "originals",
        sizeBytes: 2000,
        fileCount: 10,
        measuredAt: specificDate(2024, 1, 11),
      });

      const forecast = calculator.forecastGrowth(10);
      // Growth rate should be 100 bytes/day
      expect(forecast.growthRatePerDay).toBeCloseTo(100, 0);
      // After 10 more days: 2000 + 100*10 = 3000
      expect(forecast.projectedSizeBytes).toBeCloseTo(3000, -1);
    });

    it("projects growth with multiple data points", () => {
      // Linear growth: 1000, 2000, 3000 over 3 days
      calculator.recordUsage({
        category: "originals",
        sizeBytes: 1000,
        fileCount: 5,
        measuredAt: specificDate(2024, 1, 1),
      });
      calculator.recordUsage({
        category: "originals",
        sizeBytes: 2000,
        fileCount: 10,
        measuredAt: specificDate(2024, 1, 2),
      });
      calculator.recordUsage({
        category: "originals",
        sizeBytes: 3000,
        fileCount: 15,
        measuredAt: specificDate(2024, 1, 3),
      });

      const forecast = calculator.forecastGrowth(7);
      expect(forecast.growthRatePerDay).toBeCloseTo(1000, 0);
      // Current is 3000, 7 days at 1000/day = 10000
      expect(forecast.projectedSizeBytes).toBeCloseTo(10000, -1);
    });

    it("does not project negative sizes", () => {
      // Shrinking data
      calculator.recordUsage({
        category: "originals",
        sizeBytes: 5000,
        fileCount: 50,
        measuredAt: specificDate(2024, 1, 1),
      });
      calculator.recordUsage({
        category: "originals",
        sizeBytes: 1000,
        fileCount: 10,
        measuredAt: specificDate(2024, 1, 2),
      });

      const forecast = calculator.forecastGrowth(100);
      expect(forecast.projectedSizeBytes).toBeGreaterThanOrEqual(0);
    });

    describe("daysUntilLimit", () => {
      it("returns Infinity when growth rate is 0", () => {
        calculator.recordUsage({
          category: "originals",
          sizeBytes: 1000,
          fileCount: 5,
          measuredAt: daysAgo(0),
        });

        const forecast = calculator.forecastGrowth(30);
        expect(forecast.daysUntilLimit(10000)).toBe(Infinity);
      });

      it("returns 0 when already over limit", () => {
        calculator.recordUsage({
          category: "originals",
          sizeBytes: 1000,
          fileCount: 5,
          measuredAt: specificDate(2024, 1, 1),
        });
        calculator.recordUsage({
          category: "originals",
          sizeBytes: 2000,
          fileCount: 10,
          measuredAt: specificDate(2024, 1, 2),
        });

        const forecast = calculator.forecastGrowth(30);
        // Current size is 2000, limit is 1500 => already over
        expect(forecast.daysUntilLimit(1500)).toBe(0);
      });

      it("calculates days until limit correctly", () => {
        // 1000 bytes/day growth, current = 2000
        calculator.recordUsage({
          category: "originals",
          sizeBytes: 1000,
          fileCount: 5,
          measuredAt: specificDate(2024, 1, 1),
        });
        calculator.recordUsage({
          category: "originals",
          sizeBytes: 2000,
          fileCount: 10,
          measuredAt: specificDate(2024, 1, 2),
        });

        const forecast = calculator.forecastGrowth(30);
        // Current = 2000, limit = 5000, rate = 1000/day => 3 days
        const days = forecast.daysUntilLimit(5000);
        expect(days).toBe(3);
      });

      it("returns Infinity when shrinking", () => {
        calculator.recordUsage({
          category: "originals",
          sizeBytes: 5000,
          fileCount: 50,
          measuredAt: specificDate(2024, 1, 1),
        });
        calculator.recordUsage({
          category: "originals",
          sizeBytes: 3000,
          fileCount: 30,
          measuredAt: specificDate(2024, 1, 2),
        });

        const forecast = calculator.forecastGrowth(30);
        expect(forecast.daysUntilLimit(10000)).toBe(Infinity);
      });
    });
  });

  describe("clear", () => {
    it("removes all entries", () => {
      calculator.recordUsage({
        category: "originals",
        sizeBytes: 1000,
        fileCount: 5,
        measuredAt: daysAgo(0),
      });
      calculator.clear();
      expect(calculator.getEntryCount()).toBe(0);
      expect(calculator.getCurrentUsage()).toEqual([]);
    });
  });
});
