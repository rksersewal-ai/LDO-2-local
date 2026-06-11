import { describe, it, expect } from "vitest";
import {
  sanitizeSearchTerm,
  buildTsvectorQuery,
  buildGINFilterClause,
  buildSortClause,
  buildPaginationClause,
  buildSearchQuery,
  buildEngineeringFilterClauses,
} from "./searchQueryBuilder";
import type { SearchFilterOptions } from "../services/SearchService";
import type { EngineeringSearchFilter } from "./engineeringSearchFilters";

// ─────────────────────────────────────────────────────────────────────────
// sanitizeSearchTerm
// ─────────────────────────────────────────────────────────────────────────

describe("sanitizeSearchTerm", () => {
  it("trims whitespace from term", () => {
    expect(sanitizeSearchTerm("  valve  ")).toBe("valve");
  });

  it("collapses multiple spaces", () => {
    expect(sanitizeSearchTerm("valve   pressure")).toBe("valve pressure");
  });

  it("removes dangerous characters (quotes, semicolons, backslashes)", () => {
    expect(sanitizeSearchTerm("valve'; DROP TABLE--")).toBe("valve DROP TABLE");
  });

  it("preserves hyphens and common punctuation", () => {
    expect(sanitizeSearchTerm("DWG-1234")).toBe("DWG-1234");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(sanitizeSearchTerm("   ")).toBe("");
  });

  it("returns empty string for only dangerous characters", () => {
    expect(sanitizeSearchTerm("'\"`;\\")).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// buildTsvectorQuery
// ─────────────────────────────────────────────────────────────────────────

describe("buildTsvectorQuery", () => {
  it("returns null for empty term", () => {
    expect(buildTsvectorQuery("")).toBeNull();
    expect(buildTsvectorQuery("   ")).toBeNull();
  });

  it("builds a tsvector query with default weights", () => {
    const result = buildTsvectorQuery("valve");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("tsvector");
    expect(result!.searchTerm).toBe("valve");
    expect(result!.weights).toEqual(["A", "B", "C", "D"]);
    expect(result!.usePrefix).toBe(false);
    expect(result!.language).toBe("english");
  });

  it("detects prefix search pattern (ends with *)", () => {
    const result = buildTsvectorQuery("val*");
    expect(result!.usePrefix).toBe(true);
    expect(result!.searchTerm).toBe("val*");
  });

  it("uses specified weights", () => {
    const result = buildTsvectorQuery("valve", ["A", "B"]);
    expect(result!.weights).toEqual(["A", "B"]);
  });

  it("uses specified language", () => {
    const result = buildTsvectorQuery("valve", ["A", "B", "C", "D"], "simple");
    expect(result!.language).toBe("simple");
  });

  it("sanitizes dangerous characters in term", () => {
    const result = buildTsvectorQuery("valve'; --");
    expect(result!.searchTerm).not.toContain("'");
    expect(result!.searchTerm).not.toContain(";");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// buildGINFilterClause
// ─────────────────────────────────────────────────────────────────────────

describe("buildGINFilterClause", () => {
  it("returns empty array for no filters", () => {
    expect(buildGINFilterClause({})).toEqual([]);
  });

  it("handles duplicateFilter=exclude", () => {
    const clauses = buildGINFilterClause({ duplicateFilter: "exclude" });
    expect(clauses).toHaveLength(1);
    expect(clauses[0].field).toBe("duplicate_status");
    expect(clauses[0].value).toBe("unique");
  });

  it("handles duplicateFilter=only", () => {
    const clauses = buildGINFilterClause({ duplicateFilter: "only" });
    expect(clauses).toHaveLength(1);
    expect(clauses[0].value).toBe("duplicate");
  });

  it("ignores duplicateFilter=include (no clause needed)", () => {
    const clauses = buildGINFilterClause({ duplicateFilter: "include" });
    expect(clauses).toEqual([]);
  });

  it("handles source filter", () => {
    const clauses = buildGINFilterClause({ source: "scanner_a" });
    expect(clauses).toHaveLength(1);
    expect(clauses[0].field).toBe("source");
    expect(clauses[0].operator).toBe("equals");
    expect(clauses[0].value).toBe("scanner_a");
  });

  it("handles className filter", () => {
    const clauses = buildGINFilterClause({ className: "Drawing" });
    expect(clauses).toHaveLength(1);
    expect(clauses[0].field).toBe("class_name");
  });

  it("handles hashStatus filter", () => {
    const clauses = buildGINFilterClause({ hashStatus: "full" });
    expect(clauses).toHaveLength(1);
    expect(clauses[0].field).toBe("hash_status");
    expect(clauses[0].value).toBe("full");
  });

  it("ignores empty hashStatus", () => {
    const clauses = buildGINFilterClause({ hashStatus: "" });
    expect(clauses).toEqual([]);
  });

  it("handles plLinked=linked", () => {
    const clauses = buildGINFilterClause({ plLinked: "linked" });
    expect(clauses).toHaveLength(1);
    expect(clauses[0].field).toBe("pl_linked");
    expect(clauses[0].value).toBe("true");
  });

  it("handles plLinked=unlinked", () => {
    const clauses = buildGINFilterClause({ plLinked: "unlinked" });
    expect(clauses).toHaveLength(1);
    expect(clauses[0].value).toBe("false");
  });

  it("ignores empty plLinked", () => {
    const clauses = buildGINFilterClause({ plLinked: "" });
    expect(clauses).toEqual([]);
  });

  it("handles statusFilters", () => {
    const clauses = buildGINFilterClause({ statusFilters: ["ACTIVE", "UNDER_REVIEW"] });
    expect(clauses).toHaveLength(1);
    expect(clauses[0].field).toBe("status");
    expect(clauses[0].operator).toBe("in");
    expect(clauses[0].value).toEqual(["ACTIVE", "UNDER_REVIEW"]);
  });

  it("ignores empty statusFilters array", () => {
    const clauses = buildGINFilterClause({ statusFilters: [] });
    expect(clauses).toEqual([]);
  });

  it("handles dateRange filter", () => {
    const clauses = buildGINFilterClause({ dateRange: "30d" });
    expect(clauses).toHaveLength(1);
    expect(clauses[0].field).toBe("created_at");
    expect(clauses[0].operator).toBe("range");
    expect(clauses[0].value).toBe("30d");
  });

  it("ignores dateRange=any", () => {
    const clauses = buildGINFilterClause({ dateRange: "any" });
    expect(clauses).toEqual([]);
  });

  it("combines multiple filters", () => {
    const filters: SearchFilterOptions = {
      source: "scanner_a",
      duplicateFilter: "exclude",
      dateRange: "7d",
      statusFilters: ["ACTIVE"],
    };
    const clauses = buildGINFilterClause(filters);
    expect(clauses.length).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// buildSortClause
// ─────────────────────────────────────────────────────────────────────────

describe("buildSortClause", () => {
  it("returns default sort by relevance desc", () => {
    const sort = buildSortClause();
    expect(sort.field).toBe("relevance");
    expect(sort.direction).toBe("desc");
    expect(sort.nullsLast).toBe(true);
  });

  it("accepts custom field and direction", () => {
    const sort = buildSortClause("title", "asc");
    expect(sort.field).toBe("title");
    expect(sort.direction).toBe("asc");
  });

  it("supports all sort fields", () => {
    const fields = ["relevance", "title", "drawing_number", "created_at", "updated_at", "confidence"] as const;
    for (const field of fields) {
      const sort = buildSortClause(field);
      expect(sort.field).toBe(field);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// buildPaginationClause
// ─────────────────────────────────────────────────────────────────────────

describe("buildPaginationClause", () => {
  it("builds offset pagination", () => {
    const pagination = buildPaginationClause({ mode: "offset", offset: 20, limit: 10 });
    expect(pagination.mode).toBe("offset");
    expect(pagination.offset).toBe(20);
    expect(pagination.limit).toBe(10);
  });

  it("builds cursor pagination", () => {
    const pagination = buildPaginationClause({ mode: "cursor", cursor: "abc123", limit: 25 });
    expect(pagination.mode).toBe("cursor");
    expect(pagination.cursor).toBe("abc123");
    expect(pagination.limit).toBe(25);
  });

  it("cursor pagination without cursor value", () => {
    const pagination = buildPaginationClause({ mode: "cursor", limit: 25 });
    expect(pagination.mode).toBe("cursor");
    expect(pagination.cursor).toBeUndefined();
  });

  it("caps limit at 100", () => {
    const pagination = buildPaginationClause({ mode: "offset", offset: 0, limit: 500 });
    expect(pagination.limit).toBe(100);
  });

  it("enforces minimum limit of 1", () => {
    const pagination = buildPaginationClause({ mode: "offset", offset: 0, limit: 0 });
    expect(pagination.limit).toBe(1);
  });

  it("enforces minimum offset of 0", () => {
    const pagination = buildPaginationClause({ mode: "offset", offset: -5, limit: 10 });
    expect(pagination.offset).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// buildSearchQuery (main entry point)
// ─────────────────────────────────────────────────────────────────────────

describe("buildSearchQuery", () => {
  it("builds a complete query descriptor", () => {
    const query = buildSearchQuery("valve", { source: "scanner_a" });
    expect(query.tsvectorQuery).not.toBeNull();
    expect(query.tsvectorQuery!.searchTerm).toBe("valve");
    expect(query.filters.length).toBe(1);
    expect(query.sort.field).toBe("relevance");
    expect(query.pagination.mode).toBe("offset");
    expect(query.estimatedComplexity).toBeGreaterThan(0);
  });

  it("handles empty term (filter-only query)", () => {
    const query = buildSearchQuery("", { statusFilters: ["ACTIVE"] });
    expect(query.tsvectorQuery).toBeNull();
    expect(query.filters.length).toBe(1);
  });

  it("uses custom sort and pagination", () => {
    const query = buildSearchQuery(
      "valve",
      {},
      { field: "title", direction: "asc" },
      { mode: "cursor", cursor: "xyz", limit: 50 },
    );
    expect(query.sort.field).toBe("title");
    expect(query.sort.direction).toBe("asc");
    expect(query.pagination.mode).toBe("cursor");
    expect(query.pagination.limit).toBe(50);
    expect(query.pagination.cursor).toBe("xyz");
  });

  it("calculates higher complexity for prefix queries", () => {
    const simple = buildSearchQuery("valve");
    const prefix = buildSearchQuery("val*");
    expect(prefix.estimatedComplexity).toBeGreaterThan(simple.estimatedComplexity);
  });

  it("calculates higher complexity with more filters", () => {
    const noFilters = buildSearchQuery("valve");
    const withFilters = buildSearchQuery("valve", {
      source: "scanner_a",
      duplicateFilter: "exclude",
      dateRange: "7d",
    });
    expect(withFilters.estimatedComplexity).toBeGreaterThan(noFilters.estimatedComplexity);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// buildEngineeringFilterClauses
// ─────────────────────────────────────────────────────────────────────────

describe("buildEngineeringFilterClauses", () => {
  it("handles drawingNumberPattern", () => {
    const filter: EngineeringSearchFilter = {
      drawingNumberPattern: "DWG-",
    };
    const clauses = buildEngineeringFilterClauses(filter);
    const drawingClause = clauses.find((c) => c.field === "drawing_number");
    expect(drawingClause).toBeDefined();
    expect(drawingClause!.operator).toBe("prefix");
    expect(drawingClause!.value).toBe("DWG-");
  });

  it("handles revisionRange with both bounds", () => {
    const filter: EngineeringSearchFilter = {
      revisionRange: { from: "A", to: "D" },
    };
    const clauses = buildEngineeringFilterClauses(filter);
    const revisionClause = clauses.find((c) => c.field === "revision");
    expect(revisionClause).toBeDefined();
    expect(revisionClause!.operator).toBe("range");
    expect(revisionClause!.value).toBe("A");
    expect(revisionClause!.secondaryValue).toBe("D");
  });

  it("handles revisionRange with only 'from'", () => {
    const filter: EngineeringSearchFilter = {
      revisionRange: { from: "B" },
    };
    const clauses = buildEngineeringFilterClauses(filter);
    const revisionClause = clauses.find((c) => c.field === "revision");
    expect(revisionClause).toBeDefined();
    expect(revisionClause!.value).toBe("B");
  });

  it("handles revisionRange with only 'to'", () => {
    const filter: EngineeringSearchFilter = {
      revisionRange: { to: "C" },
    };
    const clauses = buildEngineeringFilterClauses(filter);
    const revisionClause = clauses.find((c) => c.field === "revision");
    expect(revisionClause).toBeDefined();
    expect(revisionClause!.secondaryValue).toBe("C");
  });

  it("handles plNumberFilter", () => {
    const filter: EngineeringSearchFilter = {
      plNumberFilter: "PL-100",
    };
    const clauses = buildEngineeringFilterClauses(filter);
    const plClause = clauses.find((c) => c.field === "pl_number");
    expect(plClause).toBeDefined();
    expect(plClause!.operator).toBe("prefix");
    expect(plClause!.value).toBe("PL-100");
  });

  it("handles confidenceThreshold", () => {
    const filter: EngineeringSearchFilter = {
      confidenceThreshold: 85,
    };
    const clauses = buildEngineeringFilterClauses(filter);
    const confidenceClause = clauses.find((c) => c.field === "ocr_confidence");
    expect(confidenceClause).toBeDefined();
    expect(confidenceClause!.operator).toBe("range");
    expect(confidenceClause!.value).toBe(85);
    expect(confidenceClause!.secondaryValue).toBe(100);
  });

  it("handles titleBlockField", () => {
    const filter: EngineeringSearchFilter = {
      titleBlockField: { field: "title", value: "Assembly Drawing" },
    };
    const clauses = buildEngineeringFilterClauses(filter);
    const titleBlockClause = clauses.find((c) => c.field === "title_block_title");
    expect(titleBlockClause).toBeDefined();
    expect(titleBlockClause!.value).toBe("Assembly Drawing");
  });

  it("includes base filter clauses from SearchFilterOptions", () => {
    const filter: EngineeringSearchFilter = {
      source: "scanner_a",
      drawingNumberPattern: "SK-",
    };
    const clauses = buildEngineeringFilterClauses(filter);
    expect(clauses.some((c) => c.field === "source")).toBe(true);
    expect(clauses.some((c) => c.field === "drawing_number")).toBe(true);
  });

  it("handles combined engineering filters", () => {
    const filter: EngineeringSearchFilter = {
      drawingNumberPattern: "DWG-",
      revisionRange: { from: "A", to: "C" },
      confidenceThreshold: 60,
      statusFilters: ["ACTIVE"],
    };
    const clauses = buildEngineeringFilterClauses(filter);
    expect(clauses.length).toBeGreaterThanOrEqual(4);
  });
});
