import {
  type DedupDecision,
  type DedupDecisionLogEntry,
  type DedupMode,
  DUPLICATE_GROUPS,
  type DuplicateCandidateDocument,
  type DuplicateGroup,
  type GroupStatus,
} from "../lib/deduplicationMock";
import apiClient from "./ApiClient";

type BackendDocument = {
  id: string;
  name?: string;
  title?: string;
  description?: string | null;
  type?: string;
  category?: string | null;
  status?: string;
  revision?: number;
  size?: number;
  source_system?: string;
  external_file_path?: string | null;
  source_modified_at?: string | null;
  source_created_at?: string | null;
  fingerprint_3x64k?: string | null;
  file_hash?: string | null;
  hash_indexed_at?: string | null;
  duplicate_status?: string;
  duplicate_group_key?: string | null;
  duplicate_marked_at?: string | null;
  linked_pl?: string | null;
  search_metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  author?: string | number | null;
};

export interface DeduplicationLoadResult {
  groups: DuplicateGroup[];
  source: "backend" | "mock";
  summary: string;
}

interface BackendDuplicateGroup {
  group_key: string;
  decision_status?: string;
  decision?: string;
  master_document_id?: string | null;
  document_count?: number;
  total_bytes?: number;
  potential_savings_bytes?: number;
  source_systems?: string[];
  categories?: string[];
  hash_status?: Record<string, number>;
  approved_assertions?: Array<{ field_key?: string; values?: string[] }>;
  conflicting_entities?: Array<{ entity_type?: string; values?: string[] }>;
  documents: BackendDocument[];
}

function asArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeDate(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function toLabel(value?: string | null) {
  if (!value) return "Unclassified";
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function mapCategoryToCollection(category?: string | null) {
  const normalized = (category ?? "").toUpperCase();
  if (normalized.includes("DRAWING")) return "Electrical Drawings";
  if (normalized.includes("VENDOR")) return "Vendor Qualifications";
  if (normalized.includes("SPEC")) return "Control Specifications";
  if (normalized.includes("PROCEDURE")) return "Maintenance Procedures";
  return "All collections";
}

function mapSourceSystem(value?: string | null) {
  const normalized = (value ?? "").toUpperCase();
  if (normalized === "FILE_SHARE" || normalized === "NETWORK_SHARE") return "File share";
  if (normalized === "SCANNER") return "Scanner";
  if (normalized === "EMAIL") return "Email";
  if (normalized === "IMPORT") return "Import";
  return "File share";
}

function buildMetadataKey(document: BackendDocument) {
  return [
    document.id,
    document.name ?? document.title ?? "",
    String(document.revision ?? ""),
    String(document.size ?? 0),
    document.category ?? "",
  ]
    .filter(Boolean)
    .join("|");
}

function getFingerprintState(
  document: BackendDocument,
): DuplicateCandidateDocument["fingerprintState"] {
  if (document.file_hash) return "full";
  if (document.fingerprint_3x64k) return "present";
  return "missing";
}

function getPatternHits(document: BackendDocument, key: string) {
  const patterns =
    document.search_metadata && typeof document.search_metadata === "object"
      ? (document.search_metadata as { patterns?: Record<string, unknown> }).patterns
      : undefined;
  return asArray(patterns?.[key]);
}

function mapDocumentToCandidate(document: BackendDocument): DuplicateCandidateDocument {
  const drawingNumbers = getPatternHits(document, "drawing_numbers");
  const partNumbers = getPatternHits(document, "pl_numbers");
  const uploadDate =
    normalizeDate(document.source_modified_at) ||
    normalizeDate(document.source_created_at) ||
    normalizeDate(document.updated_at) ||
    normalizeDate(document.created_at);

  return {
    id: String(document.id),
    title: document.title ?? document.name ?? String(document.id),
    documentNumber: String(document.id),
    drawingNumber: drawingNumbers[0],
    partNumber: document.linked_pl ?? partNumbers[0],
    revision: `Rev ${document.revision ?? 1}`,
    className: toLabel(document.category),
    type: document.type ?? "Unknown",
    fileSizeBytes: Number(document.size ?? 0),
    metadataKey: buildMetadataKey(document),
    fingerprintState: getFingerprintState(document),
    uploadDate: uploadDate || new Date().toISOString().slice(0, 10),
    uploader: typeof document.author === "string" ? document.author : "System",
    owner: typeof document.author === "string" ? document.author : "System",
    sourceSystem: mapSourceSystem(document.source_system),
    repository: "LDO Repository",
    collection: mapCategoryToCollection(document.category),
    plant: "All plants",
    references: {
      erp: 0,
      work: 0,
      config: document.linked_pl ? 1 : 0,
      approvals: 0,
    },
    isArchived: (document.status ?? "").toUpperCase() === "OBSOLETE",
    isFullHashRequired: Boolean(document.file_hash),
  };
}

function pickSuggestedMaster(documents: BackendDocument[]) {
  return [...documents].sort((left, right) => {
    const leftScore = left.duplicate_status === "MASTER" ? 1 : 0;
    const rightScore = right.duplicate_status === "MASTER" ? 1 : 0;
    if (leftScore !== rightScore) return rightScore - leftScore;
    return String(right.source_modified_at ?? right.updated_at ?? "").localeCompare(
      String(left.source_modified_at ?? left.updated_at ?? ""),
    );
  })[0];
}

function buildDecisionLog(documents: BackendDocument[]): DedupDecisionLogEntry[] {
  const logs = documents.flatMap((document) => {
    const entries: DedupDecisionLogEntry[] = [];
    if (document.hash_indexed_at) {
      entries.push({
        at: document.hash_indexed_at,
        actor: "edms.indexer",
        action: "Fingerprint indexed",
        note: "Search metadata and duplicate fingerprints were refreshed from stored document metadata.",
      });
    }
    if (document.duplicate_marked_at) {
      entries.push({
        at: document.duplicate_marked_at,
        actor: "edms.dedup",
        action: "Duplicate group marked",
        note: `${document.id} was classified as ${document.duplicate_status?.toLowerCase() ?? "duplicate-related"} by the backend dedup pipeline.`,
      });
    }
    return entries;
  });

  return logs.sort((left, right) => String(right.at).localeCompare(String(left.at))).slice(0, 5);
}

function deriveGroupStatus(
  groupKey: string,
  candidates: DuplicateCandidateDocument[],
): GroupStatus {
  if (groupKey.startsWith("full:")) return "exact";
  if (candidates.some((document) => document.fingerprintState === "missing")) return "pending";
  return "probable";
}

function deriveRisks(
  documents: BackendDocument[],
  candidates: DuplicateCandidateDocument[],
  status: GroupStatus,
) {
  const risks: string[] = [];
  const revisions = new Set(documents.map((document) => document.revision ?? 1));
  if (revisions.size > 1) {
    risks.push(
      "Multiple revisions are present in the same duplicate family; verify that release lineage remains intact.",
    );
  }
  if (candidates.some((candidate) => candidate.isArchived)) {
    risks.push(
      "At least one candidate is obsolete/archived and should be hidden rather than deleted.",
    );
  }
  if (status !== "exact") {
    risks.push(
      "This group should be treated as review-first because full-file confirmation is not available for every candidate.",
    );
  }
  if (!risks.length) {
    risks.push(
      "Stored metadata and fingerprints agree across this group; confirm links before applying a destructive decision.",
    );
  }
  return risks;
}

function toGroupId(index: number) {
  return `G-${String(index + 1).padStart(6, "0")}`;
}

function buildGroupFromDocuments(
  groupKey: string,
  documents: BackendDocument[],
  index: number,
): DuplicateGroup {
  const candidates = documents.map(mapDocumentToCandidate);
  const suggestedMaster = pickSuggestedMaster(documents);
  const status = deriveGroupStatus(groupKey, candidates);
  const collection = candidates[0]?.collection ?? "All collections";
  const dates = candidates
    .map((candidate) => candidate.uploadDate)
    .filter(Boolean)
    .sort();

  return {
    id: toGroupId(index),
    repository: "LDO Repository",
    collection,
    plant: "All plants",
    classSummary: Array.from(new Set(candidates.map((candidate) => candidate.className))),
    dateRange: {
      start: dates[0] ?? "",
      end: dates[dates.length - 1] ?? "",
    },
    documents: candidates.sort((left, right) => right.uploadDate.localeCompare(left.uploadDate)),
    status,
    potentialSavingsBytes: Math.max(
      candidates.reduce((sum, candidate) => sum + candidate.fileSizeBytes, 0) -
        Math.max(...candidates.map((candidate) => candidate.fileSizeBytes), 0),
      0,
    ),
    suggestedMasterId: String(suggestedMaster.id),
    dedupModeUsed:
      groupKey.startsWith("full:") || groupKey.startsWith("sparse:")
        ? "fingerprint"
        : ("metadata" as DedupMode),
    risks: deriveRisks(documents, candidates, status),
    notes:
      "Loaded from stored duplicate metadata and indexed fingerprints already present on the document records.",
    decisionLog: buildDecisionLog(documents),
  };
}

function mapBackendGroup(group: BackendDuplicateGroup, index: number): DuplicateGroup {
  const base = buildGroupFromDocuments(group.group_key, group.documents ?? [], index);
  const categories =
    Array.isArray(group.categories) && group.categories.length > 0
      ? group.categories.map(toLabel)
      : base.classSummary;
  const sources =
    Array.isArray(group.source_systems) && group.source_systems.length > 0
      ? group.source_systems.map(mapSourceSystem).join(", ")
      : undefined;

  return {
    ...base,
    id: group.group_key,
    classSummary: categories,
    potentialSavingsBytes: Number(group.potential_savings_bytes ?? base.potentialSavingsBytes),
    suggestedMasterId: group.master_document_id ?? base.suggestedMasterId,
    notes:
      group.decision_status && group.decision_status !== "PENDING"
        ? `${base.notes} Current decision state: ${group.decision_status.toLowerCase()}.`
        : base.notes,
    risks: sources ? [...base.risks, `Sources involved: ${sources}.`] : base.risks,
    approvedAssertions: Array.isArray(group.approved_assertions)
      ? group.approved_assertions
          .filter((item) => item.field_key)
          .map((item) => ({
            fieldKey: String(item.field_key),
            values: Array.isArray(item.values) ? item.values.map(String) : [],
          }))
      : [],
    conflictingEntities: Array.isArray(group.conflicting_entities)
      ? group.conflicting_entities
          .filter((item) => item.entity_type)
          .map((item) => ({
            entityType: String(item.entity_type),
            values: Array.isArray(item.values) ? item.values.map(String) : [],
          }))
      : [],
  };
}

async function fetchDuplicateDocuments(signal?: AbortSignal) {
  const documents: BackendDocument[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 10) {
    const response = await apiClient.getDocuments(
      {
        page,
        pageSize: 200,
        filters: { duplicates: "only" },
      },
      { signal },
    );

    documents.push(...(response.items as unknown as BackendDocument[]));
    hasMore = response.hasMore;
    page += 1;
  }

  return documents;
}

function buildGroups(documents: BackendDocument[]) {
  const grouped = new Map<string, BackendDocument[]>();

  for (const document of documents) {
    const key = document.duplicate_group_key ?? "";
    if (!key) continue;
    const bucket = grouped.get(key) ?? [];
    bucket.push(document);
    grouped.set(key, bucket);
  }

  return Array.from(grouped.entries())
    .filter(([, docs]) => docs.length > 1)
    .sort((left, right) => right[1].length - left[1].length)
    .map(([groupKey, docs], index) => buildGroupFromDocuments(groupKey, docs, index));
}

export const DeduplicationService = {
  async getCandidateGroups(signal?: AbortSignal): Promise<DeduplicationLoadResult> {
    try {
      const backendGroups = await apiClient.getDeduplicationGroups(undefined, {
        signal,
      });
      const groups = (backendGroups as unknown as BackendDuplicateGroup[]).map((group, index) =>
        mapBackendGroup(group, index),
      );
      if (groups.length > 0) {
        return {
          groups,
          source: "backend",
          summary: `Loaded ${groups.length} duplicate groups from backend deduplication groups and stored fingerprints.`,
        };
      }

      const documents = await fetchDuplicateDocuments(signal);
      const groupedDocuments = buildGroups(documents);
      if (groupedDocuments.length > 0) {
        return {
          groups: groupedDocuments,
          source: "backend",
          summary: `Loaded ${groupedDocuments.length} duplicate groups from indexed document metadata and stored fingerprints.`,
        };
      }
    } catch (error) {
      console.warn(
        "[DeduplicationService] Backend duplicate lookup failed, using fallback console dataset.",
        error,
      );
    }

    return {
      groups: DUPLICATE_GROUPS,
      source: "mock",
      summary:
        "Using the console fallback dataset because the backend duplicate queue is not populated yet.",
    };
  },

  async applyDecision(
    groupKey: string,
    payload: {
      decision: DedupDecision;
      masterDocumentId?: string;
      notes?: string;
    },
  ) {
    if (payload.decision === "ignore_for_now") {
      return apiClient.ignoreDeduplicationGroup(groupKey, {
        notes: payload.notes,
      });
    }

    return apiClient.applyDeduplicationDecision(groupKey, {
      decision: "MERGE",
      master_document_id: payload.masterDocumentId,
      notes: payload.notes,
    });
  },

  async queueMissingHashes() {
    return apiClient.createHashBackfillJob({
      batch_size: 500,
      parameters: { reason: "dedup-console-scan-missing-hashes" },
    });
  },
};
