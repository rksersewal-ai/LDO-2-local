/**
 * Orphan File Detector
 *
 * Detects storage files that have no corresponding database record.
 * Uses the content-addressed storage path format to extract file IDs (hashes)
 * and compares them against a set of known/registered file IDs.
 *
 * Usage:
 *   import { OrphanDetector } from "@/lib/storage/orphanFileDetector";
 *
 *   const knownIds = new Set(["abc123...", "def456..."]);
 *   const detector = new OrphanDetector(knownIds);
 *   const result = detector.scanPaths(storagePaths);
 *   console.log(`Found ${result.orphanCount} orphan files`);
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Result of an orphan detection scan */
export interface OrphanDetectionResult {
  /** Paths identified as orphans (no matching database record) */
  orphanPaths: string[];
  /** Total number of paths scanned */
  totalScanned: number;
  /** Number of orphan paths detected */
  orphanCount: number;
  /** ISO 8601 timestamp when detection was performed */
  detectedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Pattern to extract the hash (file ID) from a content-addressed storage path.
 * Matches the final segment of /aa/bb/<64-char-hex-hash>
 */
const HASH_FROM_PATH_PATTERN = /\/[0-9a-f]{2}\/[0-9a-f]{2}\/([0-9a-f]{64})$/;

// ─── Class ────────────────────────────────────────────────────────────────────

/**
 * Detects orphan files in content-addressed storage.
 *
 * An orphan file is one that exists in storage but has no corresponding
 * record in the set of known file IDs (typically from a database).
 */
export class OrphanDetector {
  private readonly knownFileIds: Set<string>;

  /**
   * Create an orphan detector with a set of known (registered) file IDs.
   *
   * @param knownFileIds - Set of file ID strings that are registered in the database
   */
  constructor(knownFileIds: Set<string>) {
    this.knownFileIds = knownFileIds;
  }

  /**
   * Scan an array of storage paths and identify orphans.
   *
   * For each path, extracts the file ID (hash portion) and checks whether
   * it exists in the known file IDs set.
   *
   * @param storagePaths - Array of content-addressed storage paths to scan
   * @returns Detection result with orphan paths and statistics
   */
  scanPaths(storagePaths: string[]): OrphanDetectionResult {
    const orphanPaths: string[] = [];

    for (const path of storagePaths) {
      if (this.isOrphan(path)) {
        orphanPaths.push(path);
      }
    }

    return {
      orphanPaths,
      totalScanned: storagePaths.length,
      orphanCount: orphanPaths.length,
      detectedAt: new Date().toISOString(),
    };
  }

  /**
   * Check if a single storage path is an orphan.
   *
   * Extracts the file ID from the path and checks if it is known.
   * If the path does not match the expected format, it is treated as an orphan.
   *
   * @param path - Content-addressed storage path to check
   * @returns true if the file is an orphan (not in known IDs)
   */
  isOrphan(path: string): boolean {
    const fileId = this.extractFileId(path);

    if (fileId === null) {
      // Path does not match content-addressed format; treat as orphan
      return true;
    }

    return !this.knownFileIds.has(fileId);
  }

  /**
   * Extract the file ID (hash) from a content-addressed storage path.
   *
   * @param path - Storage path in /aa/bb/<hash> format
   * @returns The extracted hash string, or null if format is invalid
   */
  extractFileId(path: string): string | null {
    const match = path.match(HASH_FROM_PATH_PATTERN);
    if (!match) {
      return null;
    }
    return match[1];
  }
}
