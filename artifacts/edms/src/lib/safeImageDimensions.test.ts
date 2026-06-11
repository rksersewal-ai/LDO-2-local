import { describe, it, expect } from "vitest";
import {
  checkImageDimensions,
  estimateMemoryUsage,
  isWithinOcrLimits,
  calculateSafeDimensions,
  MAX_OCR_PIXELS,
  BYTES_PER_PIXEL_RGBA,
  PROCESSING_OVERHEAD_MULTIPLIER,
} from "./safeImageDimensions";

describe("safeImageDimensions", () => {
  describe("constants", () => {
    it("MAX_OCR_PIXELS matches config/ocr_pipeline.yaml max_pixels", () => {
      expect(MAX_OCR_PIXELS).toBe(200_000_000);
    });

    it("uses 4 bytes per RGBA pixel", () => {
      expect(BYTES_PER_PIXEL_RGBA).toBe(4);
    });

    it("applies 2x processing overhead", () => {
      expect(PROCESSING_OVERHEAD_MULTIPLIER).toBe(2);
    });
  });

  describe("checkImageDimensions", () => {
    it("accepts dimensions within the default pixel limit", () => {
      const result = checkImageDimensions(10000, 10000); // 100M pixels
      expect(result.valid).toBe(true);
      expect(result.totalPixels).toBe(100_000_000);
      expect(result.maxPixels).toBe(MAX_OCR_PIXELS);
      expect(result.exceedsBy).toBeUndefined();
    });

    it("accepts dimensions exactly at the limit", () => {
      const result = checkImageDimensions(20000, 10000); // 200M pixels exactly
      expect(result.valid).toBe(true);
      expect(result.totalPixels).toBe(200_000_000);
    });

    it("rejects dimensions exceeding the limit", () => {
      const result = checkImageDimensions(20000, 15000); // 300M pixels
      expect(result.valid).toBe(false);
      expect(result.totalPixels).toBe(300_000_000);
      expect(result.exceedsBy).toBe(100_000_000);
      expect(result.recommendation).toBeDefined();
    });

    it("supports custom max pixel limit", () => {
      const result = checkImageDimensions(1000, 1000, 500_000); // 1M vs 500K limit
      expect(result.valid).toBe(false);
      expect(result.exceedsBy).toBe(500_000);
    });

    it("handles zero dimensions", () => {
      const result = checkImageDimensions(0, 1000);
      expect(result.valid).toBe(false);
      expect(result.totalPixels).toBe(0);
      expect(result.recommendation).toContain("positive numbers");
    });

    it("handles negative dimensions", () => {
      const result = checkImageDimensions(-100, 100);
      expect(result.valid).toBe(false);
    });

    it("provides resize recommendation when exceeding limit", () => {
      const result = checkImageDimensions(20000, 20000); // 400M pixels
      expect(result.recommendation).toContain("Consider resizing");
      expect(result.recommendation).toContain("scale factor");
    });
  });

  describe("estimateMemoryUsage", () => {
    it("calculates raw bytes correctly for RGBA", () => {
      const result = estimateMemoryUsage(1000, 1000, 4);
      expect(result.rawBytes).toBe(4_000_000);
    });

    it("calculates raw bytes correctly for RGB", () => {
      const result = estimateMemoryUsage(1000, 1000, 3);
      expect(result.rawBytes).toBe(3_000_000);
    });

    it("applies processing overhead multiplier to working bytes", () => {
      const result = estimateMemoryUsage(1000, 1000, 4);
      expect(result.workingBytes).toBe(8_000_000); // 2x raw
    });

    it("defaults to 4 channels (RGBA)", () => {
      const result = estimateMemoryUsage(1000, 1000);
      expect(result.rawBytes).toBe(4_000_000);
    });

    it("provides human-readable size string", () => {
      const result = estimateMemoryUsage(10000, 10000, 4);
      // 10000*10000*4*2 = 800MB working
      expect(result.humanReadable).toContain("MB");
    });

    it("handles zero dimensions", () => {
      const result = estimateMemoryUsage(0, 100);
      expect(result.rawBytes).toBe(0);
      expect(result.workingBytes).toBe(0);
      expect(result.humanReadable).toBe("0 B");
    });

    it("handles large images (GB range)", () => {
      const result = estimateMemoryUsage(50000, 50000, 4);
      // 50000*50000*4 = 10GB raw, 20GB working
      expect(result.humanReadable).toContain("GB");
    });
  });

  describe("isWithinOcrLimits", () => {
    it("returns true for images within OCR limits", () => {
      expect(isWithinOcrLimits({ width: 5000, height: 5000 })).toBe(true);
    });

    it("returns true for exactly at the limit", () => {
      expect(isWithinOcrLimits({ width: 20000, height: 10000 })).toBe(true);
    });

    it("returns false for images exceeding OCR limits", () => {
      expect(isWithinOcrLimits({ width: 20000, height: 15000 })).toBe(false);
    });
  });

  describe("calculateSafeDimensions", () => {
    it("returns original dimensions when within limit", () => {
      const result = calculateSafeDimensions(5000, 5000);
      expect(result.width).toBe(5000);
      expect(result.height).toBe(5000);
      expect(result.scaleFactor).toBe(1);
      expect(result.wasScaled).toBe(false);
    });

    it("scales down dimensions that exceed the limit", () => {
      const result = calculateSafeDimensions(20000, 20000); // 400M pixels -> 200M max
      expect(result.wasScaled).toBe(true);
      expect(result.scaleFactor).toBeCloseTo(Math.sqrt(0.5), 3);
      // Verify the result is within limits
      expect(result.width * result.height).toBeLessThanOrEqual(MAX_OCR_PIXELS);
    });

    it("preserves aspect ratio", () => {
      const result = calculateSafeDimensions(40000, 20000, 100_000_000);
      const originalRatio = 40000 / 20000;
      const newRatio = result.width / result.height;
      // Allow small floating point variance due to floor
      expect(Math.abs(originalRatio - newRatio)).toBeLessThan(0.01);
    });

    it("supports custom max pixels", () => {
      const result = calculateSafeDimensions(1000, 1000, 500_000);
      expect(result.wasScaled).toBe(true);
      expect(result.width * result.height).toBeLessThanOrEqual(500_000);
    });

    it("handles zero dimensions", () => {
      const result = calculateSafeDimensions(0, 100);
      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
      expect(result.scaleFactor).toBe(0);
      expect(result.wasScaled).toBe(false);
    });

    it("handles negative dimensions", () => {
      const result = calculateSafeDimensions(-100, 100);
      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
    });
  });
});
