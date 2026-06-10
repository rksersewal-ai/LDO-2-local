export type UserRole = "admin" | "supervisor" | "engineer" | "reviewer" | "viewer";

export type DocumentCategory =
  | "DRAWING"
  | "TECHNICAL_EVALUATION"
  | "SPECIFICATION"
  | "ELIGIBILITY_CRITERIA"
  | "SCOPE_OF_SUPPLY"
  | "SMI"
  | "STANDARD"
  | "TENDER"
  | "SDR"
  | "TEST_REPORT"
  | "CERTIFICATE"
  | "PROCEDURE"
  | "OTHER";

export type DocumentStatus = "ACTIVE" | "OBSOLETE" | "UNDER_REVIEW" | "DRAFT" | "APPROVED";

export type OcrStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "FLAGGED"
  | "SKIPPED"
  | "NOT_REQUIRED";

export type InspectionCategory = "CAT-A" | "CAT-B" | "CAT-C" | "CAT-D";

export type WorkCategory =
  | "GENERAL"
  | "DRAWING"
  | "SPECIFICATION"
  | "TENDER"
  | "SHOP"
  | "IC"
  | "AMENDMENT"
  | "VENDOR"
  | "EXTERNAL"
  | "FAILURE"
  | "INSPECTION";

export type PLStatus = "ACTIVE" | "UNDER_REVIEW" | "OBSOLETE";

export type SafetyClassification = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type WorkRecordStatus = "OPEN" | "SUBMITTED" | "VERIFIED" | "CLOSED";

export type CaseStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";

export type CaseSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Document {
  id: string;
  documentNumber: string;
  title: string;
  category: DocumentCategory;
  status: DocumentStatus;
  agency: string;
  revision: string;
  revisionDate: string;
  fileType: string;
  fileSize?: string;
  pages?: number;
  tags: string[];
  linkedPlNumbers: string[];
  filePath?: string;
  ocrStatus: OcrStatus;
  ocrConfidence?: number | null;
  ocrText?: string;
  ocrRetryCount?: number;
  ocrError?: string;
  extractedReferences?: string[];
  isLatest?: boolean;
  sha256?: string;
  uploadedBy?: string;
  owner?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentMetadataAssertion {
  id: string;
  field_key: string;
  value: string;
  normalized_value?: string | null;
  source?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DocumentOcrEntity {
  id: string;
  entity_type: string;
  entity_value: string;
  normalized_value?: string | null;
  confidence?: number | null;
  method?: string;
  source_engine?: string;
  source_page?: number | null;
  review_status: "PENDING" | "APPROVED" | "REJECTED";
  review_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EngineeringChange {
  id: string;
  ecNumber: string;
  status: "OPEN" | "IN_REVIEW" | "IMPLEMENTED" | "RELEASED";
  description: string;
  date: string;
  author?: string;
}

export interface PLNumber {
  id: string;
  plNumber: string;
  description: string;
  name: string;
  category: InspectionCategory;
  controllingAgency: string;
  status: PLStatus;
  safetyCritical: boolean;
  safetyClassification?: SafetyClassification;
  severityOfFailure?: string;
  consequences?: string;
  functionality?: string;
  applicationArea?: string;
  usedIn: string[];
  drawingNumbers: string[];
  specNumbers: string[];
  motherPart?: string;
  uvamId?: string;
  strNumber?: string;
  eligibilityCriteria?: string;
  procurementConditions?: string;
  designSupervisor?: string;
  concernedSupervisor?: string;
  eOfficeFile?: string;
  vendorType?: "VD" | "NVD";
  recentActivity?: string[];
  engineeringChanges?: EngineeringChange[];
  linkedDocumentIds: string[];
  linkedWorkIds: string[];
  linkedCaseIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkTypeDefinition {
  id?: string;
  code: string;
  label: string;
  category: WorkCategory;
  disposalDays: number;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  isActive?: boolean;
  requiresDocument?: boolean;
  consentApplicable?: boolean;
}

export interface WorkRecord {
  id: string;
  userId: string;
  userName: string;
  userSection?: string;
  date: string;
  completionDate?: string;
  closedDate?: string | null;
  dispatchDate?: string;
  closingDate?: string;
  daysTaken?: number;
  workCategory: WorkCategory;
  workType: string;
  referenceNumber?: string;
  plNumber?: string;
  drawingNumber?: string;
  specificationNumber?: string;
  tenderNumber?: string;
  otherNumber?: string;
  description: string;
  remarks?: string;
  eOfficeNumber?: string;
  eOfficeFileNo?: string;
  concernedOfficer?: string;
  sectionType?: string;
  targetDays?: number;
  documentRef?: string;
  consentGiven?: string;
  status: WorkRecordStatus;
  isLocked?: boolean;
  verifiedBy?: string;
  verificationDate?: string;
  createdAt?: string;
}

export interface CaseRecord {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  status: CaseStatus;
  severity: CaseSeverity;
  plNumber?: string;
  vendorName?: string;
  tenderNumber?: string;
  linkedDocumentIds: string[];
  linkedWorkIds: string[];
  assignee: string;
  createdAt: string;
  updatedAt: string;
  type?: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  fullName?: string;
  email: string;
  role: UserRole;
  section: string;
  department?: string;
  designation: string;
  employeeId?: string;
  phone?: string;
  isActive?: boolean;
  lastLogin?: string;
}

export interface Section {
  id: string;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
}

export interface Role {
  id: string;
  name: string;
  code: string;
  description: string;
  permissions: string[];
  isActive: boolean;
  isSystemRole?: boolean;
}

export interface DropdownSettings {
  workTypes: WorkTypeDefinition[];
  sectionTypes: string[];
  concernedOfficers: string[];
  agencies: string[];
  documentCategories: string[];
}

export interface SearchResult {
  type: "document" | "pl" | "work" | "case";
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  matchField?: string;
  snippet?: string;
  date?: string;
  duplicateStatus?: string;
  duplicateGroupKey?: string;
  fingerprintState?: "missing" | "present" | "full";
  linkedPl?: string;
  matchReasons?: string[];
  matchedAssertions?: Array<{
    field_key: string;
    value: string;
    normalized_value?: string;
  }>;
  matchedEntities?: Array<{
    entity_type: string;
    value: string;
    normalized_value?: string;
    review_status?: string;
  }>;
}

export type SearchScope = "ALL" | "DOCUMENTS" | "PL" | "WORK" | "CASES";

export interface SearchFacetBucket {
  value?: string | null;
  hash_state?: string | null;
  source_system?: string | null;
  category?: string | null;
  duplicate_status?: string | null;
  ocr_status?: string | null;
  count: number;
}

export interface SearchDocumentFacets {
  source_system: SearchFacetBucket[];
  category: SearchFacetBucket[];
  duplicate_status: SearchFacetBucket[];
  ocr_status: SearchFacetBucket[];
  hash_status: SearchFacetBucket[];
  pl_linked: SearchFacetBucket[];
}

export interface SearchBucketsResponse {
  documents: Document[];
  work_records: WorkRecord[];
  pl_items: PLNumber[];
  cases: CaseRecord[];
  total: number;
  facets?: {
    documents: SearchDocumentFacets;
  };
}

export interface AppInboxItem {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  status?: string;
  target?: string;
  created_at?: string;
  payload?: Record<string, unknown>;
}

export interface KPIStatus {
  label: string;
  color: string;
  isOnTime: boolean;
}

export interface InitialRunSourceDetail {
  id: string;
  name: string;
  source_system: string;
  root_path: string;
  last_crawled_at?: string | null;
  last_successful_crawl_at?: string | null;
  last_error?: string;
  tracked_files: number;
  active_files: number;
  missing_files: number;
  failed_files: number;
  indexed_documents: number;
}

export interface InitialRunJobSummary {
  id: string;
  source_name?: string;
  status: string;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  discovered_count?: number;
  indexed_count?: number;
  duplicate_count?: number;
  failed_count?: number;
  documents_scanned?: number;
  documents_indexed?: number;
  full_hashes_computed?: number;
  error_message?: string;
}

export interface InitialRunSummary {
  documents: {
    total_documents: number;
    indexed_documents: number;
    missing_search_index: number;
    missing_sparse_hash: number;
    missing_full_hash: number;
    pending_ocr: number;
    processing_ocr: number;
    pending_dedup: number;
    duplicate_groups: number;
    duplicate_documents: number;
  };
  sources: {
    total_sources: number;
    active_sources: number;
    tracked_files: number;
    active_files: number;
    missing_files: number;
    failed_files: number;
  };
  active_source_details: InitialRunSourceDetail[];
  latest_jobs: {
    crawl: InitialRunJobSummary[];
    hash_backfill: InitialRunJobSummary[];
  };
}

export interface InitialRunActionResult {
  action: string;
  mode: "queued" | "inline" | "mixed" | "noop";
  message: string;
  results: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────
// Standardized API Response Shapes
// ─────────────────────────────────────────────────────────────────────────

/**
 * Standard paginated list response for all GET list operations
 * Ensures consistency across all endpoints
 */
export interface ApiListResponse<T> {
  results: T[];
  total: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
}

/**
 * Standard single item response for GET/:id operations
 */
export interface ApiItemResponse<T> {
  data: T;
}

/**
 * Standard response for POST/PATCH/PUT operations
 */
export interface ApiMutationResponse<T> {
  data: T;
  message?: string;
}

/**
 * Standard response for DELETE operations
 */
export interface ApiDeleteResponse {
  success: boolean;
  message?: string;
}

/**
 * Standard error response shape
 */
export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  details?: ApiErrorDetail[];
  errors?: Record<string, string[]>;
}

/**
 * Query parameters for list operations
 */
export interface ListQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: string;
  filters?: Record<string, any>;
}

/**
 * Normalized result from all list queries
 */
export interface NormalizedListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
