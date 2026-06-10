import { MOCK_APPROVALS } from "../lib/mockExtended";

export type ApprovalStatus = "Pending" | "Approved" | "Rejected";

export interface ApprovalRecord {
  id: string;
  title: string;
  type: string;
  status: ApprovalStatus;
  requester: string;
  linkedDoc: string;
  linkedPL: string;
  dueDate: string;
  submitted: string;
  urgency: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface ApprovalRequestDocument {
  id: string;
  name: string;
  author: string;
  linkedPL: string;
  ocrStatus?: string | null;
}

const STORAGE_KEY = "ldo2_approvals";

function normalize(approval: ApprovalRecord): ApprovalRecord {
  return {
    id: String(approval.id),
    title: String(approval.title ?? "").trim(),
    type: String(approval.type ?? "").trim(),
    status:
      approval.status === "Approved" || approval.status === "Rejected"
        ? approval.status
        : "Pending",
    requester: String(approval.requester ?? "").trim(),
    linkedDoc: String(approval.linkedDoc ?? "").trim(),
    linkedPL: String(approval.linkedPL ?? "").trim(),
    dueDate: String(approval.dueDate ?? ""),
    submitted: String(approval.submitted ?? ""),
    urgency: String(approval.urgency ?? "Normal"),
    reviewedAt: approval.reviewedAt ? String(approval.reviewedAt) : undefined,
    reviewedBy: approval.reviewedBy ? String(approval.reviewedBy) : undefined,
  };
}

function sortApprovals(approvals: ApprovalRecord[]) {
  return [...approvals].sort((left, right) => {
    if (left.status !== right.status) {
      if (left.status === "Pending") return -1;
      if (right.status === "Pending") return 1;
      if (left.status === "Approved") return -1;
      if (right.status === "Approved") return 1;
    }

    const dueCompare = left.dueDate.localeCompare(right.dueDate);
    if (dueCompare !== 0) {
      return dueCompare;
    }

    return right.submitted.localeCompare(left.submitted);
  });
}

function buildDefaultStore() {
  return sortApprovals(MOCK_APPROVALS.map((approval) => normalize(approval as ApprovalRecord)));
}

function persist(store: ApprovalRecord[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
}

function loadStore() {
  if (typeof window === "undefined") {
    return buildDefaultStore();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = buildDefaultStore();
      persist(seeded);
      return seeded;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Approval store is invalid");
    }

    return sortApprovals(parsed.map((approval) => normalize(approval as ApprovalRecord)));
  } catch {
    const fallback = buildDefaultStore();
    persist(fallback);
    return fallback;
  }
}

function nextApprovalNumber(store: ApprovalRecord[]) {
  const max = store.reduce((highest, approval) => {
    const numeric = Number(approval.id.replace(/\D/g, ""));
    return Number.isFinite(numeric) ? Math.max(highest, numeric) : highest;
  }, 0);
  return max + 1;
}

function formatIsoDate(offsetDays = 0) {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString().split("T")[0];
}

let _store = loadStore();

export const ApprovalService = {
  getAll(): Promise<ApprovalRecord[]> {
    return Promise.resolve(sortApprovals(_store));
  },

  updateStatus(
    id: string,
    status: Exclude<ApprovalStatus, "Pending">,
    reviewedBy?: string,
  ): Promise<ApprovalRecord | null> {
    const index = _store.findIndex((approval) => approval.id === id);
    if (index < 0) {
      return Promise.resolve(null);
    }

    _store[index] = normalize({
      ..._store[index],
      status,
      reviewedAt: new Date().toISOString(),
      reviewedBy: reviewedBy?.trim() || _store[index].reviewedBy,
    });
    _store = sortApprovals(_store);
    persist(_store);
    return Promise.resolve(_store[index]);
  },

  queueDocumentApprovals(documents: ApprovalRequestDocument[]): Promise<ApprovalRecord[]> {
    const existingDocumentIds = new Set(_store.map((approval) => approval.linkedDoc));
    const nextSequence = nextApprovalNumber(_store);
    const additions = documents
      .filter((document) => !existingDocumentIds.has(document.id))
      .map((document, index) =>
        normalize({
          id: `APR-${nextSequence + index}`,
          title: `${document.name} - Release Approval`,
          type: "Document Approval",
          status: "Pending",
          requester: document.author,
          linkedDoc: document.id,
          linkedPL: document.linkedPL,
          dueDate: formatIsoDate(document.ocrStatus === "Failed" ? 1 : 3),
          submitted: formatIsoDate(),
          urgency: document.ocrStatus === "Failed" ? "High" : "Normal",
        }),
      );

    if (additions.length === 0) {
      return Promise.resolve([]);
    }

    _store = sortApprovals([...additions, ..._store]);
    persist(_store);
    return Promise.resolve(additions);
  },
};
