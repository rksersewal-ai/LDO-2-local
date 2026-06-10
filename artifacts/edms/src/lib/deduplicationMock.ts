export type DedupMode = "metadata" | "fingerprint";
export type GroupStatus = "exact" | "probable" | "pending";
export type FingerprintState = "present" | "missing" | "full";
export type DedupDecision = "hide_duplicates" | "merge_metadata" | "ignore_for_now";

export interface DedupReferenceSummary {
  erp: number;
  work: number;
  config: number;
  approvals: number;
}

export interface DuplicateCandidateDocument {
  id: string;
  title: string;
  documentNumber: string;
  drawingNumber?: string;
  partNumber?: string;
  revision: string;
  className: string;
  type: string;
  fileSizeBytes: number;
  metadataKey: string;
  fingerprintState: FingerprintState;
  uploadDate: string;
  uploader: string;
  owner: string;
  sourceSystem: string;
  repository: string;
  collection: string;
  plant: string;
  references: DedupReferenceSummary;
  isArchived?: boolean;
  isFullHashRequired?: boolean;
}

export interface DedupDecisionLogEntry {
  at: string;
  actor: string;
  action: string;
  note: string;
}

export interface DuplicateGroup {
  id: string;
  repository: string;
  collection: string;
  plant: string;
  classSummary: string[];
  dateRange: {
    start: string;
    end: string;
  };
  documents: DuplicateCandidateDocument[];
  status: GroupStatus;
  potentialSavingsBytes: number;
  suggestedMasterId: string;
  dedupModeUsed: DedupMode;
  risks: string[];
  notes: string;
  decisionLog: DedupDecisionLogEntry[];
  approvedAssertions?: Array<{
    fieldKey: string;
    values: string[];
  }>;
  conflictingEntities?: Array<{
    entityType: string;
    values: string[];
  }>;
}

export const DEDUP_CLASS_OPTIONS = [
  "Drawings",
  "Specifications",
  "Vendor docs",
  "Procedures",
  "Certificates",
  "Test Reports",
] as const;

export const DEDUP_SOURCE_SYSTEM_OPTIONS = ["File share", "Import", "Scanner", "Email"] as const;

export const DEDUP_OWNER_OPTIONS = [
  "A. Rao",
  "M. Khanna",
  "P. Sen",
  "Quality Cell",
  "Vendor Development",
  "Design Office",
] as const;

export const DEDUP_MIN_SIZE_OPTIONS = [
  { label: "> 64 KB", bytes: 64 * 1024 },
  { label: "> 1 MB", bytes: 1024 * 1024 },
  { label: "> 10 MB", bytes: 10 * 1024 * 1024 },
] as const;

export const DUPLICATE_GROUPS: DuplicateGroup[] = [
  {
    id: "G-000123",
    repository: "LDO Repository",
    collection: "Electrical Drawings",
    plant: "BLW / Varanasi",
    classSummary: ["Drawings", "Vendor docs"],
    dateRange: { start: "2026-01-10", end: "2026-02-18" },
    status: "exact",
    potentialSavingsBytes: 58458112,
    suggestedMasterId: "DOC-2026-9301",
    dedupModeUsed: "fingerprint",
    risks: [
      "Two documents are archived copies of the same released revision.",
      "One duplicate is referenced in an old approval pack and should be hidden, not deleted.",
    ],
    notes:
      "Operations requested the master to remain the design-office upload because it carries the cleanest approval lineage.",
    decisionLog: [
      {
        at: "2026-03-09 11:12",
        actor: "records.admin",
        action: "Fingerprint confirmed",
        note: "Sparse fingerprint matched all four files; one full-file hash was already present.",
      },
    ],
    documents: [
      {
        id: "DOC-2026-9301",
        title: "Brake Cylinder Seal Arrangement",
        documentNumber: "DRW-38111000-BCS-01",
        drawingNumber: "BCS-38111000-01",
        partNumber: "38111000",
        revision: "D.2",
        className: "Drawings",
        type: "PDF",
        fileSizeBytes: 19496960,
        metadataKey: "38111000|Brake Cylinder Seal Arrangement|D.2|19496960",
        fingerprintState: "full",
        uploadDate: "2026-02-18",
        uploader: "A. Rao",
        owner: "Design Office",
        sourceSystem: "File share",
        repository: "LDO Repository",
        collection: "Electrical Drawings",
        plant: "BLW / Varanasi",
        references: { erp: 9, work: 5, config: 13, approvals: 2 },
        isFullHashRequired: true,
      },
      {
        id: "DOC-2026-9302",
        title: "Brake Cylinder Seal Arrangement",
        documentNumber: "DRW-38111000-BCS-01",
        drawingNumber: "BCS-38111000-01",
        partNumber: "38111000",
        revision: "D.2",
        className: "Drawings",
        type: "PDF",
        fileSizeBytes: 19496960,
        metadataKey: "38111000|Brake Cylinder Seal Arrangement|D.2|19496960",
        fingerprintState: "present",
        uploadDate: "2026-02-14",
        uploader: "P. Sen",
        owner: "Quality Cell",
        sourceSystem: "Scanner",
        repository: "LDO Repository",
        collection: "Electrical Drawings",
        plant: "BLW / Varanasi",
        references: { erp: 1, work: 1, config: 0, approvals: 1 },
      },
      {
        id: "DOC-2026-9303",
        title: "Brake Cylinder Seal Arrangement",
        documentNumber: "DRW-38111000-BCS-01",
        drawingNumber: "BCS-38111000-01",
        partNumber: "38111000",
        revision: "D.2",
        className: "Vendor docs",
        type: "PDF",
        fileSizeBytes: 19496960,
        metadataKey: "38111000|Brake Cylinder Seal Arrangement|D.2|19496960",
        fingerprintState: "present",
        uploadDate: "2026-01-27",
        uploader: "M. Khanna",
        owner: "Vendor Development",
        sourceSystem: "Import",
        repository: "LDO Repository",
        collection: "Electrical Drawings",
        plant: "BLW / Varanasi",
        references: { erp: 3, work: 0, config: 1, approvals: 0 },
        isArchived: true,
      },
    ],
  },
  {
    id: "G-000124",
    repository: "LDO Repository",
    collection: "Vendor Qualifications",
    plant: "CLW / Chittaranjan",
    classSummary: ["Vendor docs", "Certificates"],
    dateRange: { start: "2025-11-05", end: "2026-03-03" },
    status: "probable",
    potentialSavingsBytes: 12058624,
    suggestedMasterId: "DOC-2026-9311",
    dedupModeUsed: "metadata",
    risks: [
      "Only metadata currently matches; two files still need sparse fingerprints.",
      "Vendor qualification packs often bundle annexures with the same title but different attachments.",
    ],
    notes:
      "Keep review conservative until missing fingerprints are scanned for the imported copies.",
    decisionLog: [
      {
        at: "2026-03-12 09:08",
        actor: "quality.admin",
        action: "Pending review",
        note: "Grouped by supplier code, title, revision, and near-identical file size.",
      },
    ],
    documents: [
      {
        id: "DOC-2026-9311",
        title: "Vendor Qualification Pack – Axle Bearing Supplier",
        documentNumber: "VDQ-AB-7781",
        partNumber: "38130000",
        revision: "A.1",
        className: "Vendor docs",
        type: "PDF",
        fileSizeBytes: 6291456,
        metadataKey: "38130000|Vendor Qualification Pack – Axle Bearing Supplier|A.1|6291456",
        fingerprintState: "present",
        uploadDate: "2026-03-03",
        uploader: "M. Khanna",
        owner: "Vendor Development",
        sourceSystem: "Email",
        repository: "LDO Repository",
        collection: "Vendor Qualifications",
        plant: "CLW / Chittaranjan",
        references: { erp: 6, work: 2, config: 0, approvals: 3 },
      },
      {
        id: "DOC-2026-9312",
        title: "Vendor Qualification Pack – Axle Bearing Supplier",
        documentNumber: "VDQ-AB-7781",
        partNumber: "38130000",
        revision: "A.1",
        className: "Vendor docs",
        type: "PDF",
        fileSizeBytes: 6324224,
        metadataKey: "38130000|Vendor Qualification Pack – Axle Bearing Supplier|A.1|6324224",
        fingerprintState: "missing",
        uploadDate: "2026-02-26",
        uploader: "P. Sen",
        owner: "Quality Cell",
        sourceSystem: "Import",
        repository: "LDO Repository",
        collection: "Vendor Qualifications",
        plant: "CLW / Chittaranjan",
        references: { erp: 1, work: 0, config: 0, approvals: 0 },
      },
      {
        id: "DOC-2026-9313",
        title: "Vendor Qualification Pack – Axle Bearing Supplier",
        documentNumber: "VDQ-AB-7781",
        partNumber: "38130000",
        revision: "A.1",
        className: "Certificates",
        type: "PDF",
        fileSizeBytes: 6299648,
        metadataKey: "38130000|Vendor Qualification Pack – Axle Bearing Supplier|A.1|6299648",
        fingerprintState: "missing",
        uploadDate: "2025-11-05",
        uploader: "A. Rao",
        owner: "Vendor Development",
        sourceSystem: "File share",
        repository: "LDO Repository",
        collection: "Vendor Qualifications",
        plant: "CLW / Chittaranjan",
        references: { erp: 2, work: 1, config: 0, approvals: 1 },
        isArchived: true,
      },
    ],
  },
  {
    id: "G-000125",
    repository: "LDO Repository",
    collection: "Control Specifications",
    plant: "ICF / Chennai",
    classSummary: ["Specifications"],
    dateRange: { start: "2026-02-01", end: "2026-03-19" },
    status: "pending",
    potentialSavingsBytes: 9502720,
    suggestedMasterId: "DOC-2026-9322",
    dedupModeUsed: "fingerprint",
    risks: [
      "Revisions B.3 and B.4 are mixed in the same candidate set.",
      "Configuration links point to two active BOM items, so merge requires master confirmation.",
    ],
    notes:
      "Pending confirmation because metadata is close but the latest revision may supersede an older released interface spec.",
    decisionLog: [
      {
        at: "2026-03-19 16:44",
        actor: "records.admin",
        action: "Needs confirmation",
        note: "Sparse fingerprints differ slightly; full hash recommended only if the group is promoted for action.",
      },
    ],
    documents: [
      {
        id: "DOC-2026-9321",
        title: "HV Control Cabinet Interface Specification",
        documentNumber: "SPC-HVCC-204",
        partNumber: "38140000",
        revision: "B.3",
        className: "Specifications",
        type: "PDF",
        fileSizeBytes: 9502720,
        metadataKey: "38140000|HV Control Cabinet Interface Specification|B.3|9502720",
        fingerprintState: "present",
        uploadDate: "2026-02-01",
        uploader: "A. Rao",
        owner: "Design Office",
        sourceSystem: "File share",
        repository: "LDO Repository",
        collection: "Control Specifications",
        plant: "ICF / Chennai",
        references: { erp: 0, work: 3, config: 8, approvals: 1 },
      },
      {
        id: "DOC-2026-9322",
        title: "HV Control Cabinet Interface Specification",
        documentNumber: "SPC-HVCC-204",
        partNumber: "38140000",
        revision: "B.4",
        className: "Specifications",
        type: "PDF",
        fileSizeBytes: 9502720,
        metadataKey: "38140000|HV Control Cabinet Interface Specification|B.4|9502720",
        fingerprintState: "full",
        uploadDate: "2026-03-19",
        uploader: "P. Sen",
        owner: "Design Office",
        sourceSystem: "Email",
        repository: "LDO Repository",
        collection: "Control Specifications",
        plant: "ICF / Chennai",
        references: { erp: 1, work: 2, config: 12, approvals: 2 },
        isFullHashRequired: true,
      },
    ],
  },
  {
    id: "G-000126",
    repository: "LDO Repository",
    collection: "Maintenance Procedures",
    plant: "RWF / Bengaluru",
    classSummary: ["Procedures"],
    dateRange: { start: "2025-09-11", end: "2026-03-08" },
    status: "exact",
    potentialSavingsBytes: 13893632,
    suggestedMasterId: "DOC-2026-9331",
    dedupModeUsed: "fingerprint",
    risks: [
      "One archived maintenance pack is still referenced by a closed work record.",
      "No revision mismatch; safe to hide archived copies after note capture.",
    ],
    notes:
      "Recommended action is hide duplicates and keep the newest design-office upload as master.",
    decisionLog: [
      {
        at: "2026-03-08 08:55",
        actor: "records.admin",
        action: "Exact duplicate",
        note: "Fingerprints and file size match; archived copy can be hidden after link review.",
      },
    ],
    documents: [
      {
        id: "DOC-2026-9331",
        title: "Door Controller Commissioning Procedure",
        documentNumber: "PROC-DC-441",
        partNumber: "38150000",
        revision: "C.0",
        className: "Procedures",
        type: "PDF",
        fileSizeBytes: 6946816,
        metadataKey: "38150000|Door Controller Commissioning Procedure|C.0|6946816",
        fingerprintState: "full",
        uploadDate: "2026-03-08",
        uploader: "A. Rao",
        owner: "Design Office",
        sourceSystem: "File share",
        repository: "LDO Repository",
        collection: "Maintenance Procedures",
        plant: "RWF / Bengaluru",
        references: { erp: 0, work: 5, config: 4, approvals: 0 },
      },
      {
        id: "DOC-2026-9332",
        title: "Door Controller Commissioning Procedure",
        documentNumber: "PROC-DC-441",
        partNumber: "38150000",
        revision: "C.0",
        className: "Procedures",
        type: "PDF",
        fileSizeBytes: 6946816,
        metadataKey: "38150000|Door Controller Commissioning Procedure|C.0|6946816",
        fingerprintState: "present",
        uploadDate: "2026-02-23",
        uploader: "M. Khanna",
        owner: "Quality Cell",
        sourceSystem: "Scanner",
        repository: "LDO Repository",
        collection: "Maintenance Procedures",
        plant: "RWF / Bengaluru",
        references: { erp: 0, work: 1, config: 0, approvals: 0 },
      },
      {
        id: "DOC-2025-9333",
        title: "Door Controller Commissioning Procedure",
        documentNumber: "PROC-DC-441",
        partNumber: "38150000",
        revision: "C.0",
        className: "Procedures",
        type: "PDF",
        fileSizeBytes: 6946816,
        metadataKey: "38150000|Door Controller Commissioning Procedure|C.0|6946816",
        fingerprintState: "present",
        uploadDate: "2025-09-11",
        uploader: "P. Sen",
        owner: "Quality Cell",
        sourceSystem: "Import",
        repository: "LDO Repository",
        collection: "Maintenance Procedures",
        plant: "RWF / Bengaluru",
        references: { erp: 0, work: 1, config: 0, approvals: 0 },
        isArchived: true,
      },
    ],
  },
];
