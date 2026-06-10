import { MOCK_CASES } from "../lib/mockExtended";
import type { CaseRecord, CaseSeverity, CaseStatus } from "../lib/types";

const STORAGE_KEY = "ldo2_cases";

function mapMockCase(c: (typeof MOCK_CASES)[0]): CaseRecord {
  const statusMap: Record<string, CaseStatus> = {
    Open: "OPEN",
    "In Progress": "IN_PROGRESS",
    Closed: "CLOSED",
  };

  const severityMap: Record<string, CaseSeverity> = {
    High: "HIGH",
    Medium: "MEDIUM",
    Low: "LOW",
    Critical: "CRITICAL",
  };

  return {
    id: c.id,
    caseNumber: c.id,
    title: c.title,
    description: c.description ?? "",
    status: statusMap[c.status] ?? "OPEN",
    severity: severityMap[c.severity] ?? "MEDIUM",
    plNumber: c.linkedPL,
    linkedDocumentIds: c.linkedDocs ?? [],
    linkedWorkIds: [],
    assignee: c.assignee,
    type: "Discrepancy",
    createdAt: c.created,
    updatedAt: c.updated,
  };
}

function buildDefaultStore() {
  return MOCK_CASES.map(mapMockCase);
}

function loadStore(): CaseRecord[] {
  if (typeof window === "undefined") {
    return buildDefaultStore();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = buildDefaultStore();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Case store is invalid");
    }

    return parsed.map((record) => ({
      ...record,
      linkedDocumentIds: Array.isArray(record.linkedDocumentIds) ? record.linkedDocumentIds : [],
      linkedWorkIds: Array.isArray(record.linkedWorkIds) ? record.linkedWorkIds : [],
    }));
  } catch {
    const fallback = buildDefaultStore();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
}

function persist() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(_store));
  }
}

let _store: CaseRecord[] = loadStore();

function generateId(): string {
  const max = _store.reduce((highest, record) => {
    const numeric = Number(record.caseNumber.replace(/\D/g, ""));
    return Number.isFinite(numeric) ? Math.max(highest, numeric) : highest;
  }, 0);
  return `CAS-${String(max + 1).padStart(3, "0")}`;
}

export const CaseService = {
  getAll(): Promise<CaseRecord[]> {
    return Promise.resolve([..._store]);
  },

  getById(id: string): Promise<CaseRecord | null> {
    return Promise.resolve(_store.find((c) => c.id === id || c.caseNumber === id) ?? null);
  },

  add(
    data: Omit<CaseRecord, "id" | "caseNumber" | "createdAt" | "updatedAt">,
  ): Promise<CaseRecord> {
    const now = new Date().toISOString().split("T")[0];
    const newId = generateId();
    const c: CaseRecord = {
      ...data,
      id: newId,
      caseNumber: newId,
      createdAt: now,
      updatedAt: now,
    };
    _store = [c, ..._store];
    persist();
    return Promise.resolve(c);
  },

  update(id: string, patch: Partial<CaseRecord>): Promise<CaseRecord | null> {
    const idx = _store.findIndex((c) => c.id === id || c.caseNumber === id);
    if (idx < 0) return Promise.resolve(null);
    _store[idx] = {
      ..._store[idx],
      ...patch,
      updatedAt: new Date().toISOString().split("T")[0],
    };
    persist();
    return Promise.resolve(_store[idx]);
  },

  delete(id: string): Promise<boolean> {
    const before = _store.length;
    _store = _store.filter((c) => c.id !== id && c.caseNumber !== id);
    persist();
    return Promise.resolve(_store.length < before);
  },

  search(query: string): Promise<CaseRecord[]> {
    const q = query.trim().toLowerCase();
    if (!q) return CaseService.getAll();
    return Promise.resolve(
      _store.filter(
        (c) =>
          c.caseNumber.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          (c.plNumber?.toLowerCase().includes(q) ?? false) ||
          (c.type?.toLowerCase().includes(q) ?? false) ||
          (c.vendorName?.toLowerCase().includes(q) ?? false) ||
          (c.tenderNumber?.toLowerCase().includes(q) ?? false) ||
          c.assignee.toLowerCase().includes(q),
      ),
    );
  },
};
