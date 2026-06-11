/**
 * Dead Letter Queue (DLQ)
 *
 * localStorage-backed dead letter queue for failed background jobs.
 * Provides visibility into failed operations for the admin dashboard.
 *
 * Aligns with AdminMetricsService.FailedJob interface:
 *   { id, documentId, filename, failedAt, errorReason, retryCount }
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeadLetterEntry {
  /** Unique entry ID */
  id: string;
  /** Associated document ID */
  documentId: string;
  /** Original filename */
  filename: string;
  /** ISO timestamp when the job failed */
  failedAt: string;
  /** Human-readable error reason */
  errorReason: string;
  /** Number of retry attempts before entering DLQ */
  retryCount: number;
  /** Optional metadata for debugging */
  metadata?: Record<string, unknown>;
}

export interface DLQConfig {
  /** localStorage key for the DLQ data. Default: "ldo2_dead_letter_queue" */
  storageKey?: string;
  /** Maximum entries to keep in the queue. Default: 1000 */
  maxEntries?: number;
}

export interface DLQStats {
  /** Total entries in the queue */
  totalEntries: number;
  /** Entries added in the last 24 hours */
  last24Hours: number;
  /** Entries added in the last hour */
  lastHour: number;
  /** Most common error reason */
  topErrorReason: string | null;
  /** Oldest entry timestamp */
  oldestEntry: string | null;
  /** Newest entry timestamp */
  newestEntry: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_STORAGE_KEY = "ldo2_dead_letter_queue";
const DEFAULT_MAX_ENTRIES = 1000;

// ─── DLQ Class ────────────────────────────────────────────────────────────────

/**
 * Dead Letter Queue implementation backed by localStorage.
 *
 * Usage:
 *   const dlq = new DeadLetterQueue();
 *   dlq.enqueue({ id: "dlq-001", documentId: "DOC-042", ... });
 *   const stats = dlq.getStats();
 */
export class DeadLetterQueue {
  private readonly storageKey: string;
  private readonly maxEntries: number;

  constructor(config?: DLQConfig) {
    this.storageKey = config?.storageKey ?? DEFAULT_STORAGE_KEY;
    this.maxEntries = config?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  /**
   * Add a failed job entry to the dead letter queue.
   * If the queue is at capacity, the oldest entry is removed.
   *
   * @param entry - The dead letter entry to enqueue
   */
  enqueue(entry: DeadLetterEntry): void {
    const entries = this.loadEntries();
    entries.push(entry);

    // Enforce max entries (remove oldest first)
    while (entries.length > this.maxEntries) {
      entries.shift();
    }

    this.saveEntries(entries);
  }

  /**
   * Peek at the most recent entries without removing them.
   *
   * @param count - Number of entries to peek at (default: 10)
   * @returns Array of entries, newest first
   */
  peek(count: number = 10): DeadLetterEntry[] {
    const entries = this.loadEntries();
    return entries.slice(-count).reverse();
  }

  /**
   * Remove and return an entry from the queue by ID.
   *
   * @param id - The ID of the entry to dequeue
   * @returns The removed entry or undefined if not found
   */
  dequeue(id: string): DeadLetterEntry | undefined {
    const entries = this.loadEntries();
    const index = entries.findIndex((e) => e.id === id);
    if (index === -1) return undefined;

    const [removed] = entries.splice(index, 1);
    this.saveEntries(entries);
    return removed;
  }

  /**
   * Get statistics about the dead letter queue.
   *
   * @returns DLQStats with entry counts and error analysis
   */
  getStats(): DLQStats {
    const entries = this.loadEntries();
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const lastHour = entries.filter(
      (e) => new Date(e.failedAt).getTime() > oneHourAgo,
    ).length;
    const last24Hours = entries.filter(
      (e) => new Date(e.failedAt).getTime() > oneDayAgo,
    ).length;

    // Find most common error reason
    const errorCounts = new Map<string, number>();
    for (const entry of entries) {
      const count = errorCounts.get(entry.errorReason) ?? 0;
      errorCounts.set(entry.errorReason, count + 1);
    }
    let topErrorReason: string | null = null;
    let maxCount = 0;
    for (const [reason, count] of errorCounts) {
      if (count > maxCount) {
        topErrorReason = reason;
        maxCount = count;
      }
    }

    return {
      totalEntries: entries.length,
      last24Hours,
      lastHour,
      topErrorReason,
      oldestEntry: entries.length > 0 ? entries[0].failedAt : null,
      newestEntry: entries.length > 0 ? entries[entries.length - 1].failedAt : null,
    };
  }

  /**
   * Remove all entries older than the specified date.
   *
   * @param date - Remove entries with failedAt before this date
   * @returns Number of entries removed
   */
  purgeOlderThan(date: Date): number {
    const entries = this.loadEntries();
    const cutoff = date.getTime();
    const remaining = entries.filter(
      (e) => new Date(e.failedAt).getTime() >= cutoff,
    );
    const purged = entries.length - remaining.length;
    this.saveEntries(remaining);
    return purged;
  }

  /**
   * Mark an entry for retry by removing it from the DLQ.
   * Returns the entry so it can be resubmitted to the processing queue.
   *
   * @param id - The ID of the entry to retry
   * @returns The entry to retry, or undefined if not found
   */
  retryEntry(id: string): DeadLetterEntry | undefined {
    return this.dequeue(id);
  }

  /**
   * Get all entries currently in the queue.
   *
   * @returns All DLQ entries
   */
  getAll(): DeadLetterEntry[] {
    return this.loadEntries();
  }

  /**
   * Clear all entries from the queue.
   */
  clear(): void {
    this.saveEntries([]);
  }

  // ─── Private Helpers ──────────────────────────────────────────────────

  private loadEntries(): DeadLetterEntry[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      return JSON.parse(raw) as DeadLetterEntry[];
    } catch {
      return [];
    }
  }

  private saveEntries(entries: DeadLetterEntry[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(entries));
    } catch {
      // localStorage might be full or unavailable - fail silently
    }
  }
}
