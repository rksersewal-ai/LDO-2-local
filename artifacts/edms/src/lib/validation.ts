/**
 * Runtime Schema Validation with Zod
 *
 * Validates all API responses at runtime to ensure data shape matches expectations.
 * Catches backend schema changes, missing fields, type mismatches before they crash the UI.
 *
 * Usage:
 *   const result = validateDocument(apiResponse);
 *   if (result.success) {
 *     const doc = result.data; // Type-safe Document
 *   } else {
 *     console.error(result.error); // ZodError with field details
 *   }
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────
// Enum Schemas
// ─────────────────────────────────────────────────────────────────────────

export const DocumentCategorySchema = z.enum([
  "DRAWING",
  "SPECIFICATION",
  "ELIGIBILITY_CRITERIA",
  "SCOPE_OF_SUPPLY",
  "SMI",
  "STANDARD",
  "TENDER",
  "SDR",
  "TEST_REPORT",
  "CERTIFICATE",
  "PROCEDURE",
  "OTHER",
]);

export const DocumentStatusSchema = z.enum([
  "ACTIVE",
  "OBSOLETE",
  "UNDER_REVIEW",
  "DRAFT",
  "APPROVED",
]);

export const OcrStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "FLAGGED",
  "SKIPPED",
  "NOT_REQUIRED",
]);

export const WorkRecordStatusSchema = z.enum(["OPEN", "SUBMITTED", "VERIFIED", "CLOSED"]);

export const PLStatusSchema = z.enum(["ACTIVE", "UNDER_REVIEW", "OBSOLETE"]);

export const SafetyClassificationSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const WorkCategorySchema = z.enum([
  "GENERAL",
  "DRAWING",
  "SPECIFICATION",
  "TENDER",
  "SHOP",
  "IC",
  "AMENDMENT",
  "VENDOR",
  "EXTERNAL",
  "FAILURE",
  "INSPECTION",
]);

export const InspectionCategorySchema = z.enum(["CAT-A", "CAT-B", "CAT-C", "CAT-D"]);

export const UserRoleSchema = z.enum(["admin", "supervisor", "engineer", "reviewer", "viewer"]);

// ─────────────────────────────────────────────────────────────────────────
// Core Entity Schemas
// ─────────────────────────────────────────────────────────────────────────

export const DocumentSchema = z.object({
  id: z.string(),
  documentNumber: z.string(),
  title: z.string(),
  category: DocumentCategorySchema,
  status: DocumentStatusSchema,
  agency: z.string(),
  revision: z.string(),
  revisionDate: z.string(),
  fileType: z.string(),
  fileSize: z.string().optional(),
  pages: z.number().optional(),
  tags: z.array(z.string()),
  linkedPlNumbers: z.array(z.string()),
  filePath: z.string().optional(),
  ocrStatus: OcrStatusSchema,
  ocrConfidence: z.number().nullable().optional(),
  ocrText: z.string().optional(),
  ocrRetryCount: z.number().optional(),
  ocrError: z.string().optional(),
  extractedReferences: z.array(z.string()).optional(),
  isLatest: z.boolean().optional(),
  sha256: z.string().optional(),
  uploadedBy: z.string().optional(),
  owner: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PLNumberSchema = z.object({
  id: z.string(),
  plNumber: z.string(),
  description: z.string(),
  name: z.string(),
  category: InspectionCategorySchema,
  controllingAgency: z.string(),
  status: PLStatusSchema,
  safetyCritical: z.boolean(),
  safetyClassification: SafetyClassificationSchema.optional(),
  severityOfFailure: z.string().optional(),
  consequences: z.string().optional(),
  functionality: z.string().optional(),
  applicationArea: z.string().optional(),
  usedIn: z.array(z.string()),
  drawingNumbers: z.array(z.string()),
  specNumbers: z.array(z.string()),
  motherPart: z.string().optional(),
  uvamId: z.string().optional(),
  strNumber: z.string().optional(),
  eligibilityCriteria: z.string().optional(),
  procurementConditions: z.string().optional(),
  designSupervisor: z.string().optional(),
  concernedSupervisor: z.string().optional(),
  eOfficeFile: z.string().optional(),
  vendorType: z.enum(["VD", "NVD"]).optional(),
  recentActivity: z.array(z.string()).optional(),
  engineeringChanges: z.array(z.any()).optional(), // Lazy to prevent circular refs
  linkedDocumentIds: z.array(z.string()),
  linkedWorkIds: z.array(z.string()),
  linkedCaseIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const WorkRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  userSection: z.string().optional(),
  date: z.string(),
  completionDate: z.string().optional(),
  closedDate: z.string().nullable().optional(),
  dispatchDate: z.string().optional(),
  closingDate: z.string().optional(),
  daysTaken: z.number().optional(),
  workCategory: WorkCategorySchema,
  recordType: z.string().optional(),
  status: WorkRecordStatusSchema,
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  targetDays: z.number().optional(),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: UserRoleSchema,
  section: z.string().optional(),
  isActive: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────
// API Response Schemas
// ─────────────────────────────────────────────────────────────────────────

/**
 * Standard paginated list response format
 */
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    results: z.array(itemSchema),
    total: z.number(),
    page: z.number().optional(),
    pageSize: z.number().optional(),
    hasMore: z.boolean().optional(),
  });

/**
 * Standard single item response
 */
export const ItemResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: itemSchema,
  });

/**
 * Standard mutation response (create/update/delete)
 */
export const MutationResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    message: z.string().optional(),
    timestamp: z.string().optional(),
  });

/**
 * Standard auth response
 */
export const AuthResponseSchema = z.object({
  access: z.string(),
  refresh: z.string().optional(),
  user: UserSchema,
});

/**
 * Standard error response
 */
export const ErrorResponseSchema = z.object({
  detail: z.string().optional(),
  message: z.string().optional(),
  errors: z.record(z.array(z.string())).optional(),
  status: z.number().optional(),
});

// ─────────────────────────────────────────────────────────────────────────
// Specific API Response Validators
// ─────────────────────────────────────────────────────────────────────────

export const DocumentListResponseSchema = PaginatedResponseSchema(DocumentSchema);
export const DocumentItemResponseSchema = ItemResponseSchema(DocumentSchema);
export const PLNumberListResponseSchema = PaginatedResponseSchema(PLNumberSchema);
export const PLNumberItemResponseSchema = ItemResponseSchema(PLNumberSchema);
export const WorkRecordListResponseSchema = PaginatedResponseSchema(WorkRecordSchema);
export const WorkRecordItemResponseSchema = ItemResponseSchema(WorkRecordSchema);
export const UserListResponseSchema = PaginatedResponseSchema(UserSchema);
export const UserItemResponseSchema = ItemResponseSchema(UserSchema);

// ─────────────────────────────────────────────────────────────────────────
// Safe Validation Functions
// ─────────────────────────────────────────────────────────────────────────

/**
 * Safely parse and validate a response payload
 * Returns {success: true, data} or {success: false, error}
 * Never throws; always returns a result object
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string,
): { success: true; data: T } | { success: false; error: z.ZodError } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(
        `[Validation Error]${context ? ` ${context}` : ""}:`,
        error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
      );
      return { success: false, error };
    }
    throw error;
  }
}

/**
 * Create a validation wrapper for a specific schema
 * Useful for reusable validators
 */
export function createValidator<T>(schema: z.ZodSchema<T>, name: string) {
  return (data: unknown): { success: true; data: T } | { success: false; error: z.ZodError } => {
    return safeValidate(schema, data, name);
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Pre-built Validators (for common use cases)
// ─────────────────────────────────────────────────────────────────────────

export const validateDocument = createValidator(DocumentSchema, "Document");
export const validateDocumentList = createValidator(DocumentListResponseSchema, "DocumentList");
export const validatePLNumber = createValidator(PLNumberSchema, "PLNumber");
export const validatePLNumberList = createValidator(PLNumberListResponseSchema, "PLNumberList");
export const validateWorkRecord = createValidator(WorkRecordSchema, "WorkRecord");
export const validateWorkRecordList = createValidator(
  WorkRecordListResponseSchema,
  "WorkRecordList",
);
export const validateUser = createValidator(UserSchema, "User");
export const validateUserList = createValidator(UserListResponseSchema, "UserList");
export const validateAuthResponse = createValidator(AuthResponseSchema, "AuthResponse");

// ─────────────────────────────────────────────────────────────────────────
// Type Exports (for TypeScript inference)
// ─────────────────────────────────────────────────────────────────────────

export type ValidatedDocument = z.infer<typeof DocumentSchema>;
export type ValidatedPLNumber = z.infer<typeof PLNumberSchema>;
export type ValidatedWorkRecord = z.infer<typeof WorkRecordSchema>;
export type ValidatedUser = z.infer<typeof UserSchema>;
export type ValidatedDocumentList = z.infer<typeof DocumentListResponseSchema>;
export type ValidatedPLNumberList = z.infer<typeof PLNumberListResponseSchema>;
export type ValidatedWorkRecordList = z.infer<typeof WorkRecordListResponseSchema>;
export type ValidatedUserList = z.infer<typeof UserListResponseSchema>;
export type ValidatedAuthResponse = z.infer<typeof AuthResponseSchema>;
