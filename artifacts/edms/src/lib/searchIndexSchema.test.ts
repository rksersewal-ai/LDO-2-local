import { describe, it, expect } from "vitest";
import {
  validateSearchIndexField,
  validateSearchIndexConfig,
  calculateStorageOverhead,
  getFieldsByWeight,
  DEFAULT_SEARCH_INDEX_CONFIG,
  DEFAULT_SEARCH_FIELDS,
  DEFAULT_GIN_INDEXES,
  DEFAULT_WEIGHT_CONFIG,
} from "./searchIndexSchema";
import type {
  SearchIndexField,
  SearchIndexConfig,
  GINIndexDefinition,
  TsvectorWeightConfig,
} from "./searchIndexSchema";

// ─────────────────────────────────────────────────────────────────────────
// validateSearchIndexField
// ─────────────────────────────────────────────────────────────────────────

describe("validateSearchIndexField", () => {
  it("returns no errors for a valid field", () => {
    const field: SearchIndexField = {
      columnName: "title",
      label: "Document Title",
      weight: "A",
      includeInTsvector: true,
      columnType: "text",
      supportsPrefixMatch: true,
    };
    expect(validateSearchIndexField(field)).toEqual([]);
  });

  it("returns error for empty columnName", () => {
    const field: SearchIndexField = {
      columnName: "",
      label: "Title",
      weight: "A",
      includeInTsvector: true,
      columnType: "text",
      supportsPrefixMatch: false,
    };
    const errors = validateSearchIndexField(field);
    expect(errors).toContain("columnName is required");
  });

  it("returns error for whitespace-only columnName", () => {
    const field: SearchIndexField = {
      columnName: "   ",
      label: "Title",
      weight: "A",
      includeInTsvector: true,
      columnType: "text",
      supportsPrefixMatch: false,
    };
    const errors = validateSearchIndexField(field);
    expect(errors).toContain("columnName is required");
  });

  it("returns error for empty label", () => {
    const field: SearchIndexField = {
      columnName: "title",
      label: "",
      weight: "A",
      includeInTsvector: true,
      columnType: "text",
      supportsPrefixMatch: false,
    };
    const errors = validateSearchIndexField(field);
    expect(errors).toContain("label is required");
  });

  it("returns error for jsonb column with prefix match enabled", () => {
    const field: SearchIndexField = {
      columnName: "metadata",
      label: "Metadata",
      weight: "D",
      includeInTsvector: true,
      columnType: "jsonb",
      supportsPrefixMatch: true,
    };
    const errors = validateSearchIndexField(field);
    expect(errors).toContain("jsonb columns cannot support prefix matching");
  });

  it("allows jsonb columns without prefix match", () => {
    const field: SearchIndexField = {
      columnName: "metadata",
      label: "Metadata",
      weight: "D",
      includeInTsvector: true,
      columnType: "jsonb",
      supportsPrefixMatch: false,
    };
    expect(validateSearchIndexField(field)).toEqual([]);
  });

  it("validates all weight values A, B, C, D", () => {
    const weights = ["A", "B", "C", "D"] as const;
    for (const weight of weights) {
      const field: SearchIndexField = {
        columnName: "test",
        label: "Test",
        weight,
        includeInTsvector: true,
        columnType: "text",
        supportsPrefixMatch: false,
      };
      expect(validateSearchIndexField(field)).toEqual([]);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// validateSearchIndexConfig
// ─────────────────────────────────────────────────────────────────────────

describe("validateSearchIndexConfig", () => {
  it("returns no errors for the default configuration", () => {
    expect(validateSearchIndexConfig(DEFAULT_SEARCH_INDEX_CONFIG)).toEqual([]);
  });

  it("returns error for missing schemaVersion", () => {
    const config: SearchIndexConfig = {
      ...DEFAULT_SEARCH_INDEX_CONFIG,
      schemaVersion: "",
    };
    const errors = validateSearchIndexConfig(config);
    expect(errors).toContain("schemaVersion is required");
  });

  it("returns error for missing tableName", () => {
    const config: SearchIndexConfig = {
      ...DEFAULT_SEARCH_INDEX_CONFIG,
      tableName: "",
    };
    const errors = validateSearchIndexConfig(config);
    expect(errors).toContain("tableName is required");
  });

  it("returns error for empty fields array", () => {
    const config: SearchIndexConfig = {
      ...DEFAULT_SEARCH_INDEX_CONFIG,
      fields: [],
    };
    const errors = validateSearchIndexConfig(config);
    expect(errors).toContain("at least one field is required");
  });

  it("returns error when weight references unknown field", () => {
    const config: SearchIndexConfig = {
      ...DEFAULT_SEARCH_INDEX_CONFIG,
      weights: [
        {
          weight: "A",
          normalization: 1.0,
          fields: ["nonexistent_column"],
          description: "Test",
        },
      ],
    };
    const errors = validateSearchIndexConfig(config);
    expect(errors.some((e) => e.includes("unknown field"))).toBe(true);
  });

  it("returns error when partial index lacks whereClause", () => {
    const config: SearchIndexConfig = {
      ...DEFAULT_SEARCH_INDEX_CONFIG,
      ginIndexes: [
        {
          indexName: "idx_test",
          tableName: "documents",
          columns: ["search_vector"],
          indexType: "GIN",
          isPartial: true,
          whereClause: undefined,
          storageOverheadPercent: 10,
        },
      ],
    };
    const errors = validateSearchIndexConfig(config);
    expect(errors.some((e) => e.includes("whereClause"))).toBe(true);
  });

  it("returns error when GIN index targets wrong table", () => {
    const config: SearchIndexConfig = {
      ...DEFAULT_SEARCH_INDEX_CONFIG,
      ginIndexes: [
        {
          indexName: "idx_other",
          tableName: "other_table",
          columns: ["col"],
          indexType: "GIN",
          isPartial: false,
          storageOverheadPercent: 10,
        },
      ],
    };
    const errors = validateSearchIndexConfig(config);
    expect(errors.some((e) => e.includes("targets table"))).toBe(true);
  });

  it("returns error for non-positive maxDocumentCount", () => {
    const config: SearchIndexConfig = {
      ...DEFAULT_SEARCH_INDEX_CONFIG,
      maxDocumentCount: 0,
    };
    const errors = validateSearchIndexConfig(config);
    expect(errors).toContain("maxDocumentCount must be positive");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// calculateStorageOverhead
// ─────────────────────────────────────────────────────────────────────────

describe("calculateStorageOverhead", () => {
  it("sums storage overhead percentages from all GIN indexes", () => {
    const overhead = calculateStorageOverhead(DEFAULT_SEARCH_INDEX_CONFIG);
    const expected = DEFAULT_GIN_INDEXES.reduce(
      (sum, idx) => sum + idx.storageOverheadPercent,
      0,
    );
    expect(overhead).toBe(expected);
  });

  it("returns 0 for config with no GIN indexes", () => {
    const config: SearchIndexConfig = {
      ...DEFAULT_SEARCH_INDEX_CONFIG,
      ginIndexes: [],
    };
    expect(calculateStorageOverhead(config)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// getFieldsByWeight
// ─────────────────────────────────────────────────────────────────────────

describe("getFieldsByWeight", () => {
  it("returns fields with weight A (title)", () => {
    const fields = getFieldsByWeight(DEFAULT_SEARCH_INDEX_CONFIG, "A");
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.every((f) => f.weight === "A")).toBe(true);
    expect(fields.some((f) => f.columnName === "title")).toBe(true);
  });

  it("returns fields with weight B (identifiers)", () => {
    const fields = getFieldsByWeight(DEFAULT_SEARCH_INDEX_CONFIG, "B");
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.every((f) => f.weight === "B")).toBe(true);
  });

  it("returns fields with weight D (metadata)", () => {
    const fields = getFieldsByWeight(DEFAULT_SEARCH_INDEX_CONFIG, "D");
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.every((f) => f.weight === "D")).toBe(true);
  });

  it("only returns fields with includeInTsvector=true", () => {
    const configWithExcluded: SearchIndexConfig = {
      ...DEFAULT_SEARCH_INDEX_CONFIG,
      fields: [
        ...DEFAULT_SEARCH_FIELDS,
        {
          columnName: "excluded",
          label: "Excluded Field",
          weight: "A",
          includeInTsvector: false,
          columnType: "text",
          supportsPrefixMatch: false,
        },
      ],
    };
    const fields = getFieldsByWeight(configWithExcluded, "A");
    expect(fields.every((f) => f.includeInTsvector)).toBe(true);
    expect(fields.some((f) => f.columnName === "excluded")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Default Configuration Integrity
// ─────────────────────────────────────────────────────────────────────────

describe("Default Configuration", () => {
  it("has maxDocumentCount of 600000 (6 lakh)", () => {
    expect(DEFAULT_SEARCH_INDEX_CONFIG.maxDocumentCount).toBe(600000);
  });

  it("has weight A assigned to title field", () => {
    const titleField = DEFAULT_SEARCH_FIELDS.find((f) => f.columnName === "title");
    expect(titleField?.weight).toBe("A");
  });

  it("has weight B assigned to drawing_number field", () => {
    const drawingField = DEFAULT_SEARCH_FIELDS.find((f) => f.columnName === "drawing_number");
    expect(drawingField?.weight).toBe("B");
  });

  it("has weight C assigned to body_text field", () => {
    const bodyField = DEFAULT_SEARCH_FIELDS.find((f) => f.columnName === "body_text");
    expect(bodyField?.weight).toBe("C");
  });

  it("has weight D assigned to metadata field", () => {
    const metadataField = DEFAULT_SEARCH_FIELDS.find((f) => f.columnName === "metadata");
    expect(metadataField?.weight).toBe("D");
  });

  it("uses english text search configuration", () => {
    expect(DEFAULT_SEARCH_INDEX_CONFIG.textSearchConfig).toBe("english");
  });

  it("has at least one GIN index defined", () => {
    expect(DEFAULT_GIN_INDEXES.length).toBeGreaterThan(0);
  });

  it("weight normalization values decrease from A to D", () => {
    const sortedWeights = [...DEFAULT_WEIGHT_CONFIG].sort(
      (a, b) => a.weight.localeCompare(b.weight),
    );
    for (let i = 0; i < sortedWeights.length - 1; i++) {
      expect(sortedWeights[i].normalization).toBeGreaterThanOrEqual(
        sortedWeights[i + 1].normalization,
      );
    }
  });
});
