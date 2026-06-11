/**
 * Startup Checks (Pre-flight)
 *
 * Provides a pre-flight check utility that runs a series of checks
 * before the application starts. Checks are categorized as critical
 * (blocking) or non-critical (warnings). Results are aggregated into
 * a PreflightReport.
 *
 * Usage:
 *   import { PreflightRunner } from "@/lib/reliability/startupChecks";
 *
 *   const runner = new PreflightRunner();
 *   runner.registerCheck({ name: "localStorage", check: checkLocalStorage, critical: true });
 *   const report = await runner.runAll();
 *   if (!report.allPassed) { ... }
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Result of a single startup check */
export interface CheckResult {
  /** Whether the check passed */
  passed: boolean;
  /** Optional message with details */
  message?: string;
}

/** Definition of a single startup check */
export interface StartupCheck {
  /** Human-readable name of the check */
  name: string;
  /** The check function. Returns a CheckResult. */
  check: () => Promise<CheckResult>;
  /** Whether failure of this check is critical (blocks startup) */
  critical: boolean;
}

/** Individual check outcome in the report */
export interface CheckOutcome {
  /** Name of the check */
  name: string;
  /** Whether the check passed */
  passed: boolean;
  /** Whether the check is critical */
  critical: boolean;
  /** Duration of the check in milliseconds */
  durationMs: number;
  /** Optional message */
  message?: string;
}

/** Aggregated pre-flight report */
export interface PreflightReport {
  /** Whether all checks passed */
  allPassed: boolean;
  /** List of critical check names that failed */
  criticalFailures: string[];
  /** List of non-critical check names that failed */
  warnings: string[];
  /** All individual check results */
  results: CheckOutcome[];
  /** Total time to run all checks */
  totalDurationMs: number;
  /** Timestamp of the report */
  timestamp: number;
}

// ─── PreflightRunner Class ────────────────────────────────────────────────────

/**
 * Registers and runs pre-flight startup checks.
 * Aggregates results into a structured report.
 */
export class PreflightRunner {
  private checks: StartupCheck[];

  constructor() {
    this.checks = [];
  }

  /**
   * Register a startup check.
   * @param check - The StartupCheck to register
   */
  registerCheck(check: StartupCheck): void {
    this.checks.push(check);
  }

  /**
   * Run all registered checks and produce a report.
   * Checks are run sequentially to prevent resource contention.
   * @returns The PreflightReport
   */
  async runAll(): Promise<PreflightReport> {
    const startTime = Date.now();
    const results: CheckOutcome[] = [];
    const criticalFailures: string[] = [];
    const warnings: string[] = [];

    for (const check of this.checks) {
      const checkStart = Date.now();
      let passed = false;
      let message: string | undefined;

      try {
        const result = await check.check();
        passed = result.passed;
        message = result.message;
      } catch (err) {
        passed = false;
        message = err instanceof Error ? err.message : "Check threw an exception";
      }

      const durationMs = Date.now() - checkStart;
      results.push({
        name: check.name,
        passed,
        critical: check.critical,
        durationMs,
        message,
      });

      if (!passed) {
        if (check.critical) {
          criticalFailures.push(check.name);
        } else {
          warnings.push(check.name);
        }
      }
    }

    const allPassed = criticalFailures.length === 0 && warnings.length === 0;

    return {
      allPassed,
      criticalFailures,
      warnings,
      results,
      totalDurationMs: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  /** Get the number of registered checks */
  getCheckCount(): number {
    return this.checks.length;
  }

  /** Clear all registered checks */
  clearChecks(): void {
    this.checks = [];
  }
}

// ─── Default Checks ───────────────────────────────────────────────────────────

/**
 * Check that localStorage is available and writable.
 */
export async function checkLocalStorageAvailable(): Promise<CheckResult> {
  try {
    const testKey = "__edms_preflight_test__";
    localStorage.setItem(testKey, "1");
    const value = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);

    if (value === "1") {
      return { passed: true, message: "localStorage is available" };
    }
    return { passed: false, message: "localStorage read/write failed" };
  } catch {
    return { passed: false, message: "localStorage is not accessible" };
  }
}

/**
 * Mock check for required API reachability.
 * In production, this would ping actual API endpoints.
 * In client-side testing, this always passes.
 */
export async function checkApiReachable(): Promise<CheckResult> {
  // Simulated check - in real implementation would attempt a fetch
  return { passed: true, message: "API endpoint reachable (simulated)" };
}

/**
 * Check that minimum browser features are present.
 * Verifies Promise, Map, Set, and JSON support.
 */
export async function checkBrowserFeatures(): Promise<CheckResult> {
  const missing: string[] = [];

  if (typeof Promise === "undefined") missing.push("Promise");
  if (typeof Map === "undefined") missing.push("Map");
  if (typeof Set === "undefined") missing.push("Set");
  if (typeof JSON === "undefined") missing.push("JSON");

  if (missing.length > 0) {
    return { passed: false, message: `Missing features: ${missing.join(", ")}` };
  }
  return { passed: true, message: "All required browser features present" };
}

/**
 * Create a PreflightRunner with default checks pre-registered.
 * @returns A configured PreflightRunner
 */
export function createDefaultRunner(): PreflightRunner {
  const runner = new PreflightRunner();

  runner.registerCheck({
    name: "localStorage",
    check: checkLocalStorageAvailable,
    critical: true,
  });

  runner.registerCheck({
    name: "apiReachability",
    check: checkApiReachable,
    critical: true,
  });

  runner.registerCheck({
    name: "browserFeatures",
    check: checkBrowserFeatures,
    critical: false,
  });

  return runner;
}
