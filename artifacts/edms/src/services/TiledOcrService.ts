/**
 * TiledOcrService
 *
 * localStorage-backed mock service for managing tiled OCR pipeline jobs.
 * All operations are gated behind the TILED_OCR feature flag.
 * When the flag is disabled, methods return null or empty arrays.
 */

import { isFeatureEnabled } from "../lib/featureFlags";
import { DEFAULT_OCR_PIPELINE_CONFIG } from "../lib/ocrPipelineConfig";
import type { OcrPipelineConfig } from "../lib/ocrPipelineConfig";
import type { TiledOcrJob, TileResult, OcrPipelineStatus } from "../lib/tiledOcrTypes";

const STORAGE_KEY = "ldo2_tiled_ocr_jobs";

const DEFAULT_MOCK_JOBS: TiledOcrJob[] = [
  {
    jobId: "tocr-001",
    documentId: "DOC-0201",
    documentTitle: "High-Resolution Site Plan A3",
    status: "completed",
    tileSize: 4096,
    overlapPercent: 15,
    totalTiles: 16,
    completedTiles: 16,
    failedTiles: 0,
    tiles: generateMockTiles(16, "completed"),
    startedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 3200 * 1000).toISOString(),
  },
  {
    jobId: "tocr-002",
    documentId: "DOC-0202",
    documentTitle: "Mechanical Assembly Drawing Rev C",
    status: "processing",
    tileSize: 4096,
    overlapPercent: 15,
    totalTiles: 24,
    completedTiles: 14,
    failedTiles: 1,
    tiles: generateMockTiles(24, "processing", 14, 1),
    startedAt: new Date(Date.now() - 600 * 1000).toISOString(),
    completedAt: null,
  },
  {
    jobId: "tocr-003",
    documentId: "DOC-0203",
    documentTitle: "Electrical Schematic P&ID-400",
    status: "queued",
    tileSize: 4096,
    overlapPercent: 15,
    totalTiles: 0,
    completedTiles: 0,
    failedTiles: 0,
    tiles: [],
    startedAt: new Date(Date.now() - 120 * 1000).toISOString(),
    completedAt: null,
  },
  {
    jobId: "tocr-004",
    documentId: "DOC-0204",
    documentTitle: "Structural Beam Detail Sheet 12",
    status: "failed",
    tileSize: 4096,
    overlapPercent: 15,
    totalTiles: 9,
    completedTiles: 5,
    failedTiles: 4,
    tiles: generateMockTiles(9, "failed", 5, 4),
    startedAt: new Date(Date.now() - 1800 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 1700 * 1000).toISOString(),
    errorMessage: "Multiple tile failures exceeded retry threshold",
  },
];

function generateMockTiles(
  count: number,
  jobStatus: string,
  completed: number = 0,
  failed: number = 0,
): TileResult[] {
  const tiles: TileResult[] = [];
  const tileSize = 4096;
  const cols = Math.ceil(Math.sqrt(count));

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    let status: TileResult["status"];
    if (i < completed) {
      status = "completed";
    } else if (i < completed + failed) {
      status = "failed";
    } else if (jobStatus === "completed") {
      status = "completed";
    } else {
      status = "pending";
    }

    tiles.push({
      tileId: `tile-${String(i + 1).padStart(3, "0")}`,
      coordinates: {
        x: col * tileSize,
        y: row * tileSize,
        width: tileSize,
        height: tileSize,
        overlapPx: Math.round(tileSize * 0.15),
      },
      ocrText: status === "completed" ? `OCR text content for tile ${i + 1}` : "",
      confidence: status === "completed" ? 75 + Math.floor(Math.random() * 20) : 0,
      wordCount: status === "completed" ? 50 + Math.floor(Math.random() * 100) : 0,
      processingTimeMs: status === "completed" ? 800 + Math.floor(Math.random() * 1200) : 0,
      status,
    });
  }

  return tiles;
}

function loadJobs(): TiledOcrJob[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const serialized = JSON.stringify(DEFAULT_MOCK_JOBS);
      window.localStorage.setItem(STORAGE_KEY, serialized);
      return JSON.parse(serialized) as TiledOcrJob[];
    }
    return JSON.parse(raw) as TiledOcrJob[];
  } catch {
    const serialized = JSON.stringify(DEFAULT_MOCK_JOBS);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    return JSON.parse(serialized) as TiledOcrJob[];
  }
}

function persistJobs(jobs: TiledOcrJob[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

export const TiledOcrService = {
  /**
   * Get a specific OCR job by ID.
   * Returns null if the feature flag is disabled or job not found.
   */
  getJob(jobId: string): TiledOcrJob | null {
    if (!isFeatureEnabled("TILED_OCR")) return null;
    const jobs = loadJobs();
    return jobs.find((j) => j.jobId === jobId) ?? null;
  },

  /**
   * Get all OCR jobs for a specific document.
   * Returns empty array if the feature flag is disabled.
   */
  getJobsForDocument(documentId: string): TiledOcrJob[] {
    if (!isFeatureEnabled("TILED_OCR")) return [];
    const jobs = loadJobs();
    return jobs.filter((j) => j.documentId === documentId);
  },

  /**
   * Get all OCR jobs.
   * Returns empty array if the feature flag is disabled.
   */
  getAllJobs(): TiledOcrJob[] {
    if (!isFeatureEnabled("TILED_OCR")) return [];
    return loadJobs();
  },

  /**
   * Get the current status of a specific job.
   * Returns null if the feature flag is disabled or job not found.
   */
  getJobStatus(jobId: string): OcrPipelineStatus | null {
    if (!isFeatureEnabled("TILED_OCR")) return null;
    const job = this.getJob(jobId);
    return job?.status ?? null;
  },

  /**
   * Create a new tiled OCR job for a document.
   * Returns null if the feature flag is disabled.
   */
  createJob(
    documentId: string,
    config: Partial<OcrPipelineConfig> = {},
  ): TiledOcrJob | null {
    if (!isFeatureEnabled("TILED_OCR")) return null;

    const mergedConfig = { ...DEFAULT_OCR_PIPELINE_CONFIG, ...config };
    const jobId = `tocr-${Date.now().toString(36)}`;

    const newJob: TiledOcrJob = {
      jobId,
      documentId,
      documentTitle: `Document ${documentId}`,
      status: "queued",
      tileSize: mergedConfig.tile_size,
      overlapPercent: mergedConfig.overlap_percent,
      totalTiles: 0,
      completedTiles: 0,
      failedTiles: 0,
      tiles: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
    };

    const jobs = loadJobs();
    jobs.push(newJob);
    persistJobs(jobs);

    return newJob;
  },

  /**
   * Cancel a running OCR job.
   * Returns the updated job or null if disabled/not found.
   */
  cancelJob(jobId: string): TiledOcrJob | null {
    if (!isFeatureEnabled("TILED_OCR")) return null;

    const jobs = loadJobs();
    const index = jobs.findIndex((j) => j.jobId === jobId);
    if (index === -1) return null;

    const job = jobs[index];
    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
      return job;
    }

    jobs[index] = {
      ...job,
      status: "cancelled",
      completedAt: new Date().toISOString(),
    };
    persistJobs(jobs);

    return jobs[index];
  },
};
