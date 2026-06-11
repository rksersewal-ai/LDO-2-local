/**
 * Search Index Schema
 *
 * TypeScript type definitions for PostgreSQL tsvector/GIN index strategy
 * designed to scale to 6 lakh (600,000) engineering documents.
 *
 * Column weight assignments:
 *   A = title (highest relevance)
 *   B = drawingNumber (high relevance)
 *   C = body / OCR text (standard relevance)
 *   D = metadata fields (lowest relevance)
 *
 * These types inform the backend search index creation and are used
 * by the query builder to construct properly weighted queries.
 */

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

/** PostgreSQL tsvector weight categories */
export type TsvectorWeight = "A" | "B" | "C" | "D";

/** Supported index types for search fields */
export type IndexType = "GIN" | "GIST" | "BTREE" | "HASH";

/** Column data types that can be indexed */
export type IndexableColumnType = "text" | "varchar" | "tsvector" | "jsonb" | "integer" | "timestamp";

/**
 * Configuration for a single search index field.
 * Maps a document field to its indexing parameters.
 */
export interface SearchIndexField {
  /** Column name in the database */
  columnName: string;
  /** Human-readable field label */
  label: string;
  /** Tsvector weight for full-text ranking */
  weight: TsvectorWeight;
  /** Whether this field is included in the composite tsvector */
  includeInTsvector: boolean;
  /** Column data type */
  columnType: IndexableColumnType;
  /** Whether the field supports prefix matching (autocomplete) */
  supportsPrefixMatch: boolean;
}

/**
 * Configuration for tsvector weight assignment.
 * Maps weights to their normalization factor for ranking.
 */
export interface TsvectorWeightConfig {
  weight: TsvectorWeight;
  /** Normalization factor (1.0 = highest, 0.1 = lowest) */
  normalization: number;
  /** Fields assigned to this weight */
  fields: string[];
  /** Description of what this weight level represents */
  description: string;
}

/**
 * Definition for a GIN index on the search table.
 */
export interface GINIndexDefinition {
  /** Index name (used for CREATE INDEX statement) */
  indexName: string;
  /** Table the index is created on */
  tableName: string;
  /** Columns included in the index */
  columns: string[];
  /** Index type */
  indexType: IndexType;
  /** PostgreSQL operator class (e.g., gin_trgm_ops) */
  operatorClass?: string;
  /** Whether this is a partial index with a WHERE clause */
  isPartial: boolean;
  /** Optional WHERE clause for partial indexes */
  whereClause?: string;
  /** Estimated storage overhead percentage */
  storageOverheadPercent: number;
}

/**
 * Complete search index configuration for a document table.
 */
export interface SearchIndexConfig {
  /** Schema version for migration tracking */
  schemaVersion: string;
  /** Target table name */
  tableName: string;
  /** All indexed fields */
  fields: SearchIndexField[];
  /** Weight configurations */
  weights: TsvectorWeightConfig[];
  /** GIN index definitions */
  ginIndexes: GINIndexDefinition[];
  /** Maximum document count this config is optimized for */
  maxDocumentCount: number;
  /** PostgreSQL text search configuration name */
  textSearchConfig: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Default Configuration
// ─────────────────────────────────────────────────────────────────────────

/**
 * Default field definitions for engineering document search.
 */
export const DEFAULT_SEARCH_FIELDS: SearchIndexField[] = [
  {
    columnName: "title",
    label: "Document Title",
    weight: "A",
    includeInTsvector: true,
    columnType: "text",
    supportsPrefixMatch: true,
  },
  {
    columnName: "drawing_number",
    label: "Drawing Number",
    weight: "B",
    includeInTsvector: true,
    columnType: "varchar",
    supportsPrefixMatch: true,
  },
  {
    columnName: "body_text",
    label: "Body / OCR Text",
    weight: "C",
    includeInTsvector: true,
    columnType: "text",
    supportsPrefixMatch: false,
  },
  {
    columnName: "metadata",
    label: "Document Metadata",
    weight: "D",
    includeInTsvector: true,
    columnType: "jsonb",
    supportsPrefixMatch: false,
  },
  {
    columnName: "pl_number",
    label: "PL Number",
    weight: "B",
    includeInTsvector: true,
    columnType: "varchar",
    supportsPrefixMatch: true,
  },
  {
    columnName: "tags",
    label: "Document Tags",
    weight: "D",
    includeInTsvector: true,
    columnType: "text",
    supportsPrefixMatch: false,
  },
];

/**
 * Default tsvector weight configuration.
 * Normalization factors control relative ranking contribution.
 */
export const DEFAULT_WEIGHT_CONFIG: TsvectorWeightConfig[] = [
  {
    weight: "A",
    normalization: 1.0,
    fields: ["title"],
    description: "Highest priority - document title matches",
  },
  {
    weight: "B",
    normalization: 0.8,
    fields: ["drawing_number", "pl_number"],
    description: "High priority - identifier matches (drawing number, PL number)",
  },
  {
    weight: "C",
    normalization: 0.4,
    fields: ["body_text"],
    description: "Standard priority - body/OCR text content matches",
  },
  {
    weight: "D",
    normalization: 0.1,
    fields: ["metadata", "tags"],
    description: "Low priority - metadata and tag matches",
  },
];

/**
 * Default GIN index definitions for the engineering documents table.
 */
export const DEFAULT_GIN_INDEXES: GINIndexDefinition[] = [
  {
    indexName: "idx_documents_fts",
    tableName: "documents",
    columns: ["search_vector"],
    indexType: "GIN",
    operatorClass: "gin_trgm_ops",
    isPartial: false,
    storageOverheadPercent: 30,
  },
  {
    indexName: "idx_documents_drawing_number_gin",
    tableName: "documents",
    columns: ["drawing_number"],
    indexType: "GIN",
    operatorClass: "gin_trgm_ops",
    isPartial: false,
    storageOverheadPercent: 15,
  },
  {
    indexName: "idx_documents_active_fts",
    tableName: "documents",
    columns: ["search_vector"],
    indexType: "GIN",
    isPartial: true,
    whereClause: "status = 'ACTIVE'",
    storageOverheadPercent: 20,
  },
  {
    indexName: "idx_documents_metadata_gin",
    tableName: "documents",
    columns: ["metadata"],
    indexType: "GIN",
    operatorClass: "jsonb_path_ops",
    isPartial: false,
    storageOverheadPercent: 25,
  },
];

/**
 * Complete default search index configuration.
 * Optimized for 600,000 documents (6 lakh).
 */
export const DEFAULT_SEARCH_INDEX_CONFIG: SearchIndexConfig = {
  schemaVersion: "1.0.0",
  tableName: "documents",
  fields: DEFAULT_SEARCH_FIELDS,
  weights: DEFAULT_WEIGHT_CONFIG,
  ginIndexes: DEFAULT_GIN_INDEXES,
  maxDocumentCount: 600000,
  textSearchConfig: "english",
};

// ─────────────────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Validates that a SearchIndexField has consistent configuration.
 * Returns an array of validation error messages (empty if valid).
 */
export function validateSearchIndexField(field: SearchIndexField): string[] {
  const errors: string[] = [];

  if (!field.columnName || field.columnName.trim() === "") {
    errors.push("columnName is required");
  }

  if (!field.label || field.label.trim() === "") {
    errors.push("label is required");
  }

  const validWeights: TsvectorWeight[] = ["A", "B", "C", "D"];
  if (!validWeights.includes(field.weight)) {
    errors.push(`weight must be one of: ${validWeights.join(", ")}`);
  }

  if (field.supportsPrefixMatch && field.columnType === "jsonb") {
    errors.push("jsonb columns cannot support prefix matching");
  }

  return errors;
}

/**
 * Validates a complete SearchIndexConfig for consistency.
 * Returns an array of validation error messages (empty if valid).
 */
export function validateSearchIndexConfig(config: SearchIndexConfig): string[] {
  const errors: string[] = [];

  if (!config.schemaVersion) {
    errors.push("schemaVersion is required");
  }

  if (!config.tableName || config.tableName.trim() === "") {
    errors.push("tableName is required");
  }

  if (config.fields.length === 0) {
    errors.push("at least one field is required");
  }

  // Validate each field
  for (const field of config.fields) {
    const fieldErrors = validateSearchIndexField(field);
    for (const err of fieldErrors) {
      errors.push(`Field "${field.columnName}": ${err}`);
    }
  }

  // Validate weights reference valid fields
  const fieldNames = new Set(config.fields.map((f) => f.columnName));
  for (const weightConfig of config.weights) {
    for (const fieldName of weightConfig.fields) {
      if (!fieldNames.has(fieldName)) {
        errors.push(`Weight "${weightConfig.weight}" references unknown field "${fieldName}"`);
      }
    }
  }

  // Validate GIN indexes reference the correct table
  for (const index of config.ginIndexes) {
    if (index.tableName !== config.tableName) {
      errors.push(`Index "${index.indexName}" targets table "${index.tableName}" but config is for "${config.tableName}"`);
    }
    if (index.isPartial && !index.whereClause) {
      errors.push(`Partial index "${index.indexName}" must have a whereClause`);
    }
  }

  if (config.maxDocumentCount <= 0) {
    errors.push("maxDocumentCount must be positive");
  }

  return errors;
}

/**
 * Calculates the estimated total storage overhead for all GIN indexes.
 * Returns a percentage value.
 */
export function calculateStorageOverhead(config: SearchIndexConfig): number {
  return config.ginIndexes.reduce((sum, idx) => sum + idx.storageOverheadPercent, 0);
}

/**
 * Returns fields that are configured for a given tsvector weight.
 */
export function getFieldsByWeight(config: SearchIndexConfig, weight: TsvectorWeight): SearchIndexField[] {
  return config.fields.filter((f) => f.weight === weight && f.includeInTsvector);
}
