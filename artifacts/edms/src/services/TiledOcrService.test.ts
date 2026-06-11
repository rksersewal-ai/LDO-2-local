import { describe, expect, it, beforeEach, vi } from "vitest";
import { TiledOcrService } from "./TiledOcrService";

// Mock the feature flags module
vi.mock("../lib/featureFlags", () => ({
  isFeatureEnabled: vi.fn(),
}));

import { isFeatureEnabled } from "../lib/featureFlags";
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled);

describe("TiledOcrService", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockIsFeatureEnabled.mockReturnValue(true);
  });

  describe("feature flag gating", () => {
    beforeEach(() => {
      mockIsFeatureEnabled.mockReturnValue(false);
    });

    it("getAllJobs returns empty array when TILED_OCR is disabled", () => {
      const result = TiledOcrService.getAllJobs();
      expect(result).toEqual([]);
    });

    it("getJob returns null when TILED_OCR is disabled", () => {
      const result = TiledOcrService.getJob("tocr-001");
      expect(result).toBeNull();
    });

    it("getJobsForDocument returns empty array when TILED_OCR is disabled", () => {
      const result = TiledOcrService.getJobsForDocument("DOC-0201");
      expect(result).toEqual([]);
    });

    it("getJobStatus returns null when TILED_OCR is disabled", () => {
      const result = TiledOcrService.getJobStatus("tocr-001");
      expect(result).toBeNull();
    });

    it("createJob returns null when TILED_OCR is disabled", () => {
      const result = TiledOcrService.createJob("DOC-9999");
      expect(result).toBeNull();
    });

    it("cancelJob returns null when TILED_OCR is disabled", () => {
      const result = TiledOcrService.cancelJob("tocr-001");
      expect(result).toBeNull();
    });
  });

  describe("getAllJobs", () => {
    it("returns mock jobs when feature is enabled", () => {
      const jobs = TiledOcrService.getAllJobs();
      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs.length).toBe(4);
    });

    it("initializes localStorage with default mock data", () => {
      TiledOcrService.getAllJobs();
      const stored = window.localStorage.getItem("ldo2_tiled_ocr_jobs");
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(4);
    });
  });

  describe("getJob", () => {
    it("returns a specific job by ID", () => {
      const job = TiledOcrService.getJob("tocr-001");
      expect(job).not.toBeNull();
      expect(job!.jobId).toBe("tocr-001");
      expect(job!.documentId).toBe("DOC-0201");
      expect(job!.status).toBe("completed");
    });

    it("returns null for non-existent job", () => {
      const job = TiledOcrService.getJob("non-existent");
      expect(job).toBeNull();
    });
  });

  describe("getJobsForDocument", () => {
    it("returns jobs for a specific document", () => {
      const jobs = TiledOcrService.getJobsForDocument("DOC-0201");
      expect(jobs.length).toBe(1);
      expect(jobs[0].documentId).toBe("DOC-0201");
    });

    it("returns empty array for document with no jobs", () => {
      const jobs = TiledOcrService.getJobsForDocument("DOC-9999");
      expect(jobs).toEqual([]);
    });
  });

  describe("getJobStatus", () => {
    it("returns status for an existing job", () => {
      const status = TiledOcrService.getJobStatus("tocr-001");
      expect(status).toBe("completed");
    });

    it("returns null for non-existent job", () => {
      const status = TiledOcrService.getJobStatus("non-existent");
      expect(status).toBeNull();
    });
  });

  describe("createJob", () => {
    it("creates a new job with default config", () => {
      const job = TiledOcrService.createJob("DOC-NEW-001");
      expect(job).not.toBeNull();
      expect(job!.documentId).toBe("DOC-NEW-001");
      expect(job!.status).toBe("queued");
      expect(job!.tileSize).toBe(4096);
      expect(job!.overlapPercent).toBe(15);
      expect(job!.totalTiles).toBe(0);
      expect(job!.completedTiles).toBe(0);
      expect(job!.failedTiles).toBe(0);
      expect(job!.tiles).toEqual([]);
      expect(job!.completedAt).toBeNull();
    });

    it("creates a new job with custom config", () => {
      const job = TiledOcrService.createJob("DOC-NEW-002", {
        tile_size: 2048,
        overlap_percent: 20,
      });
      expect(job).not.toBeNull();
      expect(job!.tileSize).toBe(2048);
      expect(job!.overlapPercent).toBe(20);
    });

    it("persists the new job to localStorage", () => {
      TiledOcrService.createJob("DOC-NEW-003");
      const allJobs = TiledOcrService.getAllJobs();
      const newJob = allJobs.find((j) => j.documentId === "DOC-NEW-003");
      expect(newJob).toBeDefined();
    });
  });

  describe("cancelJob", () => {
    it("cancels a running job", () => {
      const cancelled = TiledOcrService.cancelJob("tocr-002");
      expect(cancelled).not.toBeNull();
      expect(cancelled!.status).toBe("cancelled");
      expect(cancelled!.completedAt).not.toBeNull();
    });

    it("does not change status of already completed jobs", () => {
      const result = TiledOcrService.cancelJob("tocr-001");
      expect(result).not.toBeNull();
      expect(result!.status).toBe("completed");
    });

    it("does not change status of already failed jobs", () => {
      const result = TiledOcrService.cancelJob("tocr-004");
      expect(result).not.toBeNull();
      expect(result!.status).toBe("failed");
    });

    it("returns null for non-existent job", () => {
      const result = TiledOcrService.cancelJob("non-existent");
      expect(result).toBeNull();
    });
  });

  describe("mock data shape", () => {
    beforeEach(() => {
      window.localStorage.clear();
    });

    it("completed job has all tiles completed", () => {
      const job = TiledOcrService.getJob("tocr-001");
      expect(job).not.toBeNull();
      expect(job!.completedTiles).toBe(job!.totalTiles);
      expect(job!.failedTiles).toBe(0);
      expect(job!.completedAt).not.toBeNull();
    });

    it("processing job has some tiles completed", () => {
      const job = TiledOcrService.getJob("tocr-002");
      expect(job).not.toBeNull();
      expect(job!.status).toBe("processing");
      expect(job!.completedTiles).toBeGreaterThan(0);
      expect(job!.completedTiles).toBeLessThan(job!.totalTiles);
      expect(job!.completedAt).toBeNull();
    });

    it("queued job has zero tiles", () => {
      const job = TiledOcrService.getJob("tocr-003");
      expect(job).not.toBeNull();
      expect(job!.status).toBe("queued");
      expect(job!.totalTiles).toBe(0);
      expect(job!.tiles).toEqual([]);
    });

    it("failed job has error message", () => {
      const job = TiledOcrService.getJob("tocr-004");
      expect(job).not.toBeNull();
      expect(job!.status).toBe("failed");
      expect(job!.errorMessage).toBeTruthy();
      expect(job!.failedTiles).toBeGreaterThan(0);
    });

    it("tile results have valid coordinates", () => {
      const job = TiledOcrService.getJob("tocr-001");
      expect(job).not.toBeNull();
      job!.tiles.forEach((tile) => {
        expect(tile.coordinates.width).toBe(4096);
        expect(tile.coordinates.height).toBe(4096);
        expect(tile.coordinates.overlapPx).toBeGreaterThan(0);
        expect(tile.coordinates.x).toBeGreaterThanOrEqual(0);
        expect(tile.coordinates.y).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
