/**
 * Engineering Metadata Validation
 *
 * Validation rules for engineering document metadata extracted by OCR.
 * Validates drawing numbers, PL numbers, revision sequences, and
 * required fields per document category.
 */

import type { DocumentCategory } from "./types";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface FieldRequirement {
  field: string;
  required: boolean;
  description: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Drawing Number Validation
// ─────────────────────────────────────────────────────────────────────────

/**
 * Validates a drawing number format.
 * Valid patterns:
 *  - DWG-XXXXX (DWG followed by hyphen and 4-6 digits)
 *  - DWG/XXXXX (DWG followed by slash and 4-6 digits)
 *  - SK-NNNNN (SK prefix with 4-6 digits)
 *  - CLW/ED/... (workshop pattern)
 *  - RDSO/... (RDSO pattern)
 */
export function validateDrawingNumber(value: string): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { valid: false, errors: ["Drawing number is required"] };
  }

  const validPatterns: RegExp[] = [
    /^DWG[-/]\d{4,6}$/i,
    /^SK-\d{4,6}$/i,
    /^CLW\/ED\/[A-Z0-9/-]+$/i,
    /^RDSO\/[A-Z0-9/-]+$/i,
  ];

  const isValid = validPatterns.some((pattern) => pattern.test(value.trim()));

  if (!isValid) {
    return {
      valid: false,
      errors: [
        `Invalid drawing number format: "${value}". Expected formats: DWG-XXXXX, SK-NNNNN, CLW/ED/..., RDSO/...`,
      ],
    };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────
// PL Number Validation
// ─────────────────────────────────────────────────────────────────────────

/**
 * Validates a PL number format.
 * Must be exactly 8 digits, optionally prefixed with "PL-" or "PL ".
 */
export function validatePLNumber(value: string): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { valid: false, errors: ["PL number is required"] };
  }

  const trimmed = value.trim();

  // Strip optional PL prefix
  const numberPart = trimmed.replace(/^PL[-\s]?/i, "");

  if (!/^\d{8}$/.test(numberPart)) {
    return {
      valid: false,
      errors: [
        `Invalid PL number: "${value}". Must be exactly 8 digits (e.g., 12345678 or PL-12345678)`,
      ],
    };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Revision Sequence Validation
// ─────────────────────────────────────────────────────────────────────────

/**
 * Validates that a revision sequence is in correct order.
 * Supports:
 *  - Alphabetic sequences: A, B, C, ...
 *  - Numeric sequences: 1, 2, 3, ...
 *
 * Returns valid if the sequence is monotonically increasing.
 */
export function validateRevisionSequence(revisions: string[]): ValidationResult {
  if (revisions.length <= 1) {
    return { valid: true };
  }

  const errors: string[] = [];

  // Determine if numeric or alphabetic
  const isNumeric = revisions.every((r) => /^\d+$/.test(r));
  const isAlphabetic = revisions.every((r) => /^[A-Z]$/i.test(r));

  if (isNumeric) {
    for (let i = 1; i < revisions.length; i++) {
      const prev = parseInt(revisions[i - 1], 10);
      const curr = parseInt(revisions[i], 10);
      if (curr <= prev) {
        errors.push(
          `Revision "${revisions[i]}" should be greater than "${revisions[i - 1]}"`,
        );
      }
    }
  } else if (isAlphabetic) {
    for (let i = 1; i < revisions.length; i++) {
      const prev = revisions[i - 1].toUpperCase().charCodeAt(0);
      const curr = revisions[i].toUpperCase().charCodeAt(0);
      if (curr <= prev) {
        errors.push(
          `Revision "${revisions[i]}" should come after "${revisions[i - 1]}" alphabetically`,
        );
      }
    }
  } else {
    // Mixed or unrecognized format - cannot validate order
    errors.push("Mixed revision formats detected; cannot validate sequence order");
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Required Fields Validation
// ─────────────────────────────────────────────────────────────────────────

/**
 * Field requirements per document category.
 */
const REQUIRED_FIELDS: Record<string, FieldRequirement[]> = {
  DRAWING: [
    { field: "drawingNumber", required: true, description: "Drawing number" },
    { field: "title", required: true, description: "Drawing title" },
    { field: "revision", required: true, description: "Revision code" },
  ],
  SPECIFICATION: [
    { field: "specNumber", required: true, description: "Specification number" },
    { field: "title", required: true, description: "Specification title" },
    { field: "revision", required: true, description: "Revision code" },
  ],
  TENDER: [
    { field: "tenderNumber", required: true, description: "Tender number" },
    { field: "title", required: true, description: "Tender title" },
  ],
  TEST_REPORT: [
    { field: "reportNumber", required: true, description: "Report number" },
    { field: "title", required: true, description: "Report title" },
    { field: "date", required: true, description: "Report date" },
  ],
  CERTIFICATE: [
    { field: "certificateNumber", required: true, description: "Certificate number" },
    { field: "issuedBy", required: true, description: "Issuing authority" },
    { field: "date", required: true, description: "Issue date" },
  ],
};

/**
 * Validates that all required fields for a document category are present.
 */
export function validateRequiredFields(
  category: DocumentCategory,
  fields: Record<string, string | undefined | null>,
): ValidationResult {
  const requirements = REQUIRED_FIELDS[category];

  // No specific requirements for this category
  if (!requirements) {
    return { valid: true };
  }

  const errors: string[] = [];

  for (const req of requirements) {
    if (req.required) {
      const value = fields[req.field];
      if (!value || value.trim().length === 0) {
        errors.push(`Missing required field: ${req.description} (${req.field})`);
      }
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Get the list of required fields for a document category.
 */
export function getRequiredFields(category: DocumentCategory): FieldRequirement[] {
  return REQUIRED_FIELDS[category] || [];
}

// ─────────────────────────────────────────────────────────────────────────
// Cross-Reference Validation
// ─────────────────────────────────────────────────────────────────────────

/**
 * Validates cross-references between documents.
 * Checks that referenced drawing numbers and PL numbers are valid formats.
 */
export function validateCrossReferences(
  references: { type: "drawing" | "pl"; value: string }[],
): ValidationResult {
  const errors: string[] = [];

  for (const ref of references) {
    if (ref.type === "drawing") {
      const result = validateDrawingNumber(ref.value);
      if (!result.valid) {
        errors.push(`Invalid drawing reference: ${ref.value}`);
      }
    } else if (ref.type === "pl") {
      const result = validatePLNumber(ref.value);
      if (!result.valid) {
        errors.push(`Invalid PL reference: ${ref.value}`);
      }
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
