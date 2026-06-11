import { describe, it, expect, beforeEach, vi } from "vitest";
import { TierPolicy, getDefaultRules } from "./storageTierPolicy";
import type { FileMetadata, TierRule } from "./storageTierPolicy";

// Mock the feature flag module - enabled by default for most tests
const mockIsFeatureEnabled = vi.fn((flag: string) => flag === "STORAGE_TIERING");
vi.mock("../featureFlags", () => ({
  isFeatureEnabled: (flag: string) => mockIsFeatureEnabled(flag),
}));

describe("storageTierPolicy", () => {
  let policy: TierPolicy;

  beforeEach(() => {
    mockIsFeatureEnabled.mockImplementation(
      (flag: string) => flag === "STORAGE_TIERING",
    );
    policy = new TierPolicy();
    for (const rule of getDefaultRules()) {
      policy.addRule(rule);
    }
  });

  /** Helper to create a file with a specific last access date */
  function createFile(daysAgo: number | null): FileMetadata {
    const now = new Date();
    let lastAccessedAt: string | null = null;

    if (daysAgo !== null) {
      const accessDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      lastAccessedAt = accessDate.toISOString();
    }

    return {
      id: "test-file",
      lastAccessedAt,
      createdAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      accessCount: daysAgo !== null ? 5 : 0,
      sizeBytes: 1024 * 1024,
    };
  }

  describe("classify with default rules", () => {
    it("classifies recently accessed file (< 7 days) as hot", () => {
      const file = createFile(1);
      expect(policy.classify(file)).toBe("hot");
    });

    it("classifies file accessed exactly 7 days ago as hot", () => {
      const file = createFile(7);
      expect(policy.classify(file)).toBe("hot");
    });

    it("classifies file accessed 15 days ago as warm", () => {
      const file = createFile(15);
      expect(policy.classify(file)).toBe("warm");
    });

    it("classifies file accessed exactly 30 days ago as warm", () => {
      const file = createFile(30);
      expect(policy.classify(file)).toBe("warm");
    });

    it("classifies file accessed 60 days ago as cold", () => {
      const file = createFile(60);
      expect(policy.classify(file)).toBe("cold");
    });

    it("classifies file accessed exactly 90 days ago as cold", () => {
      const file = createFile(90);
      expect(policy.classify(file)).toBe("cold");
    });

    it("classifies file accessed 100 days ago as archive", () => {
      const file = createFile(100);
      expect(policy.classify(file)).toBe("archive");
    });

    it("classifies file accessed 365 days ago as archive", () => {
      const file = createFile(365);
      expect(policy.classify(file)).toBe("archive");
    });

    it("classifies never-accessed file as archive", () => {
      const file = createFile(null);
      expect(policy.classify(file)).toBe("archive");
    });

    it("classifies file accessed today (0 days ago) as hot", () => {
      const file = createFile(0);
      expect(policy.classify(file)).toBe("hot");
    });
  });

  describe("feature flag gating", () => {
    it("returns hot when STORAGE_TIERING flag is disabled", () => {
      mockIsFeatureEnabled.mockReturnValue(false);

      const coldFile = createFile(100);
      expect(policy.classify(coldFile)).toBe("hot");
    });

    it("returns hot for archive-worthy files when flag is disabled", () => {
      mockIsFeatureEnabled.mockReturnValue(false);

      const archiveFile = createFile(null);
      expect(policy.classify(archiveFile)).toBe("hot");
    });

    it("classifies correctly when flag is enabled", () => {
      mockIsFeatureEnabled.mockImplementation(
        (flag: string) => flag === "STORAGE_TIERING",
      );

      const warmFile = createFile(20);
      expect(policy.classify(warmFile)).toBe("warm");
    });
  });

  describe("custom rules", () => {
    it("allows adding custom rules with higher priority", () => {
      const customRule: TierRule = {
        name: "large-files-cold",
        condition: (file: FileMetadata) => file.sizeBytes > 100 * 1024 * 1024,
        tier: "cold",
        priority: 50, // Higher than default hot rule (40)
      };
      policy.addRule(customRule);

      const largeRecentFile: FileMetadata = {
        id: "large-file",
        lastAccessedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        accessCount: 10,
        sizeBytes: 200 * 1024 * 1024, // 200 MB
      };

      expect(policy.classify(largeRecentFile)).toBe("cold");
    });

    it("respects priority order (highest wins)", () => {
      const lowPriorityRule: TierRule = {
        name: "everything-hot",
        condition: () => true,
        tier: "hot",
        priority: 5,
      };
      const highPriorityRule: TierRule = {
        name: "everything-archive",
        condition: () => true,
        tier: "archive",
        priority: 100,
      };

      const customPolicy = new TierPolicy();
      customPolicy.addRule(lowPriorityRule);
      customPolicy.addRule(highPriorityRule);

      mockIsFeatureEnabled.mockImplementation(
        (flag: string) => flag === "STORAGE_TIERING",
      );

      const file = createFile(1);
      expect(customPolicy.classify(file)).toBe("archive");
    });
  });

  describe("getDefaultRules", () => {
    it("returns 4 rules", () => {
      const rules = getDefaultRules();
      expect(rules).toHaveLength(4);
    });

    it("each rule has name, condition, tier, and priority", () => {
      const rules = getDefaultRules();
      for (const rule of rules) {
        expect(rule.name).toBeTruthy();
        expect(typeof rule.condition).toBe("function");
        expect(["hot", "warm", "cold", "archive"]).toContain(rule.tier);
        expect(typeof rule.priority).toBe("number");
      }
    });

    it("rules cover all tiers", () => {
      const rules = getDefaultRules();
      const tiers = new Set(rules.map((r) => r.tier));
      expect(tiers.has("hot")).toBe(true);
      expect(tiers.has("warm")).toBe(true);
      expect(tiers.has("cold")).toBe(true);
      expect(tiers.has("archive")).toBe(true);
    });
  });

  describe("TierPolicy methods", () => {
    it("getRules returns sorted copy of rules", () => {
      const rules = policy.getRules();
      expect(rules.length).toBeGreaterThan(0);
      // Verify sorted by priority descending
      for (let i = 1; i < rules.length; i++) {
        expect(rules[i - 1].priority).toBeGreaterThanOrEqual(rules[i].priority);
      }
    });

    it("clearRules removes all rules", () => {
      policy.clearRules();
      mockIsFeatureEnabled.mockImplementation(
        (flag: string) => flag === "STORAGE_TIERING",
      );
      // With no rules, should fall back to archive
      const file = createFile(1);
      expect(policy.classify(file)).toBe("archive");
    });
  });
});
