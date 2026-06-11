import { describe, it, expect } from "vitest";
import {
  getScenariosByTier,
  getScenariosByType,
  estimateBenchmarkDuration,
  validateLatencyTargets,
  ALL_BENCHMARK_SCENARIOS,
  DEFAULT_BENCHMARK_CONFIG,
  DEFAULT_BENCHMARK_SETTINGS,
} from "./searchBenchmarkConfig";
import type { BenchmarkScenario, LatencyTargets } from "./searchBenchmarkConfig";

describe("searchBenchmarkConfig", () => {
  describe("ALL_BENCHMARK_SCENARIOS", () => {
    it("contains scenarios for all three tiers", () => {
      const tiers = new Set(ALL_BENCHMARK_SCENARIOS.map((s) => s.tier));
      expect(tiers).toContain("10K");
      expect(tiers).toContain("100K");
      expect(tiers).toContain("600K");
    });

    it("each scenario has a unique id", () => {
      const ids = ALL_BENCHMARK_SCENARIOS.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("each scenario has required fields defined", () => {
      for (const scenario of ALL_BENCHMARK_SCENARIOS) {
        expect(scenario.id).toBeTruthy();
        expect(scenario.name).toBeTruthy();
        expect(scenario.description).toBeTruthy();
        expect(scenario.operationType).toBeTruthy();
        expect(scenario.tier).toBeTruthy();
        expect(scenario.iterations).toBeGreaterThan(0);
        expect(scenario.warmUpIterations).toBeGreaterThanOrEqual(0);
        expect(scenario.latencyTargets.p50).toBeGreaterThan(0);
        expect(scenario.latencyTargets.p95).toBeGreaterThan(0);
        expect(scenario.latencyTargets.p99).toBeGreaterThan(0);
      }
    });

    it("latency targets increase with tier (p50: 10K < 100K < 600K for same operation)", () => {
      const simpleText = ALL_BENCHMARK_SCENARIOS.filter(
        (s) => s.operationType === "simple_text",
      );
      const sorted = simpleText.sort((a, b) => {
        const tierOrder = { "10K": 0, "100K": 1, "600K": 2 };
        return tierOrder[a.tier] - tierOrder[b.tier];
      });
      expect(sorted.length).toBeGreaterThanOrEqual(3);
      expect(sorted[0].latencyTargets.p50).toBeLessThan(sorted[1].latencyTargets.p50);
      expect(sorted[1].latencyTargets.p50).toBeLessThan(sorted[2].latencyTargets.p50);
    });
  });

  describe("DEFAULT_BENCHMARK_CONFIG", () => {
    it("has a version string", () => {
      expect(DEFAULT_BENCHMARK_CONFIG.version).toBeTruthy();
    });

    it("includes all scenarios", () => {
      expect(DEFAULT_BENCHMARK_CONFIG.scenarios).toBe(ALL_BENCHMARK_SCENARIOS);
    });

    it("includes settings", () => {
      expect(DEFAULT_BENCHMARK_CONFIG.settings).toBe(DEFAULT_BENCHMARK_SETTINGS);
    });
  });

  describe("DEFAULT_BENCHMARK_SETTINGS", () => {
    it("has a valid baseUrl", () => {
      expect(DEFAULT_BENCHMARK_SETTINGS.baseUrl).toContain("http");
    });

    it("has a reasonable timeout", () => {
      expect(DEFAULT_BENCHMARK_SETTINGS.timeoutMs).toBeGreaterThan(0);
    });

    it("has concurrency set", () => {
      expect(DEFAULT_BENCHMARK_SETTINGS.concurrency).toBeGreaterThan(0);
    });
  });

  describe("getScenariosByTier", () => {
    it("returns only scenarios for the specified tier", () => {
      const scenarios = getScenariosByTier("10K");
      expect(scenarios.length).toBeGreaterThan(0);
      for (const s of scenarios) {
        expect(s.tier).toBe("10K");
      }
    });

    it("returns scenarios for 600K tier", () => {
      const scenarios = getScenariosByTier("600K");
      expect(scenarios.length).toBeGreaterThan(0);
      for (const s of scenarios) {
        expect(s.tier).toBe("600K");
      }
    });

    it("returns empty array for non-matching tier", () => {
      // We only have 10K, 100K, 600K
      const scenarios = getScenariosByTier("10K");
      expect(scenarios.every((s) => s.tier === "10K")).toBe(true);
    });
  });

  describe("getScenariosByType", () => {
    it("returns only scenarios for the specified type", () => {
      const scenarios = getScenariosByType("simple_text");
      expect(scenarios.length).toBeGreaterThan(0);
      for (const s of scenarios) {
        expect(s.operationType).toBe("simple_text");
      }
    });

    it("returns scenarios for autocomplete_prefix type", () => {
      const scenarios = getScenariosByType("autocomplete_prefix");
      expect(scenarios.length).toBeGreaterThan(0);
      for (const s of scenarios) {
        expect(s.operationType).toBe("autocomplete_prefix");
      }
    });

    it("returns empty array for type with no scenarios", () => {
      const scenarios = getScenariosByType("exact_phrase");
      expect(scenarios).toHaveLength(0);
    });
  });

  describe("estimateBenchmarkDuration", () => {
    it("returns 0 for empty scenarios array", () => {
      expect(estimateBenchmarkDuration([])).toBe(0);
    });

    it("calculates duration based on iterations and warmup", () => {
      const scenarios: BenchmarkScenario[] = [
        {
          id: "test",
          name: "Test",
          description: "Test scenario",
          operationType: "simple_text",
          tier: "10K",
          queryTerm: "test",
          filters: {},
          latencyTargets: { p50: 50, p95: 150, p99: 300 },
          iterations: 100,
          warmUpIterations: 10,
        },
      ];
      // (100 + 10) * 50ms = 5500ms = 6s (ceil)
      const duration = estimateBenchmarkDuration(scenarios);
      expect(duration).toBe(6);
    });

    it("sums durations across multiple scenarios", () => {
      const scenarios: BenchmarkScenario[] = [
        {
          id: "a",
          name: "A",
          description: "A",
          operationType: "simple_text",
          tier: "10K",
          queryTerm: "a",
          filters: {},
          latencyTargets: { p50: 50, p95: 150, p99: 300 },
          iterations: 100,
          warmUpIterations: 10,
        },
        {
          id: "b",
          name: "B",
          description: "B",
          operationType: "filtered_search",
          tier: "10K",
          queryTerm: "b",
          filters: {},
          latencyTargets: { p50: 60, p95: 180, p99: 400 },
          iterations: 50,
          warmUpIterations: 5,
        },
      ];
      // (110 + 55) * 50ms = 8250ms = 9s
      const duration = estimateBenchmarkDuration(scenarios);
      expect(duration).toBe(9);
    });
  });

  describe("validateLatencyTargets", () => {
    it("returns true when all measured latencies are within targets", () => {
      const measured: LatencyTargets = { p50: 40, p95: 120, p99: 250 };
      const targets: LatencyTargets = { p50: 50, p95: 150, p99: 300 };
      expect(validateLatencyTargets(measured, targets)).toBe(true);
    });

    it("returns true when measured equals targets exactly", () => {
      const targets: LatencyTargets = { p50: 50, p95: 150, p99: 300 };
      expect(validateLatencyTargets(targets, targets)).toBe(true);
    });

    it("returns false when p50 exceeds target", () => {
      const measured: LatencyTargets = { p50: 60, p95: 120, p99: 250 };
      const targets: LatencyTargets = { p50: 50, p95: 150, p99: 300 };
      expect(validateLatencyTargets(measured, targets)).toBe(false);
    });

    it("returns false when p95 exceeds target", () => {
      const measured: LatencyTargets = { p50: 40, p95: 200, p99: 250 };
      const targets: LatencyTargets = { p50: 50, p95: 150, p99: 300 };
      expect(validateLatencyTargets(measured, targets)).toBe(false);
    });

    it("returns false when p99 exceeds target", () => {
      const measured: LatencyTargets = { p50: 40, p95: 120, p99: 350 };
      const targets: LatencyTargets = { p50: 50, p95: 150, p99: 300 };
      expect(validateLatencyTargets(measured, targets)).toBe(false);
    });
  });
});
