/**
 * Storage Architecture
 *
 * Phase 12 storage utilities for the EDMS system.
 * Provides content-addressed storage, storage layout definitions,
 * deduplication detection, tier classification, orphan detection,
 * and usage forecasting.
 */

export {
  generateStoragePath,
  parseStoragePath,
  validateHash,
  hashContent,
  type ParsedStoragePath,
} from "./contentAddressedStorage";

export {
  getPathForCategory,
  getCategoryFromPath,
  getAllCategories,
  DEFAULT_LAYOUT,
  type StorageCategory,
  type CategoryConfig,
  type StorageLayoutConfig,
} from "./storageLayout";

export {
  DeduplicationIndex,
  type DuplicateMatch,
  type DeduplicationStats,
} from "./deduplicationDetector";

export {
  TierPolicy,
  getDefaultRules,
  type StorageTier,
  type FileMetadata,
  type TierRule,
} from "./storageTierPolicy";

export {
  OrphanDetector,
  type OrphanDetectionResult,
} from "./orphanFileDetector";

export {
  StorageUsageCalculator,
  type UsageEntry,
  type ForecastResult,
} from "./storageUsageCalculator";
