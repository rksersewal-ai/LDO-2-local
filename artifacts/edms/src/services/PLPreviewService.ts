import type { PLNumber } from "../lib/types";

export interface PLPreviewActor {
  id?: string | null;
  username?: string | null;
  name?: string | null;
}

export type PLPreviewPayload = Omit<PLNumber, "id" | "createdAt" | "updatedAt">;

export interface PLChangeLogEntry {
  id: string;
  field: string;
  label: string;
  before: string;
  after: string;
  changedAt: string;
  changedBy: string;
}

export interface PLRevisionEntry {
  id: string;
  plNumber: string;
  snapshot: PLNumber;
  action: "create" | "update" | "rollback";
  savedAt: string;
  savedBy: string;
  note?: string;
}

export interface PLPreviewDraft {
  draftId: string;
  mode: "create" | "edit";
  plNumber: string;
  baseline: PLNumber | null;
  draft: PLPreviewPayload;
  originPath: string;
  actor: PLPreviewActor;
  createdAt: string;
  updatedAt: string;
  changeLog: PLChangeLogEntry[];
  rollbackRevisionId?: string | null;
}

const DRAFTS_KEY = "ldo2_pl_preview_drafts";
const HISTORY_KEY = "ldo2_pl_revision_history";

const FIELD_LABELS: Record<string, string> = {
  plNumber: "PL Number",
  name: "Name",
  description: "Description",
  category: "Inspection Category",
  controllingAgency: "Controlling Agency",
  status: "Status",
  safetyCritical: "Safety Critical",
  safetyClassification: "Safety Classification",
  severityOfFailure: "Severity of Failure",
  consequences: "Consequences",
  functionality: "Functionality",
  applicationArea: "Application Area",
  usedIn: "Used In",
  drawingNumbers: "Drawing Numbers",
  specNumbers: "Specification Numbers",
  motherPart: "Mother Part",
  uvamId: "UVAM Item ID",
  strNumber: "STR Number",
  eligibilityCriteria: "Eligibility Criteria",
  procurementConditions: "Procurement Conditions",
  designSupervisor: "Design Supervisor",
  concernedSupervisor: "Concerned Supervisor",
  eOfficeFile: "e-Office File",
  vendorType: "Vendor Type",
  linkedDocumentIds: "Linked Documents",
  linkedWorkIds: "Linked Work Records",
  linkedCaseIds: "Linked Cases",
};

function readDraftStore(): Record<string, PLPreviewDraft> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(DRAFTS_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function writeDraftStore(store: Record<string, PLPreviewDraft>) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(store));
  }
}

function readHistoryStore(): Record<string, PLRevisionEntry[]> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function writeHistoryStore(store: Record<string, PLRevisionEntry[]>) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(store));
  }
}

function normalizePlNumber(value: string) {
  return value.replace(/^PL-/, "").trim();
}

function actorName(actor?: PLPreviewActor | null) {
  return actor?.name || actor?.username || actor?.id || "Unknown user";
}

function serializeValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "—";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value);
}

function stripForComparison(payload: Partial<PLNumber> | PLPreviewPayload | null) {
  if (!payload) {
    return {};
  }

  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    recentActivity: _recentActivity,
    engineeringChanges: _engineeringChanges,
    ...rest
  } = payload as Partial<PLNumber> & {
    id?: string;
    createdAt?: string;
    updatedAt?: string;
    recentActivity?: string[];
    engineeringChanges?: unknown[];
  };

  return rest;
}

function buildChangeLog(
  baseline: PLNumber | null,
  draft: PLPreviewPayload,
  actor: PLPreviewActor,
): PLChangeLogEntry[] {
  const beforeState = stripForComparison(baseline);
  const afterState = stripForComparison(draft as unknown as Partial<PLNumber>);
  const keys = Array.from(
    new Set([...Object.keys(beforeState), ...Object.keys(afterState)]),
  ).sort();
  const changedAt = new Date().toISOString();
  const changedBy = actorName(actor);

  return keys
    .filter(
      (key) =>
        serializeValue(beforeState[key as keyof typeof beforeState]) !==
        serializeValue(afterState[key as keyof typeof afterState]),
    )
    .map((field) => ({
      id: `${field}-${changedAt}`,
      field,
      label: FIELD_LABELS[field] ?? field,
      before: serializeValue(beforeState[field as keyof typeof beforeState]),
      after: serializeValue(afterState[field as keyof typeof afterState]),
      changedAt,
      changedBy,
    }));
}

function toPreviewPayload(record: PLNumber): PLPreviewPayload {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = record;
  return rest;
}

export const PLPreviewService = {
  toPreviewPayload,
  buildChangeLog,

  createDraft(input: {
    mode: "create" | "edit";
    baseline: PLNumber | null;
    draft: PLPreviewPayload;
    actor?: PLPreviewActor;
    originPath: string;
  }) {
    const draftId = `PLDRV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const draft: PLPreviewDraft = {
      draftId,
      mode: input.mode,
      plNumber: normalizePlNumber(input.draft.plNumber),
      baseline: input.baseline,
      draft: input.draft,
      originPath: input.originPath,
      actor: input.actor ?? {},
      createdAt: now,
      updatedAt: now,
      changeLog: buildChangeLog(input.baseline, input.draft, input.actor ?? {}),
      rollbackRevisionId: null,
    };

    const store = readDraftStore();
    store[draftId] = draft;
    writeDraftStore(store);
    return draft;
  },

  getDraft(draftId: string) {
    const store = readDraftStore();
    return store[draftId] ?? null;
  },

  overwriteDraft(
    draftId: string,
    patch: Partial<Pick<PLPreviewDraft, "draft" | "rollbackRevisionId">>,
  ) {
    const store = readDraftStore();
    const existing = store[draftId];
    if (!existing) {
      return null;
    }

    const nextDraftData = patch.draft ?? existing.draft;
    const next: PLPreviewDraft = {
      ...existing,
      ...patch,
      draft: nextDraftData,
      updatedAt: new Date().toISOString(),
      changeLog: buildChangeLog(existing.baseline, nextDraftData, existing.actor),
    };

    store[draftId] = next;
    writeDraftStore(store);
    return next;
  },

  discardDraft(draftId: string) {
    const store = readDraftStore();
    delete store[draftId];
    writeDraftStore(store);
  },

  recordRevision(input: {
    snapshot: PLNumber;
    actor?: PLPreviewActor;
    action: "create" | "update" | "rollback";
    note?: string;
  }) {
    const plNumber = normalizePlNumber(input.snapshot.plNumber || input.snapshot.id);
    const history = readHistoryStore();
    const nextEntry: PLRevisionEntry = {
      id: `PLREV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      plNumber,
      snapshot: input.snapshot,
      action: input.action,
      savedAt: new Date().toISOString(),
      savedBy: actorName(input.actor),
      note: input.note,
    };

    history[plNumber] = [nextEntry, ...(history[plNumber] ?? [])].slice(0, 25);
    writeHistoryStore(history);
    return nextEntry;
  },

  getRevisionHistory(plNumber: string) {
    const history = readHistoryStore();
    return history[normalizePlNumber(plNumber)] ?? [];
  },
};
