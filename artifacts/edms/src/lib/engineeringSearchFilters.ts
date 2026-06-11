/**
 * Engineering-Specific Search Filters
 *
 * Type definitions and utilities for engineering document search filters.
 * Extends the base SearchFilterOptions with engineering-specific criteria
 * such as drawing number patterns, revision ranges, and confidence levels.
 */

import type { SearchFilterOptions } from "../services/SearchService";
import type { ConfidenceLevel } from "./ocrConfidenceScoring";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface EngineeringSearchFilter extends SearchFilterOptions {
  /** Regex pattern to match drawing numbers (e.g., "DWG-*", "SK-*") */
  drawingNumberPattern?: string;
  /** Filter by revision range (from and/or to) */
  revisionRange?: {
    from?: string;
    to?: string;
  };
  /** Filter by PL number or PL number pattern */
  plNumberFilter?: string;
  /** Minimum OCR confidence threshold for results */
  confidenceThreshold?: number;
  /** Filter by specific title block field value */
  titleBlockField?: {
    field: "title" | "scale" | "material" | "drawnBy" | "date";
    value: string;
  };
}

export interface FilterQuery {
  params: Record<string, string | number | boolean>;
  filters: EngineeringSearchFilter;
}

export interface FilterTemplate {
  name: string;
  description: string;
  filter: EngineeringSearchFilter;
}

// ─────────────────────────────────────────────────────────────────────────
// Filter Query Builder
// ─────────────────────────────────────────────────────────────────────────

/**
 * Builds a filter query object from an EngineeringSearchFilter.
 * Converts the filter definition into params suitable for API calls.
 */
export function buildFilterQuery(filter: EngineeringSearchFilter): FilterQuery {
  const params: Record<string, string | number | boolean> = {};

  if (filter.drawingNumberPattern) {
    params.drawing_number = filter.drawingNumberPattern;
  }

  if (filter.revisionRange) {
    if (filter.revisionRange.from) {
      params.revision_from = filter.revisionRange.from;
    }
    if (filter.revisionRange.to) {
      params.revision_to = filter.revisionRange.to;
    }
  }

  if (filter.plNumberFilter) {
    params.pl_number = filter.plNumberFilter;
  }

  if (filter.confidenceThreshold !== undefined) {
    params.min_confidence = filter.confidenceThreshold;
  }

  if (filter.titleBlockField) {
    params[`title_block_${filter.titleBlockField.field}`] = filter.titleBlockField.value;
  }

  // Include base SearchFilterOptions fields
  if (filter.duplicateFilter) {
    params.duplicate_filter = filter.duplicateFilter;
  }

  if (filter.source) {
    params.source = filter.source;
  }

  if (filter.className) {
    params.class_name = filter.className;
  }

  if (filter.hashStatus) {
    params.hash_status = filter.hashStatus;
  }

  if (filter.plLinked) {
    params.pl_linked = filter.plLinked;
  }

  if (filter.dateRange) {
    params.date_range = filter.dateRange;
  }

  return { params, filters: filter };
}

// ─────────────────────────────────────────────────────────────────────────
// Pre-defined Filter Templates
// ─────────────────────────────────────────────────────────────────────────

/**
 * Filter for DWG-series drawings only.
 */
export const FILTER_BY_DWG_SERIES: FilterTemplate = {
  name: "DWG Series",
  description: "Filter for DWG-prefixed drawing numbers",
  filter: {
    drawingNumberPattern: "DWG-",
  },
};

/**
 * Filter for SK-series sketch drawings.
 */
export const FILTER_BY_SK_SERIES: FilterTemplate = {
  name: "SK Series",
  description: "Filter for SK-prefixed sketch numbers",
  filter: {
    drawingNumberPattern: "SK-",
  },
};

/**
 * Filter for high-confidence OCR results only.
 */
export const FILTER_HIGH_CONFIDENCE: FilterTemplate = {
  name: "High Confidence",
  description: "Only show results with OCR confidence above 85%",
  filter: {
    confidenceThreshold: 85,
  },
};

/**
 * Filter for medium and above confidence OCR results.
 */
export const FILTER_MEDIUM_CONFIDENCE: FilterTemplate = {
  name: "Medium+ Confidence",
  description: "Show results with OCR confidence above 60%",
  filter: {
    confidenceThreshold: 60,
  },
};

/**
 * Filter for low-confidence results that may need review.
 */
export const FILTER_LOW_CONFIDENCE_REVIEW: FilterTemplate = {
  name: "Low Confidence (Review)",
  description: "Show results with OCR confidence below 60% that need manual review",
  filter: {
    confidenceThreshold: 0,
  },
};

/**
 * Filter for latest revisions only.
 */
export const FILTER_LATEST_REVISION: FilterTemplate = {
  name: "Latest Revision",
  description: "Filter for documents at their latest revision",
  filter: {
    statusFilters: ["ACTIVE"],
  },
};

/**
 * Filter for documents under revision review.
 */
export const FILTER_REVISION_UNDER_REVIEW: FilterTemplate = {
  name: "Under Review",
  description: "Filter for documents currently under revision review",
  filter: {
    statusFilters: ["UNDER_REVIEW"],
  },
};

/**
 * All pre-defined filter templates.
 */
export const ENGINEERING_FILTER_TEMPLATES: FilterTemplate[] = [
  FILTER_BY_DWG_SERIES,
  FILTER_BY_SK_SERIES,
  FILTER_HIGH_CONFIDENCE,
  FILTER_MEDIUM_CONFIDENCE,
  FILTER_LOW_CONFIDENCE_REVIEW,
  FILTER_LATEST_REVISION,
  FILTER_REVISION_UNDER_REVIEW,
];

/**
 * Utility to get a filter template by name.
 */
export function getFilterTemplate(name: string): FilterTemplate | undefined {
  return ENGINEERING_FILTER_TEMPLATES.find((t) => t.name === name);
}

/**
 * Utility to apply a confidence level as a filter threshold.
 */
export function confidenceLevelToFilter(level: ConfidenceLevel): EngineeringSearchFilter {
  switch (level) {
    case "HIGH":
      return { confidenceThreshold: 85 };
    case "MEDIUM":
      return { confidenceThreshold: 60 };
    case "LOW":
      return { confidenceThreshold: 0 };
  }
}
