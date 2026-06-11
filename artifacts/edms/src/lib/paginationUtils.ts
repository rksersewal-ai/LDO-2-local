/**
 * Pagination Utilities
 *
 * Ensures all list endpoints use cursor or offset pagination consistently.
 * Provides types, builder functions, and header parsing for paginated responses.
 *
 * Supports:
 *   - Cursor-based pagination (for real-time data, infinite scroll)
 *   - Offset-based pagination (for traditional page navigation)
 *   - Pagination header parsing (Link, X-Total-Count)
 *   - Page calculation utilities
 */

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

/** Base pagination parameters */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/** Cursor-based pagination parameters */
export interface CursorPaginationParams {
  cursor: string | null;
  limit: number;
  direction?: "forward" | "backward";
}

/** Offset-based pagination parameters */
export interface OffsetPaginationParams {
  offset: number;
  limit: number;
}

/** Generic paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
    nextCursor?: string | null;
    previousCursor?: string | null;
  };
}

/** Parsed pagination info from response headers */
export interface ParsedPaginationHeaders {
  total: number | null;
  nextUrl: string | null;
  prevUrl: string | null;
  lastUrl: string | null;
  firstUrl: string | null;
}

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

/** Default page size for paginated requests */
export const DEFAULT_PAGE_SIZE = 25;

/** Maximum allowed page size */
export const MAX_PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────────────────
// Builder Functions
// ─────────────────────────────────────────────────────────────────────────

/**
 * Build standard offset pagination parameters from page number and size.
 *
 * @param page - 1-based page number
 * @param pageSize - Number of items per page
 * @returns OffsetPaginationParams with calculated offset
 */
export function buildPaginationParams(
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
): OffsetPaginationParams {
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSize)));

  return {
    offset: (safePage - 1) * safePageSize,
    limit: safePageSize,
  };
}

/**
 * Build cursor-based pagination parameters.
 *
 * @param cursor - The cursor token from a previous response (null for first page)
 * @param limit - Number of items to fetch
 * @param direction - Pagination direction (default: forward)
 * @returns CursorPaginationParams
 */
export function buildCursorParams(
  cursor: string | null = null,
  limit: number = DEFAULT_PAGE_SIZE,
  direction: "forward" | "backward" = "forward",
): CursorPaginationParams {
  const safeLimit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(limit)));

  return {
    cursor,
    limit: safeLimit,
    direction,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Response Parsing
// ─────────────────────────────────────────────────────────────────────────

/**
 * Parse pagination-related information from response headers.
 * Supports standard Link header format and X-Total-Count header.
 *
 * @param headers - Response headers (or plain object)
 * @returns Parsed pagination header info
 */
export function parsePaginationHeaders(
  headers: Record<string, string>,
): ParsedPaginationHeaders {
  const result: ParsedPaginationHeaders = {
    total: null,
    nextUrl: null,
    prevUrl: null,
    lastUrl: null,
    firstUrl: null,
  };

  // Parse X-Total-Count header
  const totalCount = headers["x-total-count"] || headers["X-Total-Count"];
  if (totalCount) {
    const parsed = parseInt(totalCount, 10);
    if (!isNaN(parsed)) {
      result.total = parsed;
    }
  }

  // Parse Link header (RFC 5988)
  const linkHeader = headers["link"] || headers["Link"];
  if (linkHeader) {
    const links = linkHeader.split(",");
    for (const link of links) {
      const match = link.match(/<([^>]+)>;\s*rel="([^"]+)"/);
      if (match) {
        const [, url, rel] = match;
        switch (rel) {
          case "next":
            result.nextUrl = url;
            break;
          case "prev":
            result.prevUrl = url;
            break;
          case "last":
            result.lastUrl = url;
            break;
          case "first":
            result.firstUrl = url;
            break;
        }
      }
    }
  }

  return result;
}

/**
 * Determine the next page parameters from a paginated response.
 * Returns null if there is no next page.
 *
 * @param currentResponse - The current paginated response
 * @returns PaginationParams for the next page, or null if at end
 */
export function getNextPageParams<T>(
  currentResponse: PaginatedResponse<T>,
): PaginationParams | null {
  const { pagination } = currentResponse;

  if (!pagination.hasNext) {
    return null;
  }

  return {
    page: pagination.page + 1,
    pageSize: pagination.pageSize,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Calculation Utilities
// ─────────────────────────────────────────────────────────────────────────

/**
 * Calculate the total number of pages given total items and page size.
 *
 * @param total - Total number of items
 * @param pageSize - Items per page
 * @returns Total number of pages (minimum 1)
 */
export function calculateTotalPages(
  total: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): number {
  if (total <= 0) return 1;
  const safePageSize = Math.max(1, Math.floor(pageSize));
  return Math.ceil(total / safePageSize);
}

/**
 * Create an empty paginated response.
 *
 * @returns A PaginatedResponse with no data and default pagination
 */
export function createEmptyPaginatedResponse<T>(): PaginatedResponse<T> {
  return {
    data: [],
    pagination: {
      total: 0,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
      nextCursor: null,
      previousCursor: null,
    },
  };
}
