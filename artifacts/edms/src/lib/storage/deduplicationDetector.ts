/**
 * Deduplication Detector
 *
 * Detects duplicate files by comparing content hashes. Maintains an
 * in-memory index mapping hashes to file IDs, enabling fast duplicate
 * lookup without full file comparison.
 *
 * Usage:
 *   import { DeduplicationIndex } from "@/lib/storage/deduplicationDetector";
 *
 *   const index = new DeduplicationIndex();
 *   index.addFile("file-1", "abc123...");
 *   const existingId = index.findDuplicate("abc123..."); // => "file-1"
 *   const groups = index.getDuplicateGroups();
 *   const stats = index.getStats();
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Represents a detected duplicate file match */
export interface DuplicateMatch {
  /** ID of the original (first seen) file */
  originalId: string;
  /** ID of the duplicate file */
  duplicateId: string;
  /** Shared content hash */
  hash: string;
  /** ISO 8601 timestamp when the duplicate was detected */
  detectedAt: string;
}

/** Statistics about the deduplication index */
export interface DeduplicationStats {
  /** Total number of files tracked */
  totalFiles: number;
  /** Number of unique content hashes */
  uniqueFiles: number;
  /** Number of duplicate files (totalFiles - uniqueFiles) */
  duplicateCount: number;
  /** Estimated bytes saved by deduplication, based on provided size map */
  potentialSpaceSaved: number;
}

// ─── Class ────────────────────────────────────────────────────────────────────

/**
 * In-memory deduplication index that tracks file hashes
 * and identifies duplicates efficiently.
 */
export class DeduplicationIndex {
  /** Map from hash to array of file IDs sharing that hash */
  private readonly hashToIds: Map<string, string[]> = new Map();
  /** Map from file ID to its hash for reverse lookup */
  private readonly idToHash: Map<string, string> = new Map();

  /**
   * Add a file to the deduplication index.
   * If the hash already exists, the file is recorded as a duplicate.
   *
   * @param id - Unique file identifier
   * @param hash - Content hash of the file
   * @returns A DuplicateMatch if this file is a duplicate, or null if unique
   */
  addFile(id: string, hash: string): DuplicateMatch | null {
    this.idToHash.set(id, hash);

    const existing = this.hashToIds.get(hash);

    if (existing) {
      existing.push(id);
      return {
        originalId: existing[0],
        duplicateId: id,
        hash,
        detectedAt: new Date().toISOString(),
      };
    }

    this.hashToIds.set(hash, [id]);
    return null;
  }

  /**
   * Check if a hash already exists in the index.
   * Returns the ID of the first file with that hash, or null if not found.
   *
   * @param hash - Content hash to look up
   * @returns The ID of the existing file, or null
   */
  findDuplicate(hash: string): string | null {
    const ids = this.hashToIds.get(hash);
    if (ids && ids.length > 0) {
      return ids[0];
    }
    return null;
  }

  /**
   * Get all groups of files sharing the same content hash.
   * Only includes groups with more than one file (actual duplicates).
   *
   * @returns Map from hash to array of file IDs
   */
  getDuplicateGroups(): Map<string, string[]> {
    const groups = new Map<string, string[]>();

    for (const [hash, ids] of this.hashToIds) {
      if (ids.length > 1) {
        groups.set(hash, [...ids]);
      }
    }

    return groups;
  }

  /**
   * Get statistics about the deduplication index.
   *
   * @param sizeMap - Optional map from file ID to size in bytes for space savings calculation
   * @returns Deduplication statistics
   */
  getStats(sizeMap?: Map<string, number>): DeduplicationStats {
    const totalFiles = this.idToHash.size;
    const uniqueFiles = this.hashToIds.size;
    const duplicateCount = totalFiles - uniqueFiles;

    let potentialSpaceSaved = 0;

    if (sizeMap) {
      for (const [, ids] of this.hashToIds) {
        if (ids.length > 1) {
          // Space saved = size of each duplicate (all but the first)
          for (let i = 1; i < ids.length; i++) {
            const size = sizeMap.get(ids[i]);
            if (size !== undefined) {
              potentialSpaceSaved += size;
            }
          }
        }
      }
    }

    return {
      totalFiles,
      uniqueFiles,
      duplicateCount,
      potentialSpaceSaved,
    };
  }

  /**
   * Remove a file from the deduplication index.
   *
   * @param id - File ID to remove
   */
  removeFile(id: string): void {
    const hash = this.idToHash.get(id);
    if (!hash) return;

    this.idToHash.delete(id);

    const ids = this.hashToIds.get(hash);
    if (ids) {
      const index = ids.indexOf(id);
      if (index !== -1) {
        ids.splice(index, 1);
      }
      if (ids.length === 0) {
        this.hashToIds.delete(hash);
      }
    }
  }

  /**
   * Clear the entire index.
   */
  clear(): void {
    this.hashToIds.clear();
    this.idToHash.clear();
  }
}
