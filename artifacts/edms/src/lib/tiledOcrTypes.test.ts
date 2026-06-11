import { describe, expect, it } from "vitest";
import {
  isTileStatus,
  isOcrPipelineStatus,
  isTileCoordinates,
  isTileResult,
  isTiledOcrJob,
} from "./tiledOcrTypes";
import type {
  TileCoordinates,
  TileResult,
  TiledOcrJob,
} from "./tiledOcrTypes";
import {
  DEFAULT_OCR_PIPELINE_CONFIG,
  getOcrPipelineConfig,
} from "./ocrPipelineConfig";

describe("tiledOcrTypes - type guards", () => {
  describe("isTileStatus", () => {
    it("returns true for valid tile statuses", () => {
      expect(isTileStatus("pending")).toBe(true);
      expect(isTileStatus("processing")).toBe(true);
      expect(isTileStatus("completed")).toBe(true);
      expect(isTileStatus("failed")).toBe(true);
      expect(isTileStatus("skipped")).toBe(true);
    });

    it("returns false for invalid values", () => {
      expect(isTileStatus("unknown")).toBe(false);
      expect(isTileStatus("")).toBe(false);
      expect(isTileStatus(null)).toBe(false);
      expect(isTileStatus(undefined)).toBe(false);
      expect(isTileStatus(123)).toBe(false);
      expect(isTileStatus({})).toBe(false);
    });
  });

  describe("isOcrPipelineStatus", () => {
    it("returns true for valid pipeline statuses", () => {
      expect(isOcrPipelineStatus("queued")).toBe(true);
      expect(isOcrPipelineStatus("tiling")).toBe(true);
      expect(isOcrPipelineStatus("processing")).toBe(true);
      expect(isOcrPipelineStatus("merging")).toBe(true);
      expect(isOcrPipelineStatus("deduplicating")).toBe(true);
      expect(isOcrPipelineStatus("completed")).toBe(true);
      expect(isOcrPipelineStatus("failed")).toBe(true);
      expect(isOcrPipelineStatus("cancelled")).toBe(true);
    });

    it("returns false for invalid values", () => {
      expect(isOcrPipelineStatus("running")).toBe(false);
      expect(isOcrPipelineStatus("")).toBe(false);
      expect(isOcrPipelineStatus(null)).toBe(false);
      expect(isOcrPipelineStatus(42)).toBe(false);
    });
  });

  describe("isTileCoordinates", () => {
    it("returns true for valid tile coordinates", () => {
      const coords: TileCoordinates = {
        x: 0,
        y: 0,
        width: 4096,
        height: 4096,
        overlapPx: 614,
      };
      expect(isTileCoordinates(coords)).toBe(true);
    });

    it("returns false for missing fields", () => {
      expect(isTileCoordinates({ x: 0, y: 0 })).toBe(false);
      expect(isTileCoordinates({ x: 0, y: 0, width: 100 })).toBe(false);
      expect(isTileCoordinates(null)).toBe(false);
      expect(isTileCoordinates(undefined)).toBe(false);
      expect(isTileCoordinates("not an object")).toBe(false);
    });

    it("returns false when fields are wrong type", () => {
      expect(
        isTileCoordinates({
          x: "0",
          y: 0,
          width: 4096,
          height: 4096,
          overlapPx: 614,
        }),
      ).toBe(false);
    });
  });

  describe("isTileResult", () => {
    const validResult: TileResult = {
      tileId: "tile-001",
      coordinates: { x: 0, y: 0, width: 4096, height: 4096, overlapPx: 614 },
      ocrText: "Hello world",
      confidence: 85,
      wordCount: 2,
      processingTimeMs: 1200,
      status: "completed",
    };

    it("returns true for valid tile result", () => {
      expect(isTileResult(validResult)).toBe(true);
    });

    it("returns false for missing fields", () => {
      const { tileId, ...incomplete } = validResult;
      void tileId;
      expect(isTileResult(incomplete)).toBe(false);
    });

    it("returns false for invalid status", () => {
      expect(isTileResult({ ...validResult, status: "invalid" })).toBe(false);
    });

    it("returns false for non-objects", () => {
      expect(isTileResult(null)).toBe(false);
      expect(isTileResult("string")).toBe(false);
      expect(isTileResult(123)).toBe(false);
    });
  });

  describe("isTiledOcrJob", () => {
    const validJob: TiledOcrJob = {
      jobId: "tocr-001",
      documentId: "DOC-0201",
      documentTitle: "Test Document",
      status: "completed",
      tileSize: 4096,
      overlapPercent: 15,
      totalTiles: 4,
      completedTiles: 4,
      failedTiles: 0,
      tiles: [],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    it("returns true for valid job", () => {
      expect(isTiledOcrJob(validJob)).toBe(true);
    });

    it("returns true for job with null completedAt", () => {
      expect(isTiledOcrJob({ ...validJob, completedAt: null })).toBe(true);
    });

    it("returns false for invalid status", () => {
      expect(isTiledOcrJob({ ...validJob, status: "running" })).toBe(false);
    });

    it("returns false for missing required fields", () => {
      const { jobId, ...incomplete } = validJob;
      void jobId;
      expect(isTiledOcrJob(incomplete)).toBe(false);
    });

    it("returns false for non-objects", () => {
      expect(isTiledOcrJob(null)).toBe(false);
      expect(isTiledOcrJob(undefined)).toBe(false);
      expect(isTiledOcrJob([])).toBe(false);
    });
  });
});

describe("ocrPipelineConfig - defaults validation", () => {
  it("DEFAULT_OCR_PIPELINE_CONFIG matches expected YAML values", () => {
    expect(DEFAULT_OCR_PIPELINE_CONFIG.tile_size).toBe(4096);
    expect(DEFAULT_OCR_PIPELINE_CONFIG.overlap_percent).toBe(15);
    expect(DEFAULT_OCR_PIPELINE_CONFIG.dpi_target).toBe(400);
    expect(DEFAULT_OCR_PIPELINE_CONFIG.min_dimension_for_tiling).toBe(5000);
    expect(DEFAULT_OCR_PIPELINE_CONFIG.max_pages).toBe(100);
    expect(DEFAULT_OCR_PIPELINE_CONFIG.max_file_size_mb).toBe(500);
    expect(DEFAULT_OCR_PIPELINE_CONFIG.max_pixels).toBe(200000000);
    expect(DEFAULT_OCR_PIPELINE_CONFIG.worker_concurrency).toBe(4);
    expect(DEFAULT_OCR_PIPELINE_CONFIG.ocr_timeout_seconds).toBe(300);
    expect(DEFAULT_OCR_PIPELINE_CONFIG.retry_count).toBe(3);
    expect(DEFAULT_OCR_PIPELINE_CONFIG.temp_directory).toBe("/tmp/ocr_tiles");
    expect(DEFAULT_OCR_PIPELINE_CONFIG.cleanup_policy).toBe("on_success");
    expect(DEFAULT_OCR_PIPELINE_CONFIG.fallback_behavior).toBe("skip_tile");
    expect(DEFAULT_OCR_PIPELINE_CONFIG.dedup_threshold).toBe(0.6);
    expect(DEFAULT_OCR_PIPELINE_CONFIG.confidence_threshold).toBe(60);
  });

  it("DEFAULT_OCR_PIPELINE_CONFIG is frozen (immutable)", () => {
    expect(Object.isFrozen(DEFAULT_OCR_PIPELINE_CONFIG)).toBe(true);
  });

  it("getOcrPipelineConfig returns a copy of the defaults", () => {
    const config = getOcrPipelineConfig();
    expect(config).toEqual(DEFAULT_OCR_PIPELINE_CONFIG);
    // Verify it is a copy, not the frozen original
    expect(config).not.toBe(DEFAULT_OCR_PIPELINE_CONFIG);
  });

  it("getOcrPipelineConfig returns a mutable object", () => {
    const config = getOcrPipelineConfig();
    expect(Object.isFrozen(config)).toBe(false);
    // Should be able to modify the copy without error
    config.tile_size = 2048;
    expect(config.tile_size).toBe(2048);
  });
});
