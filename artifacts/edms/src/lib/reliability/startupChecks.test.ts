import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  PreflightRunner,
  createDefaultRunner,
  checkLocalStorageAvailable,
  checkApiReachable,
  checkBrowserFeatures,
} from "./startupChecks";
import type { StartupCheck } from "./startupChecks";

describe("startupChecks", () => {
  let runner: PreflightRunner;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    runner = new PreflightRunner();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("registerCheck", () => {
    it("registers a single check", () => {
      runner.registerCheck({
        name: "test",
        check: async () => ({ passed: true }),
        critical: false,
      });
      expect(runner.getCheckCount()).toBe(1);
    });

    it("registers multiple checks", () => {
      runner.registerCheck({
        name: "check1",
        check: async () => ({ passed: true }),
        critical: true,
      });
      runner.registerCheck({
        name: "check2",
        check: async () => ({ passed: true }),
        critical: false,
      });
      expect(runner.getCheckCount()).toBe(2);
    });
  });

  describe("runAll", () => {
    it("reports all passed when all checks succeed", async () => {
      runner.registerCheck({
        name: "good1",
        check: async () => ({ passed: true, message: "ok" }),
        critical: true,
      });
      runner.registerCheck({
        name: "good2",
        check: async () => ({ passed: true }),
        critical: false,
      });

      const report = await runner.runAll();
      expect(report.allPassed).toBe(true);
      expect(report.criticalFailures).toEqual([]);
      expect(report.warnings).toEqual([]);
      expect(report.results).toHaveLength(2);
      expect(report.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(report.timestamp).toBeGreaterThan(0);
    });

    it("reports critical failure when a critical check fails", async () => {
      runner.registerCheck({
        name: "critical-check",
        check: async () => ({ passed: false, message: "DB unavailable" }),
        critical: true,
      });

      const report = await runner.runAll();
      expect(report.allPassed).toBe(false);
      expect(report.criticalFailures).toEqual(["critical-check"]);
      expect(report.results[0].passed).toBe(false);
      expect(report.results[0].message).toBe("DB unavailable");
    });

    it("reports warning when a non-critical check fails", async () => {
      runner.registerCheck({
        name: "optional-check",
        check: async () => ({ passed: false, message: "Feature missing" }),
        critical: false,
      });

      const report = await runner.runAll();
      expect(report.allPassed).toBe(false);
      expect(report.criticalFailures).toEqual([]);
      expect(report.warnings).toEqual(["optional-check"]);
    });

    it("handles a mix of passing, critical failures, and warnings", async () => {
      runner.registerCheck({
        name: "pass",
        check: async () => ({ passed: true }),
        critical: true,
      });
      runner.registerCheck({
        name: "critical-fail",
        check: async () => ({ passed: false }),
        critical: true,
      });
      runner.registerCheck({
        name: "warning",
        check: async () => ({ passed: false }),
        critical: false,
      });

      const report = await runner.runAll();
      expect(report.allPassed).toBe(false);
      expect(report.criticalFailures).toEqual(["critical-fail"]);
      expect(report.warnings).toEqual(["warning"]);
      expect(report.results).toHaveLength(3);
    });

    it("catches exceptions thrown by check functions", async () => {
      runner.registerCheck({
        name: "throws",
        check: async () => {
          throw new Error("Unexpected error");
        },
        critical: true,
      });

      const report = await runner.runAll();
      expect(report.allPassed).toBe(false);
      expect(report.criticalFailures).toEqual(["throws"]);
      expect(report.results[0].passed).toBe(false);
      expect(report.results[0].message).toBe("Unexpected error");
    });

    it("catches non-Error exceptions", async () => {
      runner.registerCheck({
        name: "throws-string",
        check: async () => {
          throw "something went wrong";
        },
        critical: false,
      });

      const report = await runner.runAll();
      expect(report.warnings).toEqual(["throws-string"]);
      expect(report.results[0].message).toBe("Check threw an exception");
    });

    it("reports correct duration for each check", async () => {
      runner.registerCheck({
        name: "fast",
        check: async () => ({ passed: true }),
        critical: false,
      });

      const report = await runner.runAll();
      expect(report.results[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it("returns empty report when no checks registered", async () => {
      const report = await runner.runAll();
      expect(report.allPassed).toBe(true);
      expect(report.results).toEqual([]);
      expect(report.criticalFailures).toEqual([]);
      expect(report.warnings).toEqual([]);
    });
  });

  describe("clearChecks", () => {
    it("removes all registered checks", () => {
      runner.registerCheck({
        name: "test",
        check: async () => ({ passed: true }),
        critical: false,
      });
      expect(runner.getCheckCount()).toBe(1);
      runner.clearChecks();
      expect(runner.getCheckCount()).toBe(0);
    });
  });

  describe("default checks", () => {
    describe("checkLocalStorageAvailable", () => {
      it("passes when localStorage works", async () => {
        const result = await checkLocalStorageAvailable();
        expect(result.passed).toBe(true);
        expect(result.message).toContain("available");
      });
    });

    describe("checkApiReachable", () => {
      it("returns passed (simulated)", async () => {
        const result = await checkApiReachable();
        expect(result.passed).toBe(true);
        expect(result.message).toContain("reachable");
      });
    });

    describe("checkBrowserFeatures", () => {
      it("passes when all features are present", async () => {
        const result = await checkBrowserFeatures();
        expect(result.passed).toBe(true);
        expect(result.message).toContain("present");
      });
    });
  });

  describe("createDefaultRunner", () => {
    it("creates a runner with 3 default checks", () => {
      const defaultRunner = createDefaultRunner();
      expect(defaultRunner.getCheckCount()).toBe(3);
    });

    it("all default checks pass in test environment", async () => {
      const defaultRunner = createDefaultRunner();
      const report = await defaultRunner.runAll();
      expect(report.allPassed).toBe(true);
      expect(report.results).toHaveLength(3);
    });
  });
});
