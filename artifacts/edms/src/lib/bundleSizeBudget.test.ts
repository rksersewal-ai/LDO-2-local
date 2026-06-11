import { describe, it, expect, vi, afterEach } from "vitest";
import {
  checkBudget,
  formatBudgetReport,
  formatSize,
  checkAllBudgets,
  DEFAULT_BUDGETS,
} from "./bundleSizeBudget";
import type { ChunkBudget, BudgetCheckResult } from "./bundleSizeBudget";

describe("bundleSizeBudget", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("checkBudget", () => {
    const budget: ChunkBudget = {
      name: "main",
      maxSizeBytes: 200 * 1024,
      warningThreshold: 0.8,
    };

    it("returns 'pass' when size is well under budget", () => {
      const result = checkBudget(100 * 1024, budget);
      expect(result.status).toBe("pass");
      expect(result.difference).toBeLessThan(0);
    });

    it("returns 'warning' when size exceeds warning threshold but not max", () => {
      // 80% of 200KB = 160KB; test at 170KB (between 160KB and 200KB)
      const result = checkBudget(170 * 1024, budget);
      expect(result.status).toBe("warning");
    });

    it("returns 'fail' when size exceeds budget", () => {
      const result = checkBudget(250 * 1024, budget);
      expect(result.status).toBe("fail");
      expect(result.difference).toBeGreaterThan(0);
    });

    it("calculates percentUsed correctly", () => {
      const result = checkBudget(100 * 1024, budget);
      expect(result.percentUsed).toBe(50);
    });

    it("uses default warning threshold when not specified", () => {
      const budgetNoThreshold: ChunkBudget = {
        name: "test",
        maxSizeBytes: 1000,
      };
      // 850 bytes = 85% of 1000, should trigger warning (default threshold is 80%)
      const result = checkBudget(850, budgetNoThreshold);
      expect(result.status).toBe("warning");
    });

    it("reports the correct chunk name", () => {
      const result = checkBudget(1000, budget);
      expect(result.name).toBe("main");
    });
  });

  describe("formatBudgetReport", () => {
    it("reports overall 'pass' when all results pass", () => {
      const results: BudgetCheckResult[] = [
        { name: "main", actualSize: 100, budgetLimit: 200, status: "pass", percentUsed: 50, difference: -100 },
        { name: "vendor", actualSize: 150, budgetLimit: 400, status: "pass", percentUsed: 37.5, difference: -250 },
      ];
      const report = formatBudgetReport(results);
      expect(report.overallStatus).toBe("pass");
      expect(report.summary).toContain("within budget");
    });

    it("reports overall 'warning' when there are warnings but no failures", () => {
      const results: BudgetCheckResult[] = [
        { name: "main", actualSize: 180, budgetLimit: 200, status: "warning", percentUsed: 90, difference: -20 },
        { name: "vendor", actualSize: 100, budgetLimit: 400, status: "pass", percentUsed: 25, difference: -300 },
      ];
      const report = formatBudgetReport(results);
      expect(report.overallStatus).toBe("warning");
      expect(report.summary).toContain("warning");
    });

    it("reports overall 'fail' when any result fails", () => {
      const results: BudgetCheckResult[] = [
        { name: "main", actualSize: 250, budgetLimit: 200, status: "fail", percentUsed: 125, difference: 50 },
        { name: "vendor", actualSize: 100, budgetLimit: 400, status: "pass", percentUsed: 25, difference: -300 },
      ];
      const report = formatBudgetReport(results);
      expect(report.overallStatus).toBe("fail");
      expect(report.summary).toContain("exceeded");
    });

    it("includes a checkedAt timestamp", () => {
      vi.spyOn(Date, "now").mockReturnValue(1700000000000);
      const report = formatBudgetReport([]);
      expect(report.checkedAt).toBe(1700000000000);
    });
  });

  describe("formatSize", () => {
    it("formats bytes", () => {
      expect(formatSize(500)).toBe("500 B");
    });

    it("formats kilobytes", () => {
      expect(formatSize(1536)).toBe("1.5 KB");
    });

    it("formats megabytes", () => {
      expect(formatSize(2 * 1024 * 1024)).toBe("2.0 MB");
    });
  });

  describe("checkAllBudgets", () => {
    it("uses main budget for chunks with 'main' in name", () => {
      const chunks = { main: 100 * 1024 };
      const report = checkAllBudgets(chunks);
      expect(report.results[0].budgetLimit).toBe(DEFAULT_BUDGETS.main.maxSizeBytes);
    });

    it("uses vendor budget for chunks with 'vendor' in name", () => {
      const chunks = { vendor: 200 * 1024 };
      const report = checkAllBudgets(chunks);
      expect(report.results[0].budgetLimit).toBe(DEFAULT_BUDGETS.vendor.maxSizeBytes);
    });

    it("uses lazy route budget for other chunks", () => {
      const chunks = { "documents-page": 30 * 1024 };
      const report = checkAllBudgets(chunks);
      expect(report.results[0].budgetLimit).toBe(DEFAULT_BUDGETS.lazyRoute.maxSizeBytes);
    });

    it("checks multiple chunks and returns aggregate report", () => {
      const chunks = {
        main: 100 * 1024,
        vendor: 300 * 1024,
        "lazy-documents": 40 * 1024,
      };
      const report = checkAllBudgets(chunks);
      expect(report.results).toHaveLength(3);
      expect(report.overallStatus).toBe("pass");
    });

    it("detects when a lazy route exceeds budget", () => {
      const chunks = {
        "search-page": 60 * 1024, // exceeds 50KB lazy route budget
      };
      const report = checkAllBudgets(chunks);
      expect(report.overallStatus).toBe("fail");
    });
  });
});
