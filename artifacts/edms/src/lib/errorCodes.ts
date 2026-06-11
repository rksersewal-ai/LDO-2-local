/**
 * Structured Error Codes
 *
 * Provides a comprehensive error code system with numeric values,
 * message templates, severity levels, and retryability classification.
 *
 * Categories:
 *   FILE_*    - File validation errors
 *   OCR_*     - OCR processing errors
 *   SEARCH_*  - Query and indexing errors
 *   AUTH_*    - Permission/authentication errors
 *   NETWORK_* - Connectivity errors
 *   SYSTEM_*  - Internal system errors
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ErrorSeverity = "low" | "medium" | "high" | "critical";

export interface ErrorCodeDefinition {
  code: number;
  message: string;
  severity: ErrorSeverity;
  retryable: boolean;
}

// ─── Error Code Enum ──────────────────────────────────────────────────────────

export enum ErrorCode {
  // FILE errors (1000-1099)
  FILE_TOO_LARGE = 1000,
  FILE_INVALID_TYPE = 1001,
  FILE_EXTENSION_MISMATCH = 1002,
  FILE_CORRUPT = 1003,
  FILE_EMPTY = 1004,
  FILE_NAME_INVALID = 1005,

  // OCR errors (2000-2099)
  OCR_TIMEOUT = 2000,
  OCR_ENGINE_UNAVAILABLE = 2001,
  OCR_UNSUPPORTED_FORMAT = 2002,
  OCR_MEMORY_EXCEEDED = 2003,
  OCR_PAGE_LIMIT_EXCEEDED = 2004,
  OCR_CONFIDENCE_TOO_LOW = 2005,

  // SEARCH errors (3000-3099)
  SEARCH_QUERY_INVALID = 3000,
  SEARCH_INDEX_UNAVAILABLE = 3001,
  SEARCH_TIMEOUT = 3002,
  SEARCH_RESULT_LIMIT_EXCEEDED = 3003,
  SEARCH_FILTER_INVALID = 3004,

  // AUTH errors (4000-4099)
  AUTH_UNAUTHORIZED = 4000,
  AUTH_FORBIDDEN = 4001,
  AUTH_TOKEN_EXPIRED = 4002,
  AUTH_SESSION_INVALID = 4003,

  // NETWORK errors (5000-5099)
  NETWORK_OFFLINE = 5000,
  NETWORK_TIMEOUT = 5001,
  NETWORK_DNS_FAILURE = 5002,
  NETWORK_CONNECTION_REFUSED = 5003,
  NETWORK_RATE_LIMITED = 5004,

  // SYSTEM errors (6000-6099)
  SYSTEM_INTERNAL_ERROR = 6000,
  SYSTEM_OUT_OF_MEMORY = 6001,
  SYSTEM_DISK_FULL = 6002,
  SYSTEM_SERVICE_UNAVAILABLE = 6003,
  SYSTEM_CONFIGURATION_ERROR = 6004,
}

// ─── Error Code Registry ──────────────────────────────────────────────────────

const ERROR_REGISTRY: Record<ErrorCode, ErrorCodeDefinition> = {
  // FILE errors
  [ErrorCode.FILE_TOO_LARGE]: {
    code: 1000,
    message: "File size exceeds maximum allowed limit of {maxSize}",
    severity: "medium",
    retryable: false,
  },
  [ErrorCode.FILE_INVALID_TYPE]: {
    code: 1001,
    message: "File type '{type}' is not supported",
    severity: "medium",
    retryable: false,
  },
  [ErrorCode.FILE_EXTENSION_MISMATCH]: {
    code: 1002,
    message: "File extension '{extension}' does not match detected type '{detectedType}'",
    severity: "low",
    retryable: false,
  },
  [ErrorCode.FILE_CORRUPT]: {
    code: 1003,
    message: "File appears to be corrupt or unreadable",
    severity: "high",
    retryable: false,
  },
  [ErrorCode.FILE_EMPTY]: {
    code: 1004,
    message: "File is empty (0 bytes)",
    severity: "medium",
    retryable: false,
  },
  [ErrorCode.FILE_NAME_INVALID]: {
    code: 1005,
    message: "File name contains invalid characters: '{characters}'",
    severity: "low",
    retryable: false,
  },

  // OCR errors
  [ErrorCode.OCR_TIMEOUT]: {
    code: 2000,
    message: "OCR processing timed out after {timeout}s",
    severity: "high",
    retryable: true,
  },
  [ErrorCode.OCR_ENGINE_UNAVAILABLE]: {
    code: 2001,
    message: "OCR engine is currently unavailable",
    severity: "critical",
    retryable: true,
  },
  [ErrorCode.OCR_UNSUPPORTED_FORMAT]: {
    code: 2002,
    message: "Image format '{format}' is not supported by OCR engine",
    severity: "medium",
    retryable: false,
  },
  [ErrorCode.OCR_MEMORY_EXCEEDED]: {
    code: 2003,
    message: "OCR processing exceeded memory limit for image dimensions {width}x{height}",
    severity: "high",
    retryable: true,
  },
  [ErrorCode.OCR_PAGE_LIMIT_EXCEEDED]: {
    code: 2004,
    message: "Document exceeds maximum page limit of {maxPages}",
    severity: "medium",
    retryable: false,
  },
  [ErrorCode.OCR_CONFIDENCE_TOO_LOW]: {
    code: 2005,
    message: "OCR confidence {confidence}% is below minimum threshold",
    severity: "low",
    retryable: true,
  },

  // SEARCH errors
  [ErrorCode.SEARCH_QUERY_INVALID]: {
    code: 3000,
    message: "Search query is invalid: {reason}",
    severity: "low",
    retryable: false,
  },
  [ErrorCode.SEARCH_INDEX_UNAVAILABLE]: {
    code: 3001,
    message: "Search index '{index}' is currently unavailable",
    severity: "high",
    retryable: true,
  },
  [ErrorCode.SEARCH_TIMEOUT]: {
    code: 3002,
    message: "Search query timed out after {timeout}ms",
    severity: "medium",
    retryable: true,
  },
  [ErrorCode.SEARCH_RESULT_LIMIT_EXCEEDED]: {
    code: 3003,
    message: "Search returned too many results ({count}), please refine your query",
    severity: "low",
    retryable: false,
  },
  [ErrorCode.SEARCH_FILTER_INVALID]: {
    code: 3004,
    message: "Search filter '{filter}' is not valid",
    severity: "low",
    retryable: false,
  },

  // AUTH errors
  [ErrorCode.AUTH_UNAUTHORIZED]: {
    code: 4000,
    message: "Authentication required to access this resource",
    severity: "medium",
    retryable: false,
  },
  [ErrorCode.AUTH_FORBIDDEN]: {
    code: 4001,
    message: "You do not have permission to perform this action",
    severity: "medium",
    retryable: false,
  },
  [ErrorCode.AUTH_TOKEN_EXPIRED]: {
    code: 4002,
    message: "Authentication token has expired, please log in again",
    severity: "medium",
    retryable: true,
  },
  [ErrorCode.AUTH_SESSION_INVALID]: {
    code: 4003,
    message: "Session is no longer valid",
    severity: "medium",
    retryable: false,
  },

  // NETWORK errors
  [ErrorCode.NETWORK_OFFLINE]: {
    code: 5000,
    message: "No network connection available",
    severity: "high",
    retryable: true,
  },
  [ErrorCode.NETWORK_TIMEOUT]: {
    code: 5001,
    message: "Network request timed out after {timeout}ms",
    severity: "medium",
    retryable: true,
  },
  [ErrorCode.NETWORK_DNS_FAILURE]: {
    code: 5002,
    message: "DNS resolution failed for host '{host}'",
    severity: "high",
    retryable: true,
  },
  [ErrorCode.NETWORK_CONNECTION_REFUSED]: {
    code: 5003,
    message: "Connection refused by server at '{host}:{port}'",
    severity: "high",
    retryable: true,
  },
  [ErrorCode.NETWORK_RATE_LIMITED]: {
    code: 5004,
    message: "Request rate limited, retry after {retryAfter}s",
    severity: "low",
    retryable: true,
  },

  // SYSTEM errors
  [ErrorCode.SYSTEM_INTERNAL_ERROR]: {
    code: 6000,
    message: "An internal system error occurred",
    severity: "critical",
    retryable: true,
  },
  [ErrorCode.SYSTEM_OUT_OF_MEMORY]: {
    code: 6001,
    message: "System ran out of available memory",
    severity: "critical",
    retryable: true,
  },
  [ErrorCode.SYSTEM_DISK_FULL]: {
    code: 6002,
    message: "Disk storage is full",
    severity: "critical",
    retryable: false,
  },
  [ErrorCode.SYSTEM_SERVICE_UNAVAILABLE]: {
    code: 6003,
    message: "Service '{service}' is temporarily unavailable",
    severity: "high",
    retryable: true,
  },
  [ErrorCode.SYSTEM_CONFIGURATION_ERROR]: {
    code: 6004,
    message: "System configuration error: {detail}",
    severity: "critical",
    retryable: false,
  },
};

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Get the error message template for a given error code.
 * Supports parameter substitution using {paramName} placeholders.
 *
 * @param code - The error code to look up
 * @param params - Optional parameters to substitute in the message template
 * @returns The formatted error message
 */
export function getErrorMessage(
  code: ErrorCode,
  params?: Record<string, string | number>,
): string {
  const definition = ERROR_REGISTRY[code];
  if (!definition) {
    return `Unknown error code: ${code}`;
  }

  let message = definition.message;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      message = message.replace(`{${key}}`, String(value));
    }
  }

  return message;
}

/**
 * Check whether an error code represents a retryable error.
 *
 * @param code - The error code to check
 * @returns true if the error is retryable, false otherwise
 */
export function isRetryable(code: ErrorCode): boolean {
  const definition = ERROR_REGISTRY[code];
  if (!definition) return false;
  return definition.retryable;
}

/**
 * Get the full error code definition including severity and retryability.
 *
 * @param code - The error code to look up
 * @returns The full ErrorCodeDefinition or undefined if not found
 */
export function getErrorDefinition(code: ErrorCode): ErrorCodeDefinition | undefined {
  return ERROR_REGISTRY[code];
}

/**
 * Get the severity level of an error code.
 *
 * @param code - The error code to look up
 * @returns The severity level or undefined if not found
 */
export function getErrorSeverity(code: ErrorCode): ErrorSeverity | undefined {
  const definition = ERROR_REGISTRY[code];
  return definition?.severity;
}
