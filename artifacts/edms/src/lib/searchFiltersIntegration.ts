/**
 * Search Filters Integration
 *
 * Integration layer between engineering-specific search filters
 * (from engineeringSearchFilters.ts) and the search query builder.
 *
 * Provides utility functions to:
 *   - Apply engineering filters to a search query descriptor
 *   - Build drawing number tsvector patterns
 *   - Build revision range clauses
 *   - Build confidence threshold filters
 *
 * This module bridges the domain-specific filter definitions with
 * the generic query builder infrastructure.
 */

import type { EngineeringSearchFilter } from "./engineeringSearchFilters";
import type { ConfidenceLevel } from "./ocrConfidenceScoring";
import type { SearchQueryDescriptor, GINFilterClause } from "./searchQueryBuilder";
import { buildEngineeringFilterClauses, buildTsvectorQuery } from "./searchQueryBuilder";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

/** Result of applying engineering filters to a query */
export interface FilteredQueryResult {
  /** Updated query descriptor with engineering filters applied */
  query: SearchQueryDescriptor;
  /** Number of filter clauses added */
  filtersApplied: number;
  /** Whether drawing number pattern filter was included */
  hasDrawingNumberFilter: boolean;
  /** Whether revision range filter was included */
  hasRevisionFilter: boolean;
  /** Whether confidence threshold was included */
  hasConfidenceFilter: boolean;
}

/** Drawing number tsvector pattern for prefix matching */
export interface DrawingNumberTsvector {
  /** Original pattern provided */
  pattern: string;
  /** Normalized pattern for tsvector matching */
  normalizedPattern: string;
  /** Whether this is a prefix pattern (ends with wildcard) */
  isPrefix: boolean;
  /** Extracted prefix (before any wildcard) */
  prefix: string;
}

/** Revision range clause parameters */
export interface RevisionRangeClause {
  /** Start revision (inclusive) */
  from: string;
  /** End revision (inclusive) */
  to: string;
  /** Whether the range is valid */
  isValid: boolean;
  /** Validation error if invalid */
  error?: string;
}

/** Confidence filter parameters */
export interface ConfidenceFilter {
  /** Minimum confidence threshold (0-100) */
  threshold: number;
  /** Mapped confidence level */
  level: ConfidenceLevel;
  /** Filter clause for the query builder */
  filterClause: GINFilterClause;
}

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

/** Confidence threshold boundaries aligned with ocrConfidenceScoring.ts */
const HIGH_CONFIDENCE_THRESHOLD = 85;
const MEDIUM_CONFIDENCE_THRESHOLD = 60;

/** Common drawing number prefixes in engineering documents */
export const COMMON_DRAWING_PREFIXES = ["DWG-", "SK-", "GA-", "FA-", "IST-", "PID-"] as const;

// ─────────────────────────────────────────────────────────────────────────
// Core Functions
// ─────────────────────────────────────────────────────────────────────────

/**
 * Applies engineering-specific filters to an existing search query descriptor.
 * Returns a new query descriptor with the filters merged in.
 *
 * @param query - Existing search query descriptor
 * @param engineeringFilter - Engineering-specific filter to apply
 * @returns FilteredQueryResult with updated query and metadata
 */
export function applyEngineeringFilters(
  query: SearchQueryDescriptor,
  engineeringFilter: EngineeringSearchFilter,
): FilteredQueryResult {
  const engineeringClauses = buildEngineeringFilterClauses(engineeringFilter);

  // Merge engineering filter clauses with existing filters
  const mergedFilters = [...query.filters, ...engineeringClauses];

  // Recalculate complexity with additional filters
  const additionalComplexity = Math.min(engineeringClauses.length, 3);
  const newComplexity = Math.min(query.estimatedComplexity + additionalComplexity, 10);

  const updatedQuery: SearchQueryDescriptor = {
    ...query,
    filters: mergedFilters,
    estimatedComplexity: newComplexity,
  };

  return {
    query: updatedQuery,
    filtersApplied: engineeringClauses.length,
    hasDrawingNumberFilter: engineeringFilter.drawingNumberPattern !== undefined,
    hasRevisionFilter: engineeringFilter.revisionRange !== undefined,
    hasConfidenceFilter: engineeringFilter.confidenceThreshold !== undefined,
  };
}

/**
 * Builds a drawing number tsvector pattern for prefix matching.
 * Handles common engineering drawing number formats:
 *   - "DWG-" (prefix only)
 *   - "DWG-1234" (exact)
 *   - "DWG-*" (explicit wildcard)
 *   - "SK-100*" (prefix with partial number)
 *
 * @param pattern - Drawing number pattern string
 * @returns DrawingNumberTsvector descriptor
 */
export function buildDrawingNumberTsvector(pattern: string): DrawingNumberTsvector {
  const trimmed = pattern.trim();

  // Detect explicit wildcard or implicit prefix
  const hasExplicitWildcard = trimmed.endsWith("*");
  const normalizedPattern = hasExplicitWildcard ? trimmed.slice(0, -1) : trimmed;

  // Determine if this is a prefix match (ends with wildcard or is a known prefix)
  const isPrefix =
    hasExplicitWildcard ||
    COMMON_DRAWING_PREFIXES.some((p) => trimmed === p) ||
    trimmed.endsWith("-");

  return {
    pattern: trimmed,
    normalizedPattern,
    isPrefix,
    prefix: normalizedPattern,
  };
}

/**
 * Builds a revision range clause from start and end revisions.
 * Validates that the range is logically consistent.
 *
 * Engineering revisions follow alphabetical ordering:
 *   A < B < C < ... < Z < AA < AB ...
 * Or numeric: 0 < 1 < 2 ...
 *
 * @param from - Start revision (inclusive), e.g., "A" or "1"
 * @param to - End revision (inclusive), e.g., "D" or "5"
 * @returns RevisionRangeClause with validation
 */
export function buildRevisionRangeClause(from?: string, to?: string): RevisionRangeClause {
  const fromRevision = (from || "").trim();
  const toRevision = (to || "").trim();

  // Validate at least one bound is provided
  if (!fromRevision && !toRevision) {
    return {
      from: "",
      to: "",
      isValid: false,
      error: "At least one revision bound (from or to) is required",
    };
  }

  // If only one bound provided, the range is valid (open-ended)
  if (!fromRevision) {
    return {
      from: "",
      to: toRevision,
      isValid: true,
    };
  }

  if (!toRevision) {
    return {
      from: fromRevision,
      to: "",
      isValid: true,
    };
  }

  // Validate ordering: from should be <= to (alphabetical or numeric)
  const isNumericFrom = /^\d+$/.test(fromRevision);
  const isNumericTo = /^\d+$/.test(toRevision);

  if (isNumericFrom && isNumericTo) {
    const numFrom = parseInt(fromRevision, 10);
    const numTo = parseInt(toRevision, 10);
    if (numFrom > numTo) {
      return {
        from: fromRevision,
        to: toRevision,
        isValid: false,
        error: `Revision "from" (${fromRevision}) must not be greater than "to" (${toRevision})`,
      };
    }
  } else if (!isNumericFrom && !isNumericTo) {
    // Alphabetical comparison
    if (fromRevision.localeCompare(toRevision) > 0) {
      return {
        from: fromRevision,
        to: toRevision,
        isValid: false,
        error: `Revision "from" (${fromRevision}) must not be greater than "to" (${toRevision})`,
      };
    }
  }

  return {
    from: fromRevision,
    to: toRevision,
    isValid: true,
  };
}

/**
 * Builds a confidence filter from a numeric threshold.
 * Maps the threshold to the appropriate ConfidenceLevel and
 * creates a GIN filter clause for the query builder.
 *
 * Thresholds aligned with config/ocr_pipeline.yaml:
 *   HIGH:   >= 85
 *   MEDIUM: >= 60 and < 85
 *   LOW:    < 60
 *
 * @param threshold - Minimum confidence value (0-100)
 * @returns ConfidenceFilter with mapped level and clause
 */
export function buildConfidenceFilter(threshold: number): ConfidenceFilter {
  // Clamp threshold to valid range
  const clampedThreshold = Math.max(0, Math.min(100, threshold));

  // Map to confidence level
  let level: ConfidenceLevel;
  if (clampedThreshold >= HIGH_CONFIDENCE_THRESHOLD) {
    level = "HIGH";
  } else if (clampedThreshold >= MEDIUM_CONFIDENCE_THRESHOLD) {
    level = "MEDIUM";
  } else {
    level = "LOW";
  }

  const filterClause: GINFilterClause = {
    type: "gin_filter",
    field: "ocr_confidence",
    operator: "range",
    value: clampedThreshold,
    secondaryValue: 100,
  };

  return {
    threshold: clampedThreshold,
    level,
    filterClause,
  };
}

/**
 * Creates a combined search query with engineering filters applied.
 * Convenience function that composes buildTsvectorQuery and applyEngineeringFilters.
 *
 * @param searchTerm - Text search term
 * @param engineeringFilter - Engineering-specific filters
 * @returns SearchQueryDescriptor with all clauses composed
 */
export function buildEngineeringSearchQuery(
  searchTerm: string,
  engineeringFilter: EngineeringSearchFilter,
): SearchQueryDescriptor {
  const tsvectorQuery = buildTsvectorQuery(searchTerm);
  const filterClauses = buildEngineeringFilterClauses(engineeringFilter);

  const complexity = Math.min(
    (tsvectorQuery ? 3 : 1) + filterClauses.length,
    10,
  );

  return {
    tsvectorQuery,
    filters: filterClauses,
    sort: { field: "relevance", direction: "desc", nullsLast: true },
    pagination: { mode: "offset", limit: 25, offset: 0 },
    estimatedComplexity: complexity,
  };
}
