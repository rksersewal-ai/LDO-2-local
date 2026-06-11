/**
 * Backup Verification
 *
 * Tracks backup status and verifies backup integrity for the EDMS system.
 * Stores backup records in localStorage for client-side state management.
 * Supports full, incremental, and differential backup types with
 * verification of checksums, sizes, and restorability.
 *
 * Usage:
 *   import { BackupTracker } from "@/lib/reliability/backupVerification";
 *
 *   const tracker = new BackupTracker();
 *   tracker.recordBackup({ id: "bk-1", type: "full", ... });
 *   const isOverdue = tracker.isOverdue(24);
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Type of backup */
export type BackupType = "full" | "incremental" | "differential";

/** Current status of a backup */
export type BackupStatus = "completed" | "in_progress" | "failed" | "scheduled";

/** A backup record */
export interface BackupRecord {
  /** Unique backup identifier */
  id: string;
  /** Type of backup */
  type: BackupType;
  /** Current status */
  status: BackupStatus;
  /** Timestamp when backup started */
  startedAt: number;
  /** Timestamp when backup completed (if applicable) */
  completedAt?: number;
  /** Size in bytes */
  sizeBytes?: number;
  /** Checksum of the backup data */
  checksum?: string;
  /** Human-readable description */
  description?: string;
}

/** Result of a backup verification */
export interface BackupVerificationResult {
  /** Whether the checksum is valid */
  checksumValid: boolean;
  /** Whether the recorded size matches expected size */
  sizeMatch: boolean;
  /** Whether the backup is restorable */
  restorable: boolean;
  /** Timestamp of verification */
  verifiedAt: number;
  /** Details about any issues */
  details?: string;
}

/** Full backup entry stored in state (record + verification) */
export interface BackupEntry {
  /** The backup record */
  record: BackupRecord;
  /** Latest verification result, if any */
  verification?: BackupVerificationResult;
}

/** Options for the BackupTracker */
export interface BackupTrackerOptions {
  /** localStorage key for storing backup data. Default: "edms_backup_tracker" */
  storageKey?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default localStorage key */
export const DEFAULT_STORAGE_KEY = "edms_backup_tracker";

/** Milliseconds in one hour */
const MS_PER_HOUR = 3_600_000;

// ─── BackupTracker Class ──────────────────────────────────────────────────────

/**
 * Tracks backup records, verification results, and overdue status.
 * Persists state to localStorage.
 */
export class BackupTracker {
  private storageKey: string;

  constructor(options?: BackupTrackerOptions) {
    this.storageKey = options?.storageKey ?? DEFAULT_STORAGE_KEY;
  }

  /**
   * Record a new backup.
   * @param record - The backup record to store
   */
  recordBackup(record: BackupRecord): void {
    const entries = this.loadEntries();
    const existingIndex = entries.findIndex((e) => e.record.id === record.id);

    if (existingIndex >= 0) {
      entries[existingIndex].record = record;
    } else {
      entries.push({ record });
    }

    this.saveEntries(entries);
  }

  /**
   * Verify a backup by id. Uses the stored record to validate integrity.
   * @param id - The backup id to verify
   * @param expectedChecksum - Optional expected checksum to validate against
   * @param expectedSizeBytes - Optional expected size to validate against
   * @returns The verification result, or undefined if backup not found
   */
  verifyBackup(
    id: string,
    expectedChecksum?: string,
    expectedSizeBytes?: number,
  ): BackupVerificationResult | undefined {
    const entries = this.loadEntries();
    const entry = entries.find((e) => e.record.id === id);

    if (!entry) {
      return undefined;
    }

    const record = entry.record;

    // Verify checksum
    const checksumValid = expectedChecksum
      ? record.checksum === expectedChecksum
      : record.checksum !== undefined && record.checksum.length > 0;

    // Verify size
    const sizeMatch = expectedSizeBytes
      ? record.sizeBytes === expectedSizeBytes
      : record.sizeBytes !== undefined && record.sizeBytes > 0;

    // Verify restorability (must be completed with both checksum and size)
    const restorable =
      record.status === "completed" &&
      checksumValid &&
      sizeMatch;

    const result: BackupVerificationResult = {
      checksumValid,
      sizeMatch,
      restorable,
      verifiedAt: Date.now(),
    };

    if (!restorable) {
      const issues: string[] = [];
      if (!checksumValid) issues.push("checksum invalid");
      if (!sizeMatch) issues.push("size mismatch");
      if (record.status !== "completed") issues.push(`status is ${record.status}`);
      result.details = issues.join(", ");
    }

    // Store verification result
    entry.verification = result;
    this.saveEntries(entries);

    return result;
  }

  /**
   * Get the last successfully completed backup.
   * @returns The most recent completed backup entry, or undefined
   */
  getLastSuccessful(): BackupEntry | undefined {
    const entries = this.loadEntries();
    const completed = entries
      .filter((e) => e.record.status === "completed")
      .sort((a, b) => (b.record.completedAt ?? 0) - (a.record.completedAt ?? 0));

    return completed[0] ?? undefined;
  }

  /**
   * Get all backup history entries.
   * @returns Array of all backup entries
   */
  getBackupHistory(): BackupEntry[] {
    return this.loadEntries();
  }

  /**
   * Check if a backup is overdue based on the maximum allowed age.
   * @param maxAgeHours - Maximum acceptable age in hours since last successful backup
   * @returns true if no successful backup exists within the threshold
   */
  isOverdue(maxAgeHours: number): boolean {
    const last = this.getLastSuccessful();
    if (!last) {
      return true;
    }

    const completedAt = last.record.completedAt ?? last.record.startedAt;
    const ageMs = Date.now() - completedAt;
    return ageMs > maxAgeHours * MS_PER_HOUR;
  }

  /**
   * Remove a backup entry by id.
   * @param id - The backup id to remove
   */
  removeBackup(id: string): void {
    const entries = this.loadEntries().filter((e) => e.record.id !== id);
    this.saveEntries(entries);
  }

  /** Clear all backup data */
  clear(): void {
    this.saveEntries([]);
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  /** Load entries from localStorage */
  private loadEntries(): BackupEntry[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      return JSON.parse(raw) as BackupEntry[];
    } catch {
      return [];
    }
  }

  /** Save entries to localStorage */
  private saveEntries(entries: BackupEntry[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(entries));
  }
}
