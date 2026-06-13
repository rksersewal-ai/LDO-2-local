/**
 * Search Query Builder
 *
 * Builds optimized search queries for PostgreSQL full-text search
 * targeting 6 lakh (600,000) engineering documents.
 *
 * Supports:
 *   - Tsvector-based full-text queries with weight boosting
 *   - GIN index filter clauses
 *   - Both cursor-based and offset pagination
 *   - Integration with EngineeringSearchFilter type
 *
 * The builder produces query descriptor objects rather than raw SQL,
 * allowing the backend to safely parameterize all values.
 */

import type { EngineeringSearchFilter } from "./engineeringSearchFilters";
import type { SearchFilterOptions } from "../services/SearchService";
import type { TsvectorWeight } from "./searchIndexSchema";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

/** Sort direction */
export type SortDirection = "asc" | "desc";

/** Supported sort fields */
export type SortField =
  | "relevance"
  | "title"
  | "drawing_number"
  | "created_at"
  | "updated_at"
  | "confidence";

/** Pagination mode */
export type PaginationMode = "cursor" | "offset";

/** Cursor-based pagination parameters */
export interface CursorPagination {
  mode: "cursor";
  cursor?: string;
  limit: number;
}

/** Offset-based pagination parameters */
export interface OffsetPagination {
  mode: "offset";
  offset: number;
  limit: number;
}

/** Union pagination type */
export type PaginationParams = CursorPagination | OffsetPagination;

/** Tsvector query clause descriptor */
export interface TsvectorQueryClause {
  type: "tsvector";
  searchTerm: string;
  weights: TsvectorWeight[];
  usePrefix: boolean;
  language: string;
}

/** GIN filter clause descriptor */
export interface GINFilterClause {
  type: "gin_filter";
  field: string;
  operator: "equals" | "contains" | "prefix" | "range" | "in";
  value: string | number | boolean | string[];
  secondaryValue?: string | number;
}

/** Sort clause descriptor */
export interface SortClause {
  field: SortField;
  direction: SortDirection;
  nullsLast: boolean;
}

/** Pagination clause descriptor */
export interface PaginationClause {
  mode: PaginationMode;
  limit: number;
  offset?: number;
  cursor?: string;
}

/** Complete search query descriptor */
export interface SearchQueryDescriptor {
  tsvectorQuery: TsvectorQueryClause | null;
  filters: GINFilterClause[];
  sort: SortClause;
  pagination: PaginationClause;
  /** Estimated complexity for query planning (1-10 scale) */
  estimatedComplexity: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Query Builder Functions
// ─────────────────────────────────────────────────────────────────────────

/**
 * Sanitizes a search term by removing dangerous characters.
 * Strips SQL injection characters and PostgreSQL tsquery operators.
 * Preserves alphanumeric, spaces, hyphens, and common punctuation.
 */
export function sanitizeSearchTerm(term: string): string {
  return term
    .replace(/[\\'"`;]/g, "")
    .replace(/[&|!()]/g, "")
    .replace(/--/g, "")
    .replace(/\/\*/g, "")
    .replace(/\*\//g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Builds a tsvector query clause for full-text search.
 *
 * @param term - Raw search term from user input
 * @param weights - Tsvector weights to search (default: all)
 * @param language - Text search configuration language
 * @returns TsvectorQueryClause or null if term is empty
 */
export function buildTsvectorQuery(
  term: string,
  weights: TsvectorWeight[] = ["A", "B", "C", "D"],
  language: string = "english",
): TsvectorQueryClause | null {
  const sanitized = sanitizeSearchTerm(term);

  if (!sanitized) {
    return null;
  }

  // Detect prefix search pattern (ends with *)
  const usePrefix = sanitized.endsWith("*");

  return {
    type: "tsvector",
    searchTerm: sanitized,
    weights,
    usePrefix,
    language,
  };
}

/**
 * Builds GIN filter clauses from SearchFilterOptions.
 *
 * @param filters - Base search filter options
 * @returns Array of GIN filter clause descriptors
 */
export function buildGINFilterClause(filters: SearchFilterOptions): GINFilterClause[] {
  const clauses: GINFilterClause[] = [];

  if (filters.duplicateFilter && filters.duplicateFilter !== "include") {
    clauses.push({
      type: "gin_filter",
      field: "duplicate_status",
      operator: "equals",
      value: filters.duplicateFilter === "exclude" ? "unique" : "duplicate",
    });
  }

  if (filters.source) {
    clauses.push({
      type: "gin_filter",
      field: "source",
      operator: "equals",
      value: filters.source,
    });
  }

  if (filters.className) {
    clauses.push({
      type: "gin_filter",
      field: "class_name",
      operator: "equals",
      value: filters.className,
    });
  }

  if (filters.hashStatus) {
    clauses.push({
      type: "gin_filter",
      field: "hash_status",
      operator: "equals",
      value: filters.hashStatus,
    });
  }

  if (filters.plLinked) {
    clauses.push({
      type: "gin_filter",
      field: "pl_linked",
      operator: "equals",
      value: filters.plLinked === "linked" ? "true" : "false",
    });
  }

  if (filters.statusFilters && filters.statusFilters.length > 0) {
    clauses.push({
      type: "gin_filter",
      field: "status",
      operator: "in",
      value: filters.statusFilters,
    });
  }

  if (filters.dateRange && filters.dateRange !== "any") {
    clauses.push({
      type: "gin_filter",
      field: "created_at",
      operator: "range",
      value: filters.dateRange,
    });
  }

  return clauses;
}

/**
 * Builds a sort clause descriptor.
 *
 * @param field - Field to sort by
 * @param direction - Sort direction (default: desc)
 * @returns SortClause descriptor
 */
export function buildSortClause(
  field: SortField = "relevance",
  direction: SortDirection = "desc",
): SortClause {
  return {
    field,
    direction,
    nullsLast: true,
  };
}

/**
 * Builds a pagination clause descriptor.
 * Supports both cursor-based (for infinite scroll) and offset-based pagination.
 *
 * @param params - Pagination parameters
 * @returns PaginationClause descriptor
 */
export function buildPaginationClause(params: PaginationParams): PaginationClause {
  if (params.mode === "cursor") {
    return {
      mode: "cursor",
      limit: Math.min(Math.max(params.limit, 1), 100),
      cursor: params.cursor,
    };
  }

  return {
    mode: "offset",
    limit: Math.min(Math.max(params.limit, 1), 100),
    offset: Math.max(params.offset, 0),
  };
}

/**
 * Estimates query complexity on a 1-10 scale based on filters and query type.
 * Used for query planning and timeout estimation.
 */
function estimateComplexity(
  tsvectorQuery: TsvectorQueryClause | null,
  filters: GINFilterClause[],
): number {
  let complexity = 1;

  if (tsvectorQuery) {
    complexity += 2;
    if (tsvectorQuery.usePrefix) {
      complexity += 1;
    }
    if (tsvectorQuery.searchTerm.includes(" ")) {
      complexity += 1;
    }
  }

  complexity += Math.min(filters.length, 4);

  const hasRangeFilter = filters.some((f) => f.operator === "range");
  if (hasRangeFilter) {
    complexity += 1;
  }

  return Math.min(complexity, 10);
}

/**
 * Builds a complete search query descriptor.
 *
 * This is the primary entry point for constructing search queries.
 * It composes tsvector, filter, sort, and pagination clauses into
 * a single descriptor that can be serialized for the backend.
 *
 * @param term - Search term (can be empty for filter-only queries)
 * @param filters - Filter options (base SearchFilterOptions)
 * @param sort - Sort field (default: relevance)
 * @param pagination - Pagination parameters
 * @returns Complete SearchQueryDescriptor
 */
export function buildSearchQuery(
  term: string,
  filters: SearchFilterOptions = {},
  sort: { field?: SortField; direction?: SortDirection } = {},
  pagination: PaginationParams = { mode: "offset", offset: 0, limit: 25 },
): SearchQueryDescriptor {
  const tsvectorQuery = buildTsvectorQuery(term);
  const filterClauses = buildGINFilterClause(filters);
  const sortClause = buildSortClause(sort.field, sort.direction);
  const paginationClause = buildPaginationClause(pagination);

  return {
    tsvectorQuery,
    filters: filterClauses,
    sort: sortClause,
    pagination: paginationClause,
    estimatedComplexity: estimateComplexity(tsvectorQuery, filterClauses),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Engineering Filter Integration
// ─────────────────────────────────────────────────────────────────────────

/**
 * Builds GIN filter clauses from an EngineeringSearchFilter.
 * Extends the base filter builder with engineering-specific fields.
 *
 * @param filter - Engineering-specific search filter
 * @returns Array of GIN filter clause descriptors
 */
export function buildEngineeringFilterClauses(filter: EngineeringSearchFilter): GINFilterClause[] {
  // Start with base filter clauses
  const clauses = buildGINFilterClause(filter);

  if (filter.drawingNumberPattern) {
    clauses.push({
      type: "gin_filter",
      field: "drawing_number",
      operator: "prefix",
      value: filter.drawingNumberPattern,
    });
  }

  if (filter.revisionRange) {
    if (filter.revisionRange.from && filter.revisionRange.to) {
      clauses.push({
        type: "gin_filter",
        field: "revision",
        operator: "range",
        value: filter.revisionRange.from,
        secondaryValue: filter.revisionRange.to,
      });
    } else if (filter.revisionRange.from) {
      clauses.push({
        type: "gin_filter",
        field: "revision",
        operator: "range",
        value: filter.revisionRange.from,
      });
    } else if (filter.revisionRange.to) {
      clauses.push({
        type: "gin_filter",
        field: "revision",
        operator: "range",
        value: "A",
        secondaryValue: filter.revisionRange.to,
      });
    }
  }

  if (filter.plNumberFilter) {
    clauses.push({
      type: "gin_filter",
      field: "pl_number",
      operator: "prefix",
      value: filter.plNumberFilter,
    });
  }

  if (filter.confidenceThreshold !== undefined) {
    clauses.push({
      type: "gin_filter",
      field: "ocr_confidence",
      operator: "range",
      value: filter.confidenceThreshold,
      secondaryValue: 100,
    });
  }

  if (filter.titleBlockField) {
    clauses.push({
      type: "gin_filter",
      field: `title_block_${filter.titleBlockField.field}`,
      operator: "equals",
      value: filter.titleBlockField.value,
    });
  }

  return clauses;
}
