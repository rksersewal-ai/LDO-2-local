import type { SearchDocumentFacets, SearchResult, SearchScope } from "../lib/types";

export type { SearchResult };

import apiClient from "./ApiClient";
import { CaseService } from "./CaseService";
import { DocumentService } from "./DocumentService";
import { PLService } from "./PLService";
import { WorkLedgerService } from "./WorkLedgerService";

export interface CrossEntityResults {
  documents: SearchResult[];
  plItems: SearchResult[];
  work: SearchResult[];
  cases: SearchResult[];
  total: number;
  facets: SearchDocumentFacets;
}

export type DuplicateSearchFilter = "include" | "exclude" | "only";
export interface SearchFilterOptions {
  duplicateFilter?: DuplicateSearchFilter;
  source?: string;
  className?: string;
  hashStatus?: "present" | "full" | "missing" | "";
  plLinked?: "linked" | "unlinked" | "";
  statusFilters?: string[];
  dateRange?: "any" | "7d" | "30d" | "90d";
}

const EMPTY_FACETS: SearchDocumentFacets = {
  source_system: [],
  category: [],
  duplicate_status: [],
  ocr_status: [],
  hash_status: [],
  pl_linked: [],
};

function resolveFingerprintState(doc: any): SearchResult["fingerprintState"] {
  if (doc.file_hash) return "full";
  if (doc.fingerprint_3x64k) return "present";
  return "missing";
}

function contains(text: string | undefined | null, q: string): boolean {
  return Boolean(text?.toLowerCase().includes(q));
}

function snippet(text: string | undefined | null, query: string): string | undefined {
  if (!text) return undefined;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);

  if (matchIndex < 0) {
    return undefined;
  }

  const start = Math.max(0, matchIndex - 40);
  const end = Math.min(text.length, matchIndex + lowerQuery.length + 80);
  return `...${text.slice(start, end)}...`;
}

import {
  ApiCaseRecordSchema,
  ApiDocumentSchema,
  ApiPLItemSchema,
  ApiWorkRecordSchema,
} from "../lib/schemas";

function mapBackendResults(
  response: Awaited<ReturnType<typeof apiClient.search>>,
  query: string,
): CrossEntityResults {
  const documents = response.documents.map((rawDoc: unknown) => {
    const doc = ApiDocumentSchema.parse(rawDoc);
    return {
      type: "document" as const,
      id: String(doc.id),
      title: doc.name || doc.title || String(doc.id),
      subtitle: String(doc.id),
      status: doc.status || undefined,
      matchField: "Document",
      snippet: snippet(doc.extracted_text || doc.description, query),
      date: doc.updated_at || doc.created_at || doc.date || undefined,
      duplicateStatus: doc.duplicate_status || undefined,
      duplicateGroupKey: doc.duplicate_group_key || undefined,
      fingerprintState: resolveFingerprintState(doc),
      linkedPl: doc.linked_pl || undefined,
      matchReasons: Array.isArray(doc.match_reasons) ? doc.match_reasons : [],
      matchedAssertions: Array.isArray(doc.matched_assertions) ? doc.matched_assertions : [],
      matchedEntities: Array.isArray(doc.matched_entities) ? doc.matched_entities : [],
    };
  });

  const plItems = response.pl_items.map((rawItem: unknown) => {
    const item = ApiPLItemSchema.parse(rawItem);
    return {
      type: "pl" as const,
      id: String(item.id),
      title: item.name || item.title || String(item.id),
      subtitle: item.part_number || String(item.id),
      status: item.status || undefined,
      matchField: "PL Item",
      snippet: snippet(item.description, query),
      date: item.last_updated || item.updated_at || item.created_at || undefined,
    };
  });

  const work = response.work_records.map((rawRecord: unknown) => {
    const record = ApiWorkRecordSchema.parse(rawRecord);
    return {
      type: "work" as const,
      id: String(record.id),
      title: record.description || record.title || String(record.id),
      subtitle: record.eoffice_number || String(record.id),
      status: record.status || undefined,
      matchField: "Work Record",
      snippet: snippet(record.remarks || record.description, query),
      date: record.updated_at || record.created_at || record.date || undefined,
    };
  });

  const cases = response.cases.map((rawCaseRecord: unknown) => {
    const caseRecord = ApiCaseRecordSchema.parse(rawCaseRecord);
    return {
      type: "case" as const,
      id: String(caseRecord.id),
      title: caseRecord.title || caseRecord.name || String(caseRecord.id),
      subtitle: caseRecord.pl_reference || String(caseRecord.id),
      status: caseRecord.status || undefined,
      matchField: "Case",
      snippet: snippet(caseRecord.description || caseRecord.resolution, query),
      date:
        caseRecord.opened_at ||
        caseRecord.closed_at ||
        caseRecord.updated_at ||
        caseRecord.created_at ||
        undefined,
    };
  });

  return {
    documents,
    plItems,
    work,
    cases,
    total: response.total,
    facets: response.facets?.documents ?? EMPTY_FACETS,
  };
}

async function searchLocally(
  query: string,
  scope?: SearchScope,
  filters: SearchFilterOptions = {},
): Promise<CrossEntityResults> {
  const duplicateFilter = filters.duplicateFilter ?? "include";
  const normalizedStatuses = new Set(
    (filters.statusFilters ?? []).map((status) => status.trim()).filter(Boolean),
  );
  const dateRange = filters.dateRange ?? "any";
  const q = query.trim().toLowerCase();

  if (!q) {
    return {
      documents: [],
      plItems: [],
      work: [],
      cases: [],
      total: 0,
      facets: EMPTY_FACETS,
    };
  }

  const [docs, pls, works, cases] = await Promise.all([
    DocumentService.getAll(),
    PLService.getAll(),
    WorkLedgerService.getAll(),
    CaseService.getAll(),
  ]);

  const isWithinDateRange = (value: string | undefined | null) => {
    if (!value || dateRange === "any") return true;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return true;

    const maxDays = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
    return (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24) <= maxDays;
  };

  const matchesStatus = (value: string | undefined | null) => {
    if (normalizedStatuses.size === 0 || !value) return true;
    return (
      normalizedStatuses.has(value) ||
      normalizedStatuses.has(value.toUpperCase()) ||
      normalizedStatuses.has(value.toLowerCase()) ||
      normalizedStatuses.has(value.replace(/\b\w/g, (char) => char.toUpperCase()))
    );
  };

  const documents: SearchResult[] =
    !scope || scope === "ALL" || scope === "DOCUMENTS"
      ? docs
          .filter(
            (d) =>
              contains(d.documentNumber, q) ||
              contains(d.title, q) ||
              d.tags.some((t) => contains(t, q)) ||
              d.linkedPlNumbers.some((pl) => contains(pl, q)) ||
              contains(d.ocrText, q) ||
              contains(d.agency, q),
          )
          .filter(() => duplicateFilter !== "only")
          .filter((d) => matchesStatus(d.status))
          .filter((d) => isWithinDateRange(d.updatedAt || d.createdAt))
          .map((d) => ({
            type: "document" as const,
            id: d.id,
            title: d.title,
            subtitle: d.documentNumber,
            status: d.status,
            matchField: contains(d.ocrText, q)
              ? "OCR Text"
              : contains(d.title, q)
                ? "Title"
                : "Metadata",
            snippet: snippet(d.ocrText, q),
            date: d.updatedAt || d.createdAt,
            matchReasons: [],
            matchedAssertions: [],
            matchedEntities: [],
          }))
      : [];

  const plItems: SearchResult[] =
    !scope || scope === "ALL" || scope === "PL"
      ? pls
          .filter(
            (p) =>
              contains(p.plNumber, q) ||
              contains(p.name, q) ||
              contains(p.description, q) ||
              p.drawingNumbers.some((d) => contains(d, q)) ||
              p.specNumbers.some((s) => contains(s, q)),
          )
          .filter((p) => matchesStatus(p.status))
          .filter((p) => isWithinDateRange(p.updatedAt || p.createdAt))
          .map((p) => ({
            type: "pl" as const,
            id: p.id,
            title: p.name,
            subtitle: p.plNumber,
            status: p.status,
            matchField: contains(p.plNumber, q) ? "PL Number" : "Description",
            date: p.updatedAt || p.createdAt,
          }))
      : [];

  const work: SearchResult[] =
    !scope || scope === "ALL" || scope === "WORK"
      ? works
          .filter(
            (w) =>
              contains(w.id, q) ||
              contains(w.workType, q) ||
              contains(w.referenceNumber, q) ||
              contains(w.description, q) ||
              contains(w.plNumber, q) ||
              contains(w.eOfficeNumber, q) ||
              contains(w.userName, q),
          )
          .filter((w) => matchesStatus(w.status))
          .filter((w) => isWithinDateRange(w.createdAt || w.date))
          .map((w) => ({
            type: "work" as const,
            id: w.id,
            title: w.description,
            subtitle: w.id,
            status: w.status,
            matchField: contains(w.id, q)
              ? "Work ID"
              : contains(w.plNumber, q)
                ? "PL Number"
                : "Description",
            date: w.createdAt || w.date,
          }))
      : [];

  const caseResults: SearchResult[] =
    !scope || scope === "ALL" || scope === "CASES"
      ? cases
          .filter(
            (c) =>
              contains(c.caseNumber, q) ||
              contains(c.title, q) ||
              contains(c.plNumber, q) ||
              contains(c.type, q) ||
              contains(c.vendorName, q) ||
              contains(c.tenderNumber, q),
          )
          .filter((c) => matchesStatus(c.status))
          .filter((c) => isWithinDateRange(c.updatedAt || c.createdAt))
          .map((c) => ({
            type: "case" as const,
            id: c.id,
            title: c.title,
            subtitle: c.caseNumber,
            status: c.status,
            matchField: contains(c.caseNumber, q) ? "Case Number" : "Title",
            date: c.updatedAt || c.createdAt,
          }))
      : [];

  return {
    documents,
    plItems,
    work,
    cases: caseResults,
    total: documents.length + plItems.length + work.length + caseResults.length,
    facets: EMPTY_FACETS,
  };
}

export const SearchService = {
  async searchAll(
    query: string,
    scope?: SearchScope,
    signal?: AbortSignal,
    filters: SearchFilterOptions = {},
  ): Promise<CrossEntityResults> {
    const q = query.trim();

    if (!q) {
      return {
        documents: [],
        plItems: [],
        work: [],
        cases: [],
        total: 0,
        facets: EMPTY_FACETS,
      };
    }

    try {
      const response = await apiClient.search(q, scope, {
        signal,
        duplicates: filters.duplicateFilter,
        source: filters.source,
        className: filters.className,
        hashStatus: filters.hashStatus,
        plLinked: filters.plLinked,
        status: filters.statusFilters,
        dateRange: filters.dateRange,
      });
      return mapBackendResults(response, q);
    } catch (error) {
      if (
        (error instanceof DOMException && error.name === "AbortError") ||
        (typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ERR_CANCELED")
      ) {
        throw error;
      }

      if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_MOCK_API === "true") {
        return searchLocally(q, scope, filters);
      }

      throw error;
    }
  },
};
