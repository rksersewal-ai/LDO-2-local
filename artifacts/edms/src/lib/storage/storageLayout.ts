/**
 * Storage Layout
 *
 * Defines the canonical storage directory structure as typed constants.
 * Provides utilities for resolving file paths within storage categories
 * and detecting which category a given path belongs to.
 *
 * Categories: originals, previews, tiles, ocr, temp
 *
 * Usage:
 *   import { getPathForCategory, getCategoryFromPath, DEFAULT_LAYOUT } from "@/lib/storage/storageLayout";
 *
 *   const path = getPathForCategory("originals", "document.pdf");
 *   const category = getCategoryFromPath("/storage/originals/document.pdf");
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Supported storage categories */
export type StorageCategory = "originals" | "previews" | "tiles" | "ocr" | "temp";

/** Configuration for a single storage category */
export interface CategoryConfig {
  /** Base directory path for this category */
  basePath: string;
  /** Number of days to retain files (null = forever) */
  retentionDays: number | null;
  /** Maximum total size in bytes for this category */
  maxSizeBytes: number;
}

/** Complete storage layout mapping categories to their config */
export type StorageLayoutConfig = Record<StorageCategory, CategoryConfig>;

// ─── Constants ────────────────────────────────────────────────────────────────

/** All known storage categories */
const ALL_CATEGORIES: StorageCategory[] = [
  "originals",
  "previews",
  "tiles",
  "ocr",
  "temp",
];

/**
 * Default storage layout configuration.
 *
 * - originals: permanent retention, 100 GB limit
 * - previews: 90-day retention, 20 GB limit
 * - tiles: 180-day retention, 50 GB limit
 * - ocr: permanent retention, 10 GB limit
 * - temp: 7-day retention, 5 GB limit
 */
export const DEFAULT_LAYOUT: Readonly<StorageLayoutConfig> = Object.freeze({
  originals: {
    basePath: "/storage/originals",
    retentionDays: null,
    maxSizeBytes: 100 * 1024 * 1024 * 1024, // 100 GB
  },
  previews: {
    basePath: "/storage/previews",
    retentionDays: 90,
    maxSizeBytes: 20 * 1024 * 1024 * 1024, // 20 GB
  },
  tiles: {
    basePath: "/storage/tiles",
    retentionDays: 180,
    maxSizeBytes: 50 * 1024 * 1024 * 1024, // 50 GB
  },
  ocr: {
    basePath: "/storage/ocr",
    retentionDays: null,
    maxSizeBytes: 10 * 1024 * 1024 * 1024, // 10 GB
  },
  temp: {
    basePath: "/storage/temp",
    retentionDays: 7,
    maxSizeBytes: 5 * 1024 * 1024 * 1024, // 5 GB
  },
});

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Get the full file path for a given category and filename.
 *
 * @param category - The storage category
 * @param filename - The filename to place in that category
 * @returns Full path combining the category base path and filename
 */
export function getPathForCategory(category: StorageCategory, filename: string): string {
  const config = DEFAULT_LAYOUT[category];
  return `${config.basePath}/${filename}`;
}

/**
 * Determine which storage category a given file path belongs to.
 * Returns null if the path does not match any known category.
 *
 * @param path - The file path to analyze
 * @returns The matching StorageCategory or null
 */
export function getCategoryFromPath(path: string): StorageCategory | null {
  for (const category of ALL_CATEGORIES) {
    const config = DEFAULT_LAYOUT[category];
    if (path.startsWith(config.basePath + "/") || path === config.basePath) {
      return category;
    }
  }
  return null;
}

/**
 * Get all known storage categories.
 *
 * @returns Array of all StorageCategory values
 */
export function getAllCategories(): StorageCategory[] {
  return [...ALL_CATEGORIES];
}
