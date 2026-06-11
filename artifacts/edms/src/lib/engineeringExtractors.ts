/**
 * Engineering Document Extractors
 *
 * Pure regex-based extraction functions for engineering document metadata.
 * Extracts drawing numbers, revision codes, PL numbers, and title block fields
 * from OCR text output.
 */

// ─────────────────────────────────────────────────────────────────────────
// Drawing Number Extraction
// ─────────────────────────────────────────────────────────────────────────

/**
 * Extracts drawing numbers from text.
 * Supported patterns:
 *  - DWG-XXXXX or DWG/XXXXX (alphanumeric)
 *  - SK-NNNNN (sketch numbers)
 *  - CLW/ED/... (workshop drawing codes)
 *  - RDSO/... (RDSO drawing references)
 *  - Numeric 5-6 digit prefixed patterns
 */
export function extractDrawingNumbers(text: string): string[] {
  if (!text) return [];

  const patterns: RegExp[] = [
    /\bDWG[-/]\d{4,6}\b/gi,
    /\bSK-\d{4,6}\b/gi,
    /\bCLW\/ED\/[A-Z0-9/-]+\b/gi,
    /\bRDSO\/[A-Z0-9/-]+\b/gi,
  ];

  const results: string[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const normalized = match.toUpperCase();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          results.push(match);
        }
      }
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────
// Revision Code Extraction
// ─────────────────────────────────────────────────────────────────────────

/**
 * Extracts revision codes from text.
 * Supported patterns:
 *  - REV A, REV B, REV 1, REV 2
 *  - Rev. 1, Rev. A
 *  - R01, R03 (compact form)
 *  - Revision 1, Revision A
 *  - -R1, -R2 suffix forms
 */
export function extractRevisions(text: string): string[] {
  if (!text) return [];

  const patterns: RegExp[] = [
    /\bREV\s+[A-Z]\b/gi,
    /\bREV\s+\d+\b/gi,
    /\bRev\.\s*[A-Z0-9]+\b/g,
    /\bR\d{2,3}\b/g,
    /\bRevision\s+\d+\b/gi,
    /\bRevision\s+[A-Z]\b/gi,
    /-R\d+\b/g,
  ];

  const results: string[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const normalized = match.toUpperCase().replace(/\s+/g, " ").trim();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          results.push(match);
        }
      }
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────
// PL Number Extraction
// ─────────────────────────────────────────────────────────────────────────

/**
 * Extracts 8-digit PL numbers from text.
 * Supported patterns:
 *  - 12345678 (standalone 8-digit number)
 *  - PL-12345678
 *  - PL 12345678
 */
export function extractPLNumbers(text: string): string[] {
  if (!text) return [];

  const pattern = /\bPL[-\s]?(\d{8})\b|\b(\d{8})\b/g;
  const results: string[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const number = match[1] || match[2];
    if (!seen.has(number)) {
      seen.add(number);
      results.push(number);
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────
// Title Block Field Extraction
// ─────────────────────────────────────────────────────────────────────────

export interface TitleBlockFields {
  title?: string;
  scale?: string;
  material?: string;
  drawnBy?: string;
  date?: string;
}

/**
 * Extracts title block fields from OCR text.
 * Looks for labeled fields commonly found in engineering drawing title blocks.
 */
export function extractTitleBlockFields(text: string): TitleBlockFields {
  if (!text) return {};

  const fields: TitleBlockFields = {};

  // Title extraction: "TITLE: ..." or "TITLE ..."
  const titleMatch = text.match(/\bTITLE[:\s]+(.+?)(?:\n|$)/i);
  if (titleMatch) {
    fields.title = titleMatch[1].trim();
  }

  // Scale extraction: "SCALE: 1:10" or "SCALE 1:10"
  const scaleMatch = text.match(/\bSCALE[:\s]+([^\n]+)/i);
  if (scaleMatch) {
    fields.scale = scaleMatch[1].trim();
  }

  // Material extraction: "MATERIAL: ..." or "MAT: ..."
  const materialMatch = text.match(/\b(?:MATERIAL|MAT)[:\s]+([^\n]+)/i);
  if (materialMatch) {
    fields.material = materialMatch[1].trim();
  }

  // Drawn by extraction: "DRAWN BY: ..." or "DRAWN: ..." or "DRN: ..."
  const drawnByMatch = text.match(/\b(?:DRAWN\s*BY|DRAWN|DRN)[:\s]+([^\n]+)/i);
  if (drawnByMatch) {
    fields.drawnBy = drawnByMatch[1].trim();
  }

  // Date extraction: "DATE: ..." or common date formats
  const dateMatch = text.match(/\bDATE[:\s]+([^\n]+)/i);
  if (dateMatch) {
    fields.date = dateMatch[1].trim();
  }

  return fields;
}
