/**
 * Safe Image Dimensions Checker
 *
 * Validates image dimensions for OCR processing to prevent memory exhaustion.
 * Aligned with config/ocr_pipeline.yaml:
 *   max_pixels: 200000000 (200 million pixels)
 *
 * Provides:
 *   - Dimension validation against pixel limits
 *   - Memory usage estimation
 *   - OCR limit checking
 *   - Safe dimension calculation for downscaling
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DimensionCheckResult {
  valid: boolean;
  totalPixels: number;
  maxPixels: number;
  exceedsBy?: number;
  recommendation?: string;
}

export interface MemoryEstimate {
  /** Raw pixel data in bytes */
  rawBytes: number;
  /** Estimated working memory with processing overhead (2x raw) */
  workingBytes: number;
  /** Human-readable size (e.g., "1.5 GB") */
  humanReadable: string;
}

export interface SafeDimensions {
  width: number;
  height: number;
  scaleFactor: number;
  /** Whether downscaling was needed */
  wasScaled: boolean;
}

// ─── Constants (aligned with config/ocr_pipeline.yaml) ────────────────────────

/** Maximum total pixels for OCR processing (from ocr_pipeline.yaml max_pixels) */
export const MAX_OCR_PIXELS = 200_000_000;

/** Bytes per pixel for RGBA images */
export const BYTES_PER_PIXEL_RGBA = 4;

/** Bytes per pixel for RGB images */
export const BYTES_PER_PIXEL_RGB = 3;

/** Processing overhead multiplier (OCR engines typically need 2x raw memory) */
export const PROCESSING_OVERHEAD_MULTIPLIER = 2;

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Check whether image dimensions are within the allowed pixel limit.
 *
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @param maxPixels - Maximum allowed pixels (default: 200M from config)
 * @returns DimensionCheckResult with validation status
 */
export function checkImageDimensions(
  width: number,
  height: number,
  maxPixels: number = MAX_OCR_PIXELS,
): DimensionCheckResult {
  if (width <= 0 || height <= 0) {
    return {
      valid: false,
      totalPixels: 0,
      maxPixels,
      recommendation: "Image dimensions must be positive numbers",
    };
  }

  const totalPixels = width * height;
  const valid = totalPixels <= maxPixels;

  const result: DimensionCheckResult = {
    valid,
    totalPixels,
    maxPixels,
  };

  if (!valid) {
    result.exceedsBy = totalPixels - maxPixels;
    const safeDims = calculateSafeDimensions(width, height, maxPixels);
    result.recommendation =
      `Image exceeds pixel limit by ${result.exceedsBy.toLocaleString()} pixels. ` +
      `Consider resizing to ${safeDims.width}x${safeDims.height} (scale factor: ${safeDims.scaleFactor.toFixed(3)})`;
  }

  return result;
}

/**
 * Estimate memory usage for processing an image.
 *
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @param channels - Number of color channels (3 for RGB, 4 for RGBA). Default: 4
 * @returns MemoryEstimate with raw and working memory sizes
 */
export function estimateMemoryUsage(
  width: number,
  height: number,
  channels: number = 4,
): MemoryEstimate {
  if (width <= 0 || height <= 0 || channels <= 0) {
    return {
      rawBytes: 0,
      workingBytes: 0,
      humanReadable: "0 B",
    };
  }

  const rawBytes = width * height * channels;
  const workingBytes = rawBytes * PROCESSING_OVERHEAD_MULTIPLIER;

  return {
    rawBytes,
    workingBytes,
    humanReadable: formatBytes(workingBytes),
  };
}

/**
 * Check if a file (by its image dimensions) is within OCR processing limits.
 *
 * @param file - Object with width and height properties
 * @returns true if the image is within OCR limits
 */
export function isWithinOcrLimits(file: { width: number; height: number }): boolean {
  const result = checkImageDimensions(file.width, file.height, MAX_OCR_PIXELS);
  return result.valid;
}

/**
 * Calculate safe dimensions that fit within the pixel limit while
 * preserving aspect ratio.
 *
 * @param originalWidth - Original image width
 * @param originalHeight - Original image height
 * @param maxPixels - Maximum allowed pixels (default: 200M from config)
 * @returns SafeDimensions with the scaled width, height, and scale factor
 */
export function calculateSafeDimensions(
  originalWidth: number,
  originalHeight: number,
  maxPixels: number = MAX_OCR_PIXELS,
): SafeDimensions {
  if (originalWidth <= 0 || originalHeight <= 0) {
    return {
      width: 0,
      height: 0,
      scaleFactor: 0,
      wasScaled: false,
    };
  }

  const totalPixels = originalWidth * originalHeight;

  if (totalPixels <= maxPixels) {
    return {
      width: originalWidth,
      height: originalHeight,
      scaleFactor: 1,
      wasScaled: false,
    };
  }

  // Calculate scale factor to fit within maxPixels while preserving aspect ratio
  const scaleFactor = Math.sqrt(maxPixels / totalPixels);
  const newWidth = Math.floor(originalWidth * scaleFactor);
  const newHeight = Math.floor(originalHeight * scaleFactor);

  return {
    width: newWidth,
    height: newHeight,
    scaleFactor,
    wasScaled: true,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format bytes into a human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}
