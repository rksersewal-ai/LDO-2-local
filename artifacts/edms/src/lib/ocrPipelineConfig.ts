/**
 * OCR Pipeline Configuration
 *
 * Defines the configuration interface for the tiled OCR pipeline.
 * Since the frontend cannot read YAML at runtime, this module provides
 * compiled-in defaults that mirror the values from config/ocr_pipeline.yaml.
 * If the YAML configuration changes, these defaults must be updated manually.
 */

export interface OcrPipelineConfig {
  /** Tile size in pixels (width and height of each tile) */
  tile_size: number;
  /** Overlap percentage between adjacent tiles (0-100) */
  overlap_percent: number;
  /** Target DPI for image preprocessing */
  dpi_target: number;
  /** Minimum image dimension (px) before tiling is applied */
  min_dimension_for_tiling: number;
  /** Maximum pages to process per document */
  max_pages: number;
  /** Maximum file size in megabytes */
  max_file_size_mb: number;
  /** Maximum total pixels (width x height) for a single page */
  max_pixels: number;
  /** Number of concurrent OCR workers */
  worker_concurrency: number;
  /** Timeout in seconds for a single OCR operation */
  ocr_timeout_seconds: number;
  /** Number of retries for failed tile OCR operations */
  retry_count: number;
  /** Directory for storing temporary tile files */
  temp_directory: string;
  /** Cleanup policy for temporary files: 'on_success' | 'always' | 'never' */
  cleanup_policy: string;
  /** Behavior when a tile fails: 'skip_tile' | 'abort_job' | 'retry_only' */
  fallback_behavior: string;
  /** Threshold for deduplication of overlapping text (0-1) */
  dedup_threshold: number;
  /** Minimum confidence score (0-100) to accept OCR results */
  confidence_threshold: number;
}

/**
 * Default OCR pipeline configuration.
 * Values match config/ocr_pipeline.yaml.
 */
export const DEFAULT_OCR_PIPELINE_CONFIG: Readonly<OcrPipelineConfig> = Object.freeze({
  tile_size: 4096,
  overlap_percent: 15,
  dpi_target: 400,
  min_dimension_for_tiling: 5000,
  max_pages: 100,
  max_file_size_mb: 500,
  max_pixels: 200000000,
  worker_concurrency: 4,
  ocr_timeout_seconds: 300,
  retry_count: 3,
  temp_directory: "/tmp/ocr_tiles",
  cleanup_policy: "on_success",
  fallback_behavior: "skip_tile",
  dedup_threshold: 0.6,
  confidence_threshold: 60,
});

/**
 * Returns the OCR pipeline configuration.
 *
 * In the frontend context, this always returns the compiled-in defaults since
 * the browser cannot read the YAML config file at runtime. The backend service
 * reads config/ocr_pipeline.yaml directly.
 */
export function getOcrPipelineConfig(): OcrPipelineConfig {
  return { ...DEFAULT_OCR_PIPELINE_CONFIG };
}
