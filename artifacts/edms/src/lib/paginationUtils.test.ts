import { describe, expect, it } from "vitest";
import {
  buildPaginationParams,
  buildCursorParams,
  parsePaginationHeaders,
  getNextPageParams,
  calculateTotalPages,
  createEmptyPaginatedResponse,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "./paginationUtils";
import type { PaginatedResponse } from "./paginationUtils";

describe("paginationUtils", () => {
  describe("buildPaginationParams", () => {
    it("should build offset params from page 1", () => {
      const result = buildPaginationParams(1, 25);
      expect(result.offset).toBe(0);
      expect(result.limit).toBe(25);
    });

    it("should build offset params from page 3", () => {
      const result = buildPaginationParams(3, 10);
      expect(result.offset).toBe(20);
      expect(result.limit).toBe(10);
    });

    it("should default to page 1 and DEFAULT_PAGE_SIZE", () => {
      const result = buildPaginationParams();
      expect(result.offset).toBe(0);
      expect(result.limit).toBe(DEFAULT_PAGE_SIZE);
    });

    it("should clamp page to minimum 1", () => {
      const result = buildPaginationParams(0, 25);
      expect(result.offset).toBe(0);
    });

    it("should clamp negative page to 1", () => {
      const result = buildPaginationParams(-5, 25);
      expect(result.offset).toBe(0);
    });

    it("should clamp pageSize to MAX_PAGE_SIZE", () => {
      const result = buildPaginationParams(1, 500);
      expect(result.limit).toBe(MAX_PAGE_SIZE);
    });

    it("should clamp pageSize to minimum 1", () => {
      const result = buildPaginationParams(1, 0);
      expect(result.limit).toBe(1);
    });
  });

  describe("buildCursorParams", () => {
    it("should build cursor params with null cursor for first page", () => {
      const result = buildCursorParams(null, 25);
      expect(result.cursor).toBeNull();
      expect(result.limit).toBe(25);
      expect(result.direction).toBe("forward");
    });

    it("should build cursor params with a cursor token", () => {
      const result = buildCursorParams("abc123", 10);
      expect(result.cursor).toBe("abc123");
      expect(result.limit).toBe(10);
    });

    it("should support backward direction", () => {
      const result = buildCursorParams("xyz", 20, "backward");
      expect(result.direction).toBe("backward");
    });

    it("should clamp limit to MAX_PAGE_SIZE", () => {
      const result = buildCursorParams(null, 999);
      expect(result.limit).toBe(MAX_PAGE_SIZE);
    });

    it("should clamp limit to minimum 1", () => {
      const result = buildCursorParams(null, -5);
      expect(result.limit).toBe(1);
    });
  });

  describe("parsePaginationHeaders", () => {
    it("should parse X-Total-Count header", () => {
      const result = parsePaginationHeaders({
        "x-total-count": "150",
      });
      expect(result.total).toBe(150);
    });

    it("should parse Link header with multiple relations", () => {
      const linkHeader =
        '</api/docs?page=2>; rel="next", </api/docs?page=5>; rel="last", </api/docs?page=1>; rel="first"';
      const result = parsePaginationHeaders({ link: linkHeader });
      expect(result.nextUrl).toBe("/api/docs?page=2");
      expect(result.lastUrl).toBe("/api/docs?page=5");
      expect(result.firstUrl).toBe("/api/docs?page=1");
    });

    it("should parse Link header with prev relation", () => {
      const linkHeader = '</api/docs?page=1>; rel="prev"';
      const result = parsePaginationHeaders({ link: linkHeader });
      expect(result.prevUrl).toBe("/api/docs?page=1");
    });

    it("should return nulls for missing headers", () => {
      const result = parsePaginationHeaders({});
      expect(result.total).toBeNull();
      expect(result.nextUrl).toBeNull();
      expect(result.prevUrl).toBeNull();
      expect(result.lastUrl).toBeNull();
      expect(result.firstUrl).toBeNull();
    });

    it("should handle non-numeric total count gracefully", () => {
      const result = parsePaginationHeaders({
        "x-total-count": "invalid",
      });
      expect(result.total).toBeNull();
    });
  });

  describe("getNextPageParams", () => {
    it("should return next page params when hasNext is true", () => {
      const response: PaginatedResponse<string> = {
        data: ["a", "b"],
        pagination: {
          total: 50,
          page: 2,
          pageSize: 10,
          totalPages: 5,
          hasNext: true,
          hasPrevious: true,
        },
      };

      const result = getNextPageParams(response);
      expect(result).toEqual({ page: 3, pageSize: 10 });
    });

    it("should return null when hasNext is false", () => {
      const response: PaginatedResponse<string> = {
        data: ["a"],
        pagination: {
          total: 10,
          page: 5,
          pageSize: 2,
          totalPages: 5,
          hasNext: false,
          hasPrevious: true,
        },
      };

      const result = getNextPageParams(response);
      expect(result).toBeNull();
    });
  });

  describe("calculateTotalPages", () => {
    it("should calculate total pages correctly", () => {
      expect(calculateTotalPages(100, 25)).toBe(4);
      expect(calculateTotalPages(101, 25)).toBe(5);
      expect(calculateTotalPages(1, 25)).toBe(1);
    });

    it("should return 1 for zero or negative total", () => {
      expect(calculateTotalPages(0, 25)).toBe(1);
      expect(calculateTotalPages(-10, 25)).toBe(1);
    });

    it("should use default page size when not specified", () => {
      expect(calculateTotalPages(50)).toBe(2); // 50 / 25 = 2
    });

    it("should handle pageSize of 1", () => {
      expect(calculateTotalPages(5, 1)).toBe(5);
    });

    it("should clamp pageSize to minimum 1", () => {
      expect(calculateTotalPages(10, 0)).toBe(10);
    });
  });

  describe("createEmptyPaginatedResponse", () => {
    it("should create a proper empty response", () => {
      const response = createEmptyPaginatedResponse<string>();
      expect(response.data).toEqual([]);
      expect(response.pagination.total).toBe(0);
      expect(response.pagination.page).toBe(1);
      expect(response.pagination.hasNext).toBe(false);
      expect(response.pagination.hasPrevious).toBe(false);
    });
  });
});
