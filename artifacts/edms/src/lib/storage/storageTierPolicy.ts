/**
 * Storage Tier Policy
 *
 * Rules engine for classifying files into hot/warm/cold/archive storage tiers
 * based on access patterns and file metadata. The highest priority matching
 * rule determines the tier assignment.
 *
 * Gated behind the STORAGE_TIERING feature flag. When the flag is disabled,
 * all files are classified as "hot" by default.
 *
 * Usage:
 *   import { TierPolicy, getDefaultRules } from "@/lib/storage/storageTierPolicy";
 *
 *   const policy = new TierPolicy();
 *   for (const rule of getDefaultRules()) { policy.addRule(rule); }
 *   const tier = policy.classify(fileMetadata);
 */

import { isFeatureEnabled } from "../featureFlags";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Storage tier levels ordered from hottest to coldest */
export type StorageTier = "hot" | "warm" | "cold" | "archive";

/** Metadata about a file used for tier classification */
export interface FileMetadata {
  /** Unique file identifier */
  id: string;
  /** ISO 8601 timestamp of last access (null if never accessed) */
  lastAccessedAt: string | null;
  /** ISO 8601 timestamp when the file was created */
  createdAt: string;
  /** Number of times the file has been accessed */
  accessCount: number;
  /** File size in bytes */
  sizeBytes: number;
}

/** A tier classification rule */
export interface TierRule {
  /** Human-readable name for the rule */
  name: string;
  /** Function that evaluates whether a file matches this rule */
  condition: (file: FileMetadata) => boolean;
  /** Target tier if the condition is true */
  tier: StorageTier;
  /** Priority level (higher number = higher priority; evaluated first) */
  priority: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const HOT_THRESHOLD_DAYS = 7;
const WARM_THRESHOLD_DAYS = 30;
const COLD_THRESHOLD_DAYS = 90;

/** Default tier when feature flag is disabled */
const DEFAULT_TIER: StorageTier = "hot";

// ─── Default Rules ────────────────────────────────────────────────────────────

/**
 * Get the default tier classification rules.
 *
 * Default rules (evaluated by priority, highest first):
 * - Priority 40: accessed in last 7 days => hot
 * - Priority 30: accessed in last 30 days => warm
 * - Priority 20: accessed in last 90 days => cold
 * - Priority 10: older or never accessed => archive
 *
 * @returns Array of default TierRule objects
 */
export function getDefaultRules(): TierRule[] {
  return [
    {
      name: "hot-recent-access",
      condition: (file: FileMetadata) => {
        if (!file.lastAccessedAt) return false;
        const daysSinceAccess = getDaysSince(file.lastAccessedAt);
        return daysSinceAccess <= HOT_THRESHOLD_DAYS;
      },
      tier: "hot",
      priority: 40,
    },
    {
      name: "warm-moderate-access",
      condition: (file: FileMetadata) => {
        if (!file.lastAccessedAt) return false;
        const daysSinceAccess = getDaysSince(file.lastAccessedAt);
        return daysSinceAccess <= WARM_THRESHOLD_DAYS;
      },
      tier: "warm",
      priority: 30,
    },
    {
      name: "cold-infrequent-access",
      condition: (file: FileMetadata) => {
        if (!file.lastAccessedAt) return false;
        const daysSinceAccess = getDaysSince(file.lastAccessedAt);
        return daysSinceAccess <= COLD_THRESHOLD_DAYS;
      },
      tier: "cold",
      priority: 20,
    },
    {
      name: "archive-stale",
      condition: (file: FileMetadata) => {
        if (!file.lastAccessedAt) return true;
        const daysSinceAccess = getDaysSince(file.lastAccessedAt);
        return daysSinceAccess > COLD_THRESHOLD_DAYS;
      },
      tier: "archive",
      priority: 10,
    },
  ];
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Calculate the number of days between a given ISO date and now.
 *
 * @param isoDateStr - ISO 8601 date string
 * @returns Number of days since the given date
 */
function getDaysSince(isoDateStr: string): number {
  const date = new Date(isoDateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / MS_PER_DAY);
}

// ─── Class ────────────────────────────────────────────────────────────────────

/**
 * Tier classification policy engine.
 *
 * Rules are evaluated in priority order (highest first). The first matching
 * rule determines the tier. If no rule matches, defaults to "archive".
 *
 * When STORAGE_TIERING feature flag is disabled, always returns "hot".
 */
export class TierPolicy {
  private rules: TierRule[] = [];

  /**
   * Add a classification rule to the policy.
   *
   * @param rule - The tier rule to add
   */
  addRule(rule: TierRule): void {
    this.rules.push(rule);
    // Sort by priority descending so highest priority is checked first
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Classify a file into a storage tier based on its metadata.
   *
   * If the STORAGE_TIERING feature flag is disabled, always returns "hot".
   * Otherwise, evaluates rules in priority order and returns the tier
   * of the first matching rule.
   *
   * @param file - File metadata to classify
   * @returns The assigned storage tier
   */
  classify(file: FileMetadata): StorageTier {
    if (!isFeatureEnabled("STORAGE_TIERING")) {
      return DEFAULT_TIER;
    }

    for (const rule of this.rules) {
      if (rule.condition(file)) {
        return rule.tier;
      }
    }

    // Default fallback if no rule matches
    return "archive";
  }

  /**
   * Get all currently registered rules, sorted by priority.
   *
   * @returns Array of TierRule objects (sorted by priority descending)
   */
  getRules(): TierRule[] {
    return [...this.rules];
  }

  /**
   * Remove all rules from the policy.
   */
  clearRules(): void {
    this.rules = [];
  }
}
