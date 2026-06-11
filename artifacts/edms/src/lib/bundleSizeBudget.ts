/**
 * Bundle Size Budget Configuration
 *
 * Defines and enforces bundle size budgets for the EDMS application.
 * Ensures chunks stay within acceptable gzip size limits to maintain
 * fast load times for engineering document management workflows.
 *
 * Budget limits (gzip):
 *   - Main chunk: 200KB
 *   - Vendor chunk: 400KB
 *   - Lazy routes: 50KB each
 *
 * Features:
 *   - Budget checking with pass/fail/warning status
 *   - Formatted budget reports for CI integration
 *   - Configurable thresholds per chunk type
 */

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

/** Budget definition for a single chunk */
export interface ChunkBudget {
  /** Chunk name or pattern */
  name: string;
  /** Maximum allowed size in bytes (gzip) */
  maxSizeBytes: number;
  /** Warning threshold as percentage of max (default: 0.8 = 80%) */
  warningThreshold?: number;
}

/** Bundle budget configuration */
export interface BundleBudget {
  /** Budget for the main application chunk */
  main: ChunkBudget;
  /** Budget for the vendor/dependencies chunk */
  vendor: ChunkBudget;
  /** Budget for each lazy-loaded route chunk */
  lazyRoute: ChunkBudget;
  /** Additional custom chunk budgets */
  custom?: ChunkBudget[];
}

/** Result of checking a single chunk against its budget */
export interface BudgetCheckResult {
  /** Chunk name */
  name: string;
  /** Actual size in bytes */
  actualSize: number;
  /** Budget limit in bytes */
  budgetLimit: number;
  /** Status of the check */
  status: "pass" | "warning" | "fail";
  /** Percentage of budget used (0-100+) */
  percentUsed: number;
  /** How much over/under budget in bytes (negative = under) */
  difference: number;
}

/** Full budget report across all chunks */
export interface BudgetReport {
  /** Individual chunk results */
  results: BudgetCheckResult[];
  /** Overall pass/fail status */
  overallStatus: "pass" | "warning" | "fail";
  /** Summary message */
  summary: string;
  /** Timestamp of the check */
  checkedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

/** Bytes per kilobyte */
const KB = 1024;

/** Default warning threshold (80% of max) */
const DEFAULT_WARNING_THRESHOLD = 0.8;

/** Default bundle size budgets for the EDMS application */
export const DEFAULT_BUDGETS: BundleBudget = {
  main: {
    name: "main",
    maxSizeBytes: 200 * KB,
    warningThreshold: DEFAULT_WARNING_THRESHOLD,
  },
  vendor: {
    name: "vendor",
    maxSizeBytes: 400 * KB,
    warningThreshold: DEFAULT_WARNING_THRESHOLD,
  },
  lazyRoute: {
    name: "lazy-route",
    maxSizeBytes: 50 * KB,
    warningThreshold: DEFAULT_WARNING_THRESHOLD,
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Core Functions
// ─────────────────────────────────────────────────────────────────────────

/**
 * Check an actual chunk size against its budget.
 *
 * @param actualSize - Actual gzip size in bytes
 * @param budget - The budget to check against
 * @returns BudgetCheckResult with status and details
 */
export function checkBudget(
  actualSize: number,
  budget: ChunkBudget,
): BudgetCheckResult {
  const warningThreshold = budget.warningThreshold ?? DEFAULT_WARNING_THRESHOLD;
  const percentUsed = (actualSize / budget.maxSizeBytes) * 100;
  const difference = actualSize - budget.maxSizeBytes;

  let status: "pass" | "warning" | "fail";
  if (actualSize > budget.maxSizeBytes) {
    status = "fail";
  } else if (actualSize > budget.maxSizeBytes * warningThreshold) {
    status = "warning";
  } else {
    status = "pass";
  }

  return {
    name: budget.name,
    actualSize,
    budgetLimit: budget.maxSizeBytes,
    status,
    percentUsed: Math.round(percentUsed * 100) / 100,
    difference,
  };
}

/**
 * Format a complete budget report from check results.
 *
 * @param results - Array of budget check results
 * @returns Formatted BudgetReport with overall status and summary
 */
export function formatBudgetReport(results: BudgetCheckResult[]): BudgetReport {
  const hasFailure = results.some((r) => r.status === "fail");
  const hasWarning = results.some((r) => r.status === "warning");

  let overallStatus: "pass" | "warning" | "fail";
  if (hasFailure) {
    overallStatus = "fail";
  } else if (hasWarning) {
    overallStatus = "warning";
  } else {
    overallStatus = "pass";
  }

  const failCount = results.filter((r) => r.status === "fail").length;
  const warnCount = results.filter((r) => r.status === "warning").length;
  const passCount = results.filter((r) => r.status === "pass").length;

  let summary: string;
  if (hasFailure) {
    summary = `Budget exceeded: ${failCount} chunk(s) over limit, ${warnCount} warning(s), ${passCount} passing`;
  } else if (hasWarning) {
    summary = `Budget warning: ${warnCount} chunk(s) approaching limit, ${passCount} passing`;
  } else {
    summary = `All ${passCount} chunk(s) within budget`;
  }

  return {
    results,
    overallStatus,
    summary,
    checkedAt: Date.now(),
  };
}

/**
 * Format a size in bytes to a human-readable string.
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "150.5 KB", "1.2 MB")
 */
export function formatSize(bytes: number): string {
  if (bytes < KB) {
    return `${bytes} B`;
  }
  if (bytes < KB * KB) {
    return `${(bytes / KB).toFixed(1)} KB`;
  }
  return `${(bytes / (KB * KB)).toFixed(1)} MB`;
}

/**
 * Check all chunks against the default budget configuration.
 *
 * @param chunks - Map of chunk names to their actual sizes in bytes
 * @param budgets - Budget configuration (defaults to DEFAULT_BUDGETS)
 * @returns Complete BudgetReport
 */
export function checkAllBudgets(
  chunks: Record<string, number>,
  budgets: BundleBudget = DEFAULT_BUDGETS,
): BudgetReport {
  const results: BudgetCheckResult[] = [];

  for (const [name, size] of Object.entries(chunks)) {
    let budget: ChunkBudget;

    if (name === "main" || name.includes("main")) {
      budget = { ...budgets.main, name };
    } else if (name === "vendor" || name.includes("vendor")) {
      budget = { ...budgets.vendor, name };
    } else {
      budget = { ...budgets.lazyRoute, name };
    }

    results.push(checkBudget(size, budget));
  }

  return formatBudgetReport(results);
}
