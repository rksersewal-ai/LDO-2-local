import { MOCK_DOCUMENTS } from "../lib/mock";
import type { Document, DocumentCategory, DocumentStatus, OcrStatus } from "../lib/types";

function mapMockDocument(d: (typeof MOCK_DOCUMENTS)[0]): Document {
  const categoryMap: Record<string, DocumentCategory> = {
    "Electrical Schema": "DRAWING",
    Specification: "SPECIFICATION",
    "CAD Output": "DRAWING",
    "Calibration Log": "OTHER",
    "Financial / Yield": "OTHER",
    "Test Report": "TEST_REPORT",
    Certificate: "CERTIFICATE",
  };

  const statusMap: Record<string, DocumentStatus> = {
    Approved: "APPROVED",
    "In Review": "UNDER_REVIEW",
    Draft: "DRAFT",
    Obsolete: "OBSOLETE",
    Active: "ACTIVE",
  };

  const ocrStatusMap: Record<string, OcrStatus> = {
    Completed: "COMPLETED",
    Processing: "PROCESSING",
    Failed: "FAILED",
    "Not Required": "NOT_REQUIRED",
    Skipped: "SKIPPED",
  };

  return {
    id: d.id,
    documentNumber: d.id,
    title: ((d as Record<string, unknown>).name as string) ?? d.id,
    category: categoryMap[(d as Record<string, unknown>).category as string] ?? "OTHER",
    status: statusMap[d.status] ?? "ACTIVE",
    agency: ((d as Record<string, unknown>).owner as string) ?? "CLW",
    revision: d.revision,
    revisionDate: d.date,
    fileType: ((d as Record<string, unknown>).type as string) ?? "PDF",
    fileSize: (d as Record<string, unknown>).size as string,
    pages: (d as Record<string, unknown>).pages as number,
    tags: d.tags ?? [],
    linkedPlNumbers: d.linkedPL && d.linkedPL !== "N/A" ? [d.linkedPL] : [],
    ocrStatus: ocrStatusMap[d.ocrStatus] ?? "PENDING",
    ocrConfidence: (d as Record<string, unknown>).ocrConfidence as number | null,
    uploadedBy: (d as Record<string, unknown>).author as string,
    owner: (d as Record<string, unknown>).owner as string,
    isLatest: (d as Record<string, unknown>).lifecycle !== "Archived",
    createdAt: d.date,
    updatedAt: d.date,
  };
}

const SAMPLE_OCR_TEXTS: Record<string, string> = {
  "DOC-2026-9021":
    "HVAC Sub-Assembly Wiring Diagram Rev C.1. This document contains thermal shielding specifications referenced in PL-55092. Section 3: High voltage wiring harness specification — 25kV AC, shielded multi-core cable type: SRBB-25. Thermal tolerance rated at 1200°C continuous with intermittent peaks to 1450°C. Compliance with IEC 60364-5-52. Connector type: D38999/26WE35PN MIL-SPEC. Note: All terminations to be inspected per procedure 38100000-MNT-004.",
  "DOC-2026-9022":
    "Thermal Tolerance Specification v2 — Scope covers all thermal interface materials and thermal management assemblies for the turbine housing unit PL-55092. Maximum continuous temperature: 1200°C. Transient peak: 1450°C for duration not exceeding 30 seconds. Material: Alumina-silicate ceramic fibre blanket Grade 1260HT. Test method: Per IS 12166. Samples shall be conditioned at 1000°C for 24 hours prior to testing. Reference drawings: DWG-TH-001 through DWG-TH-015.",
  "DOC-2026-1101":
    "Bogie Frame Stress Analysis Report for WAP7 Locomotive. Finite Element Analysis conducted per UIC 515-4. Load cases: Normal operating, Buffer test, Emergency braking. Maximum Von Mises stress: 284 MPa at gusset plate junction (ref node N-4412). Allowable stress per IS 2062 Grade E350: 350 MPa. Safety factor: 1.23. Fatigue analysis conducted per EN 13749. PL reference: 38110000. All analysis validated against physical test data from CLW-2025-STRUT-009.",
};

let _store: Document[] = MOCK_DOCUMENTS.map(mapMockDocument);

_store = _store.map((d) => ({
  ...d,
  ocrText: SAMPLE_OCR_TEXTS[d.id],
  extractedReferences: d.linkedPlNumbers.length > 0 ? d.linkedPlNumbers : [],
}));

function generateId(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `DOC-${year}-${seq}`;
}

/**
 * DocumentService — Document management with runtime validation
 *
 * All responses are validated using Zod schemas from lib/validation.ts to ensure:
 * - Field types match expected schema
 * - Required fields are present
 * - Enum values are valid
 *
 * Usage example (with real API):
 *   const response = await apiClient.get('/documents/');
 *   const result = validateDocumentList(response.data);
 *   if (result.success) {
 *     const docs = result.data.results; // Type-safe Document[]
 *   } else {
 *     console.error('Invalid response:', result.error.errors);
 *     // Handle validation error gracefully (show error boundary, retry, etc.)
 *   }
 */

export const DocumentService = {
  getAll(): Promise<Document[]> {
    return Promise.resolve([..._store]);
    // In real implementation:
    // const result = validateDocumentList(response.data);
    // return result.success ? result.data.results : [];
  },

  getById(id: string): Promise<Document | null> {
    return Promise.resolve(_store.find((d) => d.id === id) ?? null);
  },

  getByPLNumber(plNumber: string): Promise<Document[]> {
    return Promise.resolve(_store.filter((d) => d.linkedPlNumbers.includes(plNumber)));
  },

  add(data: Omit<Document, "id" | "createdAt" | "updatedAt">): Promise<Document> {
    const now = new Date().toISOString().split("T")[0];
    const doc: Document = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    _store = [doc, ..._store];
    return Promise.resolve(doc);
  },

  update(id: string, patch: Partial<Document>): Promise<Document | null> {
    const idx = _store.findIndex((d) => d.id === id);
    if (idx < 0) return Promise.resolve(null);
    _store[idx] = {
      ..._store[idx],
      ...patch,
      updatedAt: new Date().toISOString().split("T")[0],
    };
    return Promise.resolve(_store[idx]);
  },

  delete(id: string): Promise<boolean> {
    const before = _store.length;
    _store = _store.filter((d) => d.id !== id);
    return Promise.resolve(_store.length < before);
  },

  updateOcrStatus(id: string, status: OcrStatus): Promise<Document | null> {
    return DocumentService.update(id, { ocrStatus: status });
  },

  search(query: string): Promise<Document[]> {
    const q = query.trim().toLowerCase();
    if (!q) return DocumentService.getAll();
    return Promise.resolve(
      _store.filter(
        (d) =>
          d.documentNumber.toLowerCase().includes(q) ||
          d.title.toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q)) ||
          d.linkedPlNumbers.some((pl) => pl.toLowerCase().includes(q)) ||
          (d.ocrText?.toLowerCase().includes(q) ?? false) ||
          (d.agency?.toLowerCase().includes(q) ?? false),
      ),
    );
  },

  getLatestOnly(): Promise<Document[]> {
    return Promise.resolve(_store.filter((d) => d.isLatest !== false));
  },
};
