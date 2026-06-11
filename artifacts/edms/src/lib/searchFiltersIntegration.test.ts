import { describe, it, expect } from "vitest";
import {
  applyEngineeringFilters,
  buildDrawingNumberTsvector,
  buildRevisionRangeClause,
  buildConfidenceFilter,
  buildEngineeringSearchQuery,
  COMMON_DRAWING_PREFIXES,
} from "./searchFiltersIntegration";
import type { SearchQueryDescriptor } from "./searchQueryBuilder";
import type { EngineeringSearchFilter } from "./engineeringSearchFilters";

describe("searchFiltersIntegration", () => {
  describe("applyEngineeringFilters", () => {
    const baseQuery: SearchQueryDescriptor = {
      tsvectorQuery: {
        type: "tsvector",
        searchTerm: "valve",
        weights: ["A", "B", "C", "D"],
        usePrefix: false,
        language: "english",
      },
      filters: [],
      sort: { field: "relevance", direction: "desc", nullsLast: true },
      pagination: { mode: "offset", limit: 25, offset: 0 },
      estimatedComplexity: 3,
    };

    it("merges engineering filter clauses into existing query filters", () => {
      const filter: EngineeringSearchFilter = {
        drawingNumberPattern: "DWG-",
      };
      const result = applyEngineeringFilters(baseQuery, filter);
      expect(result.filtersApplied).toBeGreaterThan(0);
      expect(result.query.filters.length).toBe(result.filtersApplied);
    });

    it("preserves existing filters when merging", () => {
      const queryWithFilters: SearchQueryDescriptor = {
        ...baseQuery,
        filters: [
          { type: "gin_filter", field: "status", operator: "equals", value: "ACTIVE" },
        ],
      };
      const filter: EngineeringSearchFilter = {
        drawingNumberPattern: "SK-",
      };
      const result = applyEngineeringFilters(queryWithFilters, filter);
      expect(result.query.filters.length).toBeGreaterThan(1);
      expect(result.query.filters[0].field).toBe("status");
    });

    it("reports hasDrawingNumberFilter when pattern is provided", () => {
      const filter: EngineeringSearchFilter = { drawingNumberPattern: "DWG-" };
      const result = applyEngineeringFilters(baseQuery, filter);
      expect(result.hasDrawingNumberFilter).toBe(true);
      expect(result.hasRevisionFilter).toBe(false);
      expect(result.hasConfidenceFilter).toBe(false);
    });

    it("reports hasRevisionFilter when revision range is provided", () => {
      const filter: EngineeringSearchFilter = {
        revisionRange: { from: "A", to: "D" },
      };
      const result = applyEngineeringFilters(baseQuery, filter);
      expect(result.hasRevisionFilter).toBe(true);
    });

    it("reports hasConfidenceFilter when confidence threshold is provided", () => {
      const filter: EngineeringSearchFilter = { confidenceThreshold: 85 };
      const result = applyEngineeringFilters(baseQuery, filter);
      expect(result.hasConfidenceFilter).toBe(true);
    });

    it("caps complexity at 10", () => {
      const highComplexityQuery: SearchQueryDescriptor = {
        ...baseQuery,
        estimatedComplexity: 9,
      };
      const filter: EngineeringSearchFilter = {
        drawingNumberPattern: "DWG-",
        revisionRange: { from: "A", to: "Z" },
        confidenceThreshold: 60,
        plNumberFilter: "PL-",
      };
      const result = applyEngineeringFilters(highComplexityQuery, filter);
      expect(result.query.estimatedComplexity).toBeLessThanOrEqual(10);
    });
  });

  describe("buildDrawingNumberTsvector", () => {
    it("detects explicit wildcard as prefix pattern", () => {
      const result = buildDrawingNumberTsvector("DWG-123*");
      expect(result.isPrefix).toBe(true);
      expect(result.normalizedPattern).toBe("DWG-123");
      expect(result.prefix).toBe("DWG-123");
    });

    it("detects common drawing prefixes as prefix patterns", () => {
      const result = buildDrawingNumberTsvector("DWG-");
      expect(result.isPrefix).toBe(true);
    });

    it("detects trailing hyphen as prefix pattern", () => {
      const result = buildDrawingNumberTsvector("SK-100-");
      expect(result.isPrefix).toBe(true);
    });

    it("treats exact drawing numbers as non-prefix", () => {
      const result = buildDrawingNumberTsvector("DWG-12345");
      // "DWG-12345" does not end with *, is not a known prefix alone, does not end with -
      expect(result.isPrefix).toBe(false);
      expect(result.normalizedPattern).toBe("DWG-12345");
    });

    it("trims whitespace from input", () => {
      const result = buildDrawingNumberTsvector("  GA-100  ");
      expect(result.pattern).toBe("GA-100");
    });

    it("preserves the original pattern in the result", () => {
      const result = buildDrawingNumberTsvector("IST-500*");
      expect(result.pattern).toBe("IST-500*");
    });
  });

  describe("COMMON_DRAWING_PREFIXES", () => {
    it("contains expected engineering drawing prefixes", () => {
      expect(COMMON_DRAWING_PREFIXES).toContain("DWG-");
      expect(COMMON_DRAWING_PREFIXES).toContain("SK-");
      expect(COMMON_DRAWING_PREFIXES).toContain("PID-");
    });
  });

  describe("buildRevisionRangeClause", () => {
    it("returns invalid when both from and to are empty", () => {
      const result = buildRevisionRangeClause("", "");
      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("returns invalid when neither provided", () => {
      const result = buildRevisionRangeClause(undefined, undefined);
      expect(result.isValid).toBe(false);
    });

    it("returns valid for open-ended range with only from", () => {
      const result = buildRevisionRangeClause("B", undefined);
      expect(result.isValid).toBe(true);
      expect(result.from).toBe("B");
      expect(result.to).toBe("");
    });

    it("returns valid for open-ended range with only to", () => {
      const result = buildRevisionRangeClause(undefined, "D");
      expect(result.isValid).toBe(true);
      expect(result.from).toBe("");
      expect(result.to).toBe("D");
    });

    it("returns valid for alphabetical range in correct order", () => {
      const result = buildRevisionRangeClause("A", "D");
      expect(result.isValid).toBe(true);
      expect(result.from).toBe("A");
      expect(result.to).toBe("D");
    });

    it("returns invalid for alphabetical range in wrong order", () => {
      const result = buildRevisionRangeClause("Z", "A");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("must not be greater");
    });

    it("returns valid for numeric range in correct order", () => {
      const result = buildRevisionRangeClause("1", "5");
      expect(result.isValid).toBe(true);
    });

    it("returns invalid for numeric range in wrong order", () => {
      const result = buildRevisionRangeClause("10", "3");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("must not be greater");
    });

    it("returns valid when from equals to", () => {
      const result = buildRevisionRangeClause("C", "C");
      expect(result.isValid).toBe(true);
    });

    it("trims whitespace from inputs", () => {
      const result = buildRevisionRangeClause("  A  ", "  D  ");
      expect(result.from).toBe("A");
      expect(result.to).toBe("D");
      expect(result.isValid).toBe(true);
    });
  });

  describe("buildConfidenceFilter", () => {
    it("maps threshold >= 85 to HIGH confidence level", () => {
      const result = buildConfidenceFilter(90);
      expect(result.level).toBe("HIGH");
      expect(result.threshold).toBe(90);
    });

    it("maps threshold >= 60 and < 85 to MEDIUM confidence level", () => {
      const result = buildConfidenceFilter(70);
      expect(result.level).toBe("MEDIUM");
    });

    it("maps threshold < 60 to LOW confidence level", () => {
      const result = buildConfidenceFilter(40);
      expect(result.level).toBe("LOW");
    });

    it("clamps threshold to 0 minimum", () => {
      const result = buildConfidenceFilter(-10);
      expect(result.threshold).toBe(0);
      expect(result.level).toBe("LOW");
    });

    it("clamps threshold to 100 maximum", () => {
      const result = buildConfidenceFilter(150);
      expect(result.threshold).toBe(100);
      expect(result.level).toBe("HIGH");
    });

    it("creates a GIN filter clause with range operator", () => {
      const result = buildConfidenceFilter(75);
      expect(result.filterClause.type).toBe("gin_filter");
      expect(result.filterClause.field).toBe("ocr_confidence");
      expect(result.filterClause.operator).toBe("range");
      expect(result.filterClause.value).toBe(75);
      expect(result.filterClause.secondaryValue).toBe(100);
    });

    it("maps exactly 85 to HIGH", () => {
      const result = buildConfidenceFilter(85);
      expect(result.level).toBe("HIGH");
    });

    it("maps exactly 60 to MEDIUM", () => {
      const result = buildConfidenceFilter(60);
      expect(result.level).toBe("MEDIUM");
    });
  });

  describe("buildEngineeringSearchQuery", () => {
    it("builds a complete query descriptor with search term", () => {
      const result = buildEngineeringSearchQuery("valve", {});
      expect(result.tsvectorQuery).not.toBeNull();
      expect(result.tsvectorQuery!.searchTerm).toBe("valve");
      expect(result.sort.field).toBe("relevance");
      expect(result.pagination.mode).toBe("offset");
    });

    it("builds a query with engineering filters applied", () => {
      const filter: EngineeringSearchFilter = {
        drawingNumberPattern: "DWG-",
        confidenceThreshold: 80,
      };
      const result = buildEngineeringSearchQuery("pressure", filter);
      expect(result.filters.length).toBeGreaterThan(0);
      expect(result.estimatedComplexity).toBeGreaterThan(1);
    });

    it("handles empty search term", () => {
      const result = buildEngineeringSearchQuery("", { drawingNumberPattern: "SK-" });
      expect(result.tsvectorQuery).toBeNull();
      expect(result.filters.length).toBeGreaterThan(0);
    });

    it("caps complexity at 10", () => {
      const filter: EngineeringSearchFilter = {
        drawingNumberPattern: "DWG-",
        revisionRange: { from: "A", to: "Z" },
        confidenceThreshold: 60,
        plNumberFilter: "PL-",
        titleBlockField: { field: "title", value: "Assembly" },
        source: "scanner",
        className: "mechanical",
        statusFilters: ["ACTIVE"],
        duplicateFilter: "exclude",
      };
      const result = buildEngineeringSearchQuery("complex query term", filter);
      expect(result.estimatedComplexity).toBeLessThanOrEqual(10);
    });
  });
});
