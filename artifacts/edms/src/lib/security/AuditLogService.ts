/**
 * Audit Log Service
 *
 * Provides an immutable, append-only audit log with hash chain integrity
 * for tracking document operations. Each entry is cryptographically linked
 * to its predecessor via a deterministic hash, enabling tamper detection.
 *
 * Gated behind the AUDIT_HASH_CHAIN feature flag.
 * Storage: localStorage (serialized JSON).
 *
 * Usage:
 *   import { AuditLogService } from "@/lib/security/AuditLogService";
 *
 *   const auditLog = new AuditLogService();
 *   auditLog.logOperation({ userId: "user-1", operation: "view", documentId: "doc-1" });
 *   const trail = auditLog.getAuditTrail();
 *   const isValid = auditLog.verifyChainIntegrity();
 */

import { isFeatureEnabled } from "../featureFlags";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Document operations tracked by the audit log */
export type AuditOperation =
  | "view"
  | "download"
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "reject";

/** A single immutable audit log entry */
export interface AuditLogEntry {
  /** Unique identifier for this entry */
  id: string;
  /** ISO 8601 timestamp when the operation occurred */
  timestamp: string;
  /** ID of the user who performed the operation */
  userId: string;
  /** The operation that was performed */
  operation: AuditOperation;
  /** ID of the document affected */
  documentId: string;
  /** Hash of the previous entry (empty string for genesis entry) */
  previousHash: string;
  /** Hash of this entry's content combined with previousHash */
  currentHash: string;
}

/** Parameters for logging an operation */
export interface LogOperationParams {
  /** ID of the user performing the operation */
  userId: string;
  /** The operation being performed */
  operation: AuditOperation;
  /** ID of the document being operated on */
  documentId: string;
}

/** Configuration for the AuditLogService */
export interface AuditLogConfig {
  /** localStorage key for persisting entries. Default: "edms_audit_log" */
  storageKey?: string;
  /** Maximum number of entries to retain. Default: 10000 */
  maxEntries?: number;
}

/** Result of a chain integrity verification */
export interface ChainVerificationResult {
  /** Whether the entire chain is valid */
  valid: boolean;
  /** Total entries checked */
  entriesChecked: number;
  /** Index of the first invalid entry, or -1 if all valid */
  firstInvalidIndex: number;
  /** Description of the integrity issue, if any */
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_STORAGE_KEY = "edms_audit_log";
const DEFAULT_MAX_ENTRIES = 10000;
const GENESIS_HASH = "";

// ─── Hash Function ────────────────────────────────────────────────────────────

/**
 * Deterministic hash function using a simple but effective string hashing algorithm.
 * Uses FNV-1a variant for consistent, synchronous hashing without Web Crypto dependency.
 *
 * @param input - The string to hash
 * @returns A hexadecimal hash string
 */
export function deterministicHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const combined = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return combined.toString(16).padStart(16, "0");
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Immutable append-only audit log with hash chain integrity.
 *
 * All operations are gated behind the AUDIT_HASH_CHAIN feature flag.
 * When the flag is disabled, methods return safe defaults (empty arrays, true for verification).
 */
export class AuditLogService {
  private readonly storageKey: string;
  private readonly maxEntries: number;

  constructor(config?: AuditLogConfig) {
    this.storageKey = config?.storageKey ?? DEFAULT_STORAGE_KEY;
    this.maxEntries = config?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  /**
   * Log a document operation. Creates a new entry linked to the previous entry's hash.
   *
   * @param params - The operation details to log
   * @returns The created AuditLogEntry, or null if feature flag is disabled
   */
  logOperation(params: LogOperationParams): AuditLogEntry | null {
    if (!isFeatureEnabled("AUDIT_HASH_CHAIN")) {
      return null;
    }

    const entries = this.loadEntries();
    const previousEntry = entries[entries.length - 1];
    const previousHash = previousEntry?.currentHash ?? GENESIS_HASH;

    const id = this.generateId();
    const timestamp = new Date().toISOString();

    const contentToHash = `${id}|${timestamp}|${params.userId}|${params.operation}|${params.documentId}|${previousHash}`;
    const currentHash = deterministicHash(contentToHash);

    const entry: AuditLogEntry = {
      id,
      timestamp,
      userId: params.userId,
      operation: params.operation,
      documentId: params.documentId,
      previousHash,
      currentHash,
    };

    entries.push(entry);

    // Enforce max entries limit (remove oldest)
    if (entries.length > this.maxEntries) {
      entries.splice(0, entries.length - this.maxEntries);
    }

    this.saveEntries(entries);
    return entry;
  }

  /**
   * Get the full audit trail in chronological order.
   *
   * @returns Array of all audit log entries
   */
  getAuditTrail(): AuditLogEntry[] {
    if (!isFeatureEnabled("AUDIT_HASH_CHAIN")) {
      return [];
    }
    return this.loadEntries();
  }

  /**
   * Verify the integrity of the entire hash chain.
   * Checks that each entry's previousHash matches the preceding entry's currentHash,
   * and that each entry's currentHash is correctly computed.
   *
   * @returns Verification result with details about any integrity issues
   */
  verifyChainIntegrity(): ChainVerificationResult {
    if (!isFeatureEnabled("AUDIT_HASH_CHAIN")) {
      return { valid: true, entriesChecked: 0, firstInvalidIndex: -1 };
    }

    const entries = this.loadEntries();

    if (entries.length === 0) {
      return { valid: true, entriesChecked: 0, firstInvalidIndex: -1 };
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const expectedPreviousHash = i === 0 ? GENESIS_HASH : entries[i - 1].currentHash;

      // Check previous hash linkage
      if (entry.previousHash !== expectedPreviousHash) {
        return {
          valid: false,
          entriesChecked: i + 1,
          firstInvalidIndex: i,
          error: `Entry ${i} has invalid previousHash. Expected "${expectedPreviousHash}", got "${entry.previousHash}"`,
        };
      }

      // Verify current hash
      const contentToHash = `${entry.id}|${entry.timestamp}|${entry.userId}|${entry.operation}|${entry.documentId}|${entry.previousHash}`;
      const expectedHash = deterministicHash(contentToHash);

      if (entry.currentHash !== expectedHash) {
        return {
          valid: false,
          entriesChecked: i + 1,
          firstInvalidIndex: i,
          error: `Entry ${i} has invalid currentHash. Expected "${expectedHash}", got "${entry.currentHash}"`,
        };
      }
    }

    return { valid: true, entriesChecked: entries.length, firstInvalidIndex: -1 };
  }

  /**
   * Get all audit entries for a specific document.
   *
   * @param documentId - The document ID to filter by
   * @returns Array of entries for the specified document
   */
  getEntriesByDocument(documentId: string): AuditLogEntry[] {
    if (!isFeatureEnabled("AUDIT_HASH_CHAIN")) {
      return [];
    }
    return this.loadEntries().filter((entry) => entry.documentId === documentId);
  }

  /**
   * Get all audit entries for a specific user.
   *
   * @param userId - The user ID to filter by
   * @returns Array of entries for the specified user
   */
  getEntriesByUser(userId: string): AuditLogEntry[] {
    if (!isFeatureEnabled("AUDIT_HASH_CHAIN")) {
      return [];
    }
    return this.loadEntries().filter((entry) => entry.userId === userId);
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  private loadEntries(): AuditLogEntry[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      return JSON.parse(raw) as AuditLogEntry[];
    } catch {
      return [];
    }
  }

  private saveEntries(entries: AuditLogEntry[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(entries));
  }

  private generateId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
