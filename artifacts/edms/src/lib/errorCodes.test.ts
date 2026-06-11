import { describe, it, expect } from "vitest";
import {
  ErrorCode,
  getErrorMessage,
  isRetryable,
  getErrorDefinition,
  getErrorSeverity,
} from "./errorCodes";

describe("errorCodes", () => {
  describe("ErrorCode enum", () => {
    it("has FILE errors in the 1000 range", () => {
      expect(ErrorCode.FILE_TOO_LARGE).toBe(1000);
      expect(ErrorCode.FILE_INVALID_TYPE).toBe(1001);
      expect(ErrorCode.FILE_EXTENSION_MISMATCH).toBe(1002);
      expect(ErrorCode.FILE_CORRUPT).toBe(1003);
      expect(ErrorCode.FILE_EMPTY).toBe(1004);
      expect(ErrorCode.FILE_NAME_INVALID).toBe(1005);
    });

    it("has OCR errors in the 2000 range", () => {
      expect(ErrorCode.OCR_TIMEOUT).toBe(2000);
      expect(ErrorCode.OCR_ENGINE_UNAVAILABLE).toBe(2001);
      expect(ErrorCode.OCR_UNSUPPORTED_FORMAT).toBe(2002);
      expect(ErrorCode.OCR_MEMORY_EXCEEDED).toBe(2003);
      expect(ErrorCode.OCR_PAGE_LIMIT_EXCEEDED).toBe(2004);
      expect(ErrorCode.OCR_CONFIDENCE_TOO_LOW).toBe(2005);
    });

    it("has SEARCH errors in the 3000 range", () => {
      expect(ErrorCode.SEARCH_QUERY_INVALID).toBe(3000);
      expect(ErrorCode.SEARCH_INDEX_UNAVAILABLE).toBe(3001);
      expect(ErrorCode.SEARCH_TIMEOUT).toBe(3002);
      expect(ErrorCode.SEARCH_RESULT_LIMIT_EXCEEDED).toBe(3003);
      expect(ErrorCode.SEARCH_FILTER_INVALID).toBe(3004);
    });

    it("has AUTH errors in the 4000 range", () => {
      expect(ErrorCode.AUTH_UNAUTHORIZED).toBe(4000);
      expect(ErrorCode.AUTH_FORBIDDEN).toBe(4001);
      expect(ErrorCode.AUTH_TOKEN_EXPIRED).toBe(4002);
      expect(ErrorCode.AUTH_SESSION_INVALID).toBe(4003);
    });

    it("has NETWORK errors in the 5000 range", () => {
      expect(ErrorCode.NETWORK_OFFLINE).toBe(5000);
      expect(ErrorCode.NETWORK_TIMEOUT).toBe(5001);
      expect(ErrorCode.NETWORK_DNS_FAILURE).toBe(5002);
      expect(ErrorCode.NETWORK_CONNECTION_REFUSED).toBe(5003);
      expect(ErrorCode.NETWORK_RATE_LIMITED).toBe(5004);
    });

    it("has SYSTEM errors in the 6000 range", () => {
      expect(ErrorCode.SYSTEM_INTERNAL_ERROR).toBe(6000);
      expect(ErrorCode.SYSTEM_OUT_OF_MEMORY).toBe(6001);
      expect(ErrorCode.SYSTEM_DISK_FULL).toBe(6002);
      expect(ErrorCode.SYSTEM_SERVICE_UNAVAILABLE).toBe(6003);
      expect(ErrorCode.SYSTEM_CONFIGURATION_ERROR).toBe(6004);
    });
  });

  describe("getErrorMessage", () => {
    it("returns the message template for a valid code", () => {
      const msg = getErrorMessage(ErrorCode.FILE_EMPTY);
      expect(msg).toBe("File is empty (0 bytes)");
    });

    it("substitutes parameters in the message template", () => {
      const msg = getErrorMessage(ErrorCode.FILE_TOO_LARGE, {
        maxSize: "500MB",
      });
      expect(msg).toBe("File size exceeds maximum allowed limit of 500MB");
    });

    it("substitutes multiple parameters", () => {
      const msg = getErrorMessage(ErrorCode.OCR_MEMORY_EXCEEDED, {
        width: 20000,
        height: 15000,
      });
      expect(msg).toContain("20000x15000");
    });

    it("handles missing parameters gracefully (leaves placeholder)", () => {
      const msg = getErrorMessage(ErrorCode.NETWORK_TIMEOUT);
      expect(msg).toContain("{timeout}");
    });

    it("returns unknown message for invalid code", () => {
      const msg = getErrorMessage(9999 as ErrorCode);
      expect(msg).toContain("Unknown error code");
    });
  });

  describe("isRetryable", () => {
    it("returns false for FILE_TOO_LARGE (not retryable)", () => {
      expect(isRetryable(ErrorCode.FILE_TOO_LARGE)).toBe(false);
    });

    it("returns true for OCR_TIMEOUT (retryable)", () => {
      expect(isRetryable(ErrorCode.OCR_TIMEOUT)).toBe(true);
    });

    it("returns true for NETWORK_OFFLINE (retryable)", () => {
      expect(isRetryable(ErrorCode.NETWORK_OFFLINE)).toBe(true);
    });

    it("returns false for AUTH_UNAUTHORIZED (not retryable)", () => {
      expect(isRetryable(ErrorCode.AUTH_UNAUTHORIZED)).toBe(false);
    });

    it("returns true for SYSTEM_INTERNAL_ERROR (retryable)", () => {
      expect(isRetryable(ErrorCode.SYSTEM_INTERNAL_ERROR)).toBe(true);
    });

    it("returns false for SYSTEM_DISK_FULL (not retryable)", () => {
      expect(isRetryable(ErrorCode.SYSTEM_DISK_FULL)).toBe(false);
    });

    it("returns true for AUTH_TOKEN_EXPIRED (retryable)", () => {
      expect(isRetryable(ErrorCode.AUTH_TOKEN_EXPIRED)).toBe(true);
    });

    it("returns false for unknown error codes", () => {
      expect(isRetryable(9999 as ErrorCode)).toBe(false);
    });
  });

  describe("getErrorDefinition", () => {
    it("returns the full definition for a valid code", () => {
      const def = getErrorDefinition(ErrorCode.OCR_TIMEOUT);
      expect(def).toBeDefined();
      expect(def?.code).toBe(2000);
      expect(def?.severity).toBe("high");
      expect(def?.retryable).toBe(true);
      expect(def?.message).toContain("timed out");
    });

    it("returns undefined for invalid code", () => {
      expect(getErrorDefinition(9999 as ErrorCode)).toBeUndefined();
    });
  });

  describe("getErrorSeverity", () => {
    it("returns severity for a valid code", () => {
      expect(getErrorSeverity(ErrorCode.FILE_TOO_LARGE)).toBe("medium");
      expect(getErrorSeverity(ErrorCode.OCR_ENGINE_UNAVAILABLE)).toBe("critical");
      expect(getErrorSeverity(ErrorCode.NETWORK_RATE_LIMITED)).toBe("low");
      expect(getErrorSeverity(ErrorCode.SYSTEM_OUT_OF_MEMORY)).toBe("critical");
    });

    it("returns undefined for invalid code", () => {
      expect(getErrorSeverity(9999 as ErrorCode)).toBeUndefined();
    });
  });
});
