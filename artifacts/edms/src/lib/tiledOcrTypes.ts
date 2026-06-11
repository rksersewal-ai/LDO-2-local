/**
 * Tiled OCR Pipeline Types
 *
 * Type definitions for the tiled OCR processing pipeline, including
 * tile coordinates, individual tile results, job tracking, and
 * merge/dedup strategy interfaces.
 */

/** Coordinates and dimensions for a single tile within a page image */
export interface TileCoordinates {
  /** X offset in pixels from the left edge of the source image */
  x: number;
  /** Y offset in pixels from the top edge of the source image */
  y: number;
  /** Width of the tile in pixels */
  width: number;
  /** Height of the tile in pixels */
  height: number;
  /** Overlap in pixels applied to this tile's edges */
  overlapPx: number;
}

/** Processing status for a single tile */
export type TileStatus = "pending" | "processing" | "completed" | "failed" | "skipped";

/** Result of OCR processing for a single tile */
export interface TileResult {
  /** Unique identifier for this tile */
  tileId: string;
  /** Position and size of this tile in the source image */
  coordinates: TileCoordinates;
  /** Extracted text content from OCR */
  ocrText: string;
  /** OCR confidence score (0-100) */
  confidence: number;
  /** Number of words detected */
  wordCount: number;
  /** Time taken to process this tile in milliseconds */
  processingTimeMs: number;
  /** Current processing status */
  status: TileStatus;
}

/** Pipeline status representing the current phase of an OCR job */
export type OcrPipelineStatus =
  | "queued"
  | "tiling"
  | "processing"
  | "merging"
  | "deduplicating"
  | "completed"
  | "failed"
  | "cancelled";

/** Full job record for a tiled OCR processing run */
export interface TiledOcrJob {
  /** Unique job identifier */
  jobId: string;
  /** ID of the document being processed */
  documentId: string;
  /** Display title of the document */
  documentTitle: string;
  /** Current pipeline status */
  status: OcrPipelineStatus;
  /** Tile size in pixels used for this job */
  tileSize: number;
  /** Overlap percentage between tiles */
  overlapPercent: number;
  /** Total number of tiles generated */
  totalTiles: number;
  /** Number of tiles successfully completed */
  completedTiles: number;
  /** Number of tiles that failed processing */
  failedTiles: number;
  /** Individual tile results */
  tiles: TileResult[];
  /** ISO timestamp when job processing started */
  startedAt: string;
  /** ISO timestamp when job processing completed (null if still running) */
  completedAt: string | null;
  /** Error message if the job failed */
  errorMessage?: string;
}

/** Strategy interface for merging tile results and deduplicating overlaps */
export interface MergeStrategy {
  /** Merge individual tile OCR results into a single continuous text */
  mergeTileResults(tiles: TileResult[]): string;
  /** Remove duplicate text from overlapping tile regions */
  deduplicateOverlaps(tiles: TileResult[], threshold: number): TileResult[];
}

// --- Type Guards ---

/** Type guard to check if a value is a valid TileStatus */
export function isTileStatus(value: unknown): value is TileStatus {
  return (
    typeof value === "string" &&
    ["pending", "processing", "completed", "failed", "skipped"].includes(value)
  );
}

/** Type guard to check if a value is a valid OcrPipelineStatus */
export function isOcrPipelineStatus(value: unknown): value is OcrPipelineStatus {
  return (
    typeof value === "string" &&
    ["queued", "tiling", "processing", "merging", "deduplicating", "completed", "failed", "cancelled"].includes(value)
  );
}

/** Type guard to check if an object is a valid TileCoordinates */
export function isTileCoordinates(value: unknown): value is TileCoordinates {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.x === "number" &&
    typeof obj.y === "number" &&
    typeof obj.width === "number" &&
    typeof obj.height === "number" &&
    typeof obj.overlapPx === "number"
  );
}

/** Type guard to check if an object is a valid TileResult */
export function isTileResult(value: unknown): value is TileResult {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.tileId === "string" &&
    isTileCoordinates(obj.coordinates) &&
    typeof obj.ocrText === "string" &&
    typeof obj.confidence === "number" &&
    typeof obj.wordCount === "number" &&
    typeof obj.processingTimeMs === "number" &&
    isTileStatus(obj.status)
  );
}

/** Type guard to check if an object is a valid TiledOcrJob */
export function isTiledOcrJob(value: unknown): value is TiledOcrJob {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.jobId === "string" &&
    typeof obj.documentId === "string" &&
    typeof obj.documentTitle === "string" &&
    isOcrPipelineStatus(obj.status) &&
    typeof obj.tileSize === "number" &&
    typeof obj.overlapPercent === "number" &&
    typeof obj.totalTiles === "number" &&
    typeof obj.completedTiles === "number" &&
    typeof obj.failedTiles === "number" &&
    Array.isArray(obj.tiles) &&
    typeof obj.startedAt === "string" &&
    (obj.completedAt === null || typeof obj.completedAt === "string")
  );
}
