/**
 * Security Module
 *
 * Barrel export for all security utilities including audit logging,
 * rate limiting, upload validation, session security, and permission guards.
 */

export {
  AuditLogService,
  deterministicHash,
  type AuditLogConfig,
  type AuditLogEntry,
  type AuditOperation,
  type ChainVerificationResult,
  type LogOperationParams,
} from "./AuditLogService";

export {
  RateLimiter,
  type EndpointLimitConfig,
  type RateLimitCheckResult,
  type RateLimitConfig,
  type RateLimiterOptions,
} from "./rateLimiting";

export {
  validateUploadSecurity,
  getExtension,
  DANGEROUS_EXTENSIONS,
  DANGEROUS_MIME_TYPES,
  MAGIC_BYTES,
  type FileInput,
  type ValidationError,
  type ValidationErrorCode,
  type ValidationResult,
} from "./uploadValidation";

export {
  SessionManager,
  type SessionConfig,
  type SessionState,
  type TokenRotationState,
} from "./sessionSecurity";

export {
  hasPermission,
  canPerformAction,
  getAvailableActions,
  meetsMinimumRole,
  ROLE_HIERARCHY,
  type DocumentAction,
  type Permission,
  type PermissionCheckResult,
  type PermissionResource,
  type PermissionUser,
  type Role,
} from "./permissionGuard";
