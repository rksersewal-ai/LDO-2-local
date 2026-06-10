import { WORK_TYPE_DEFINITIONS } from "../lib/constants";
import { MOCK_WORK_LEDGER } from "../lib/mockExtended";
import type { WorkCategory, WorkRecord, WorkRecordStatus } from "../lib/types";

function mapMockWork(w: (typeof MOCK_WORK_LEDGER)[0]): WorkRecord {
  const typeToCategory: Record<string, WorkCategory> = {
    Inspection: "INSPECTION",
    Calibration: "INSPECTION",
    Review: "SPECIFICATION",
    Reporting: "GENERAL",
    Audit: "GENERAL",
  };

  const statusMap: Record<string, WorkRecordStatus> = {
    Complete: "CLOSED",
    "In Progress": "SUBMITTED",
    Pending: "OPEN",
    "Pending Verification": "SUBMITTED",
  };

  const workCategory = typeToCategory[(w as Record<string, unknown>).type as string] ?? "GENERAL";

  return {
    id: w.id,
    userId: "USR-001",
    userName: ((w as Record<string, unknown>).assignee as string) ?? "Unknown",
    date: w.date,
    workCategory,
    workType: ((w as Record<string, unknown>).type as string) ?? "Miscellaneous Work",
    description: ((w as Record<string, unknown>).title as string) ?? "",
    plNumber:
      ((w as Record<string, unknown>).linkedPL as string) !== "N/A"
        ? ((w as Record<string, unknown>).linkedPL as string)
        : undefined,
    documentRef: (w as Record<string, unknown>).linkedDoc as string,
    status: statusMap[(w as Record<string, unknown>).status as string] ?? "OPEN",
    isLocked: (w as Record<string, unknown>).status === "Complete",
    targetDays: 7,
    createdAt: w.date,
  };
}

const EXTRA_WORK_RECORDS: WorkRecord[] = [
  {
    id: "WL-2001",
    userId: "USR-001",
    userName: "A. Kowalski",
    userSection: "Design",
    date: "2026-02-10",
    completionDate: "2026-02-18",
    daysTaken: 8,
    workCategory: "DRAWING",
    workType: "Drawing Amendment",
    referenceNumber: "DWG-BOG-ASM-001",
    plNumber: "38110000",
    description:
      "Amendment to bogie frame assembly drawing — gusset plate thickness update per ECO-2025-0887",
    eOfficeNumber: "CLW/DESIGN/2026/0412",
    eOfficeFileNo: "CLW-DWG-2026-BOG",
    concernedOfficer: "SSE/Design",
    sectionType: "Design",
    targetDays: 15,
    status: "VERIFIED",
    isLocked: true,
    verifiedBy: "S. Patel",
    verificationDate: "2026-02-20",
    consentGiven: "N/A",
    createdAt: "2026-02-10",
  },
  {
    id: "WL-2002",
    userId: "USR-002",
    userName: "M. Chen",
    userSection: "Inspection",
    date: "2026-02-20",
    completionDate: undefined,
    workCategory: "INSPECTION",
    workType: "Routine Inspection",
    plNumber: "38111000",
    description: "Q1 brake system routine inspection — WAP7 serial batch 30601–30620",
    eOfficeNumber: "CLW/INSP/2026/0088",
    concernedOfficer: "SSE/Inspection",
    sectionType: "Inspection",
    targetDays: 7,
    status: "OPEN",
    consentGiven: "N/A",
    createdAt: "2026-02-20",
  },
  {
    id: "WL-2003",
    userId: "USR-003",
    userName: "S. Patel",
    userSection: "Tender",
    date: "2026-01-15",
    completionDate: "2026-03-10",
    daysTaken: 54,
    workCategory: "TENDER",
    workType: "Tender Processing",
    tenderNumber: "CLW/TENDER/2026/WAG9-PAN",
    description:
      "Tender processing for procurement of DSA380 pantographs for WAG-9HC (Qty: 180 EA)",
    eOfficeNumber: "CLW/TEND/2026/0022",
    eOfficeFileNo: "CLW-TEND-2026-022",
    concernedOfficer: "SSE/Tender",
    sectionType: "Tender",
    targetDays: 60,
    status: "CLOSED",
    isLocked: true,
    verifiedBy: "Admin",
    verificationDate: "2026-03-12",
    consentGiven: "Y",
    createdAt: "2026-01-15",
  },
  {
    id: "WL-2004",
    userId: "USR-001",
    userName: "A. Kowalski",
    userSection: "Design",
    date: "2026-03-01",
    workCategory: "SPECIFICATION",
    workType: "Specification Review",
    plNumber: "38140000",
    referenceNumber: "DOC-2026-4001",
    description:
      "Technical review of Control System Architecture Specification Rev B.3 against IEC 61508 SIL-3 requirements",
    eOfficeNumber: "CLW/DESIGN/2026/0589",
    concernedOfficer: "SSE/Design",
    sectionType: "Design",
    targetDays: 15,
    status: "SUBMITTED",
    consentGiven: "N/A",
    createdAt: "2026-03-01",
  },
  {
    id: "WL-2005",
    userId: "USR-002",
    userName: "M. Chen",
    userSection: "Quality",
    date: "2026-03-15",
    workCategory: "FAILURE",
    workType: "Failure Investigation",
    plNumber: "38120000",
    description:
      "Root cause investigation for traction motor insulation failure reported at WAP7-30612",
    eOfficeNumber: "CLW/QA/2026/0201",
    concernedOfficer: "SSE/Inspection",
    sectionType: "Quality",
    targetDays: 14,
    status: "OPEN",
    consentGiven: "N/A",
    createdAt: "2026-03-15",
  },
];

let _store: WorkRecord[] = [...MOCK_WORK_LEDGER.map(mapMockWork), ...EXTRA_WORK_RECORDS];

function generateId(): string {
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `WL-${seq}`;
}

export function getTargetDays(workType: string): number {
  return WORK_TYPE_DEFINITIONS.find((w) => w.label === workType)?.disposalDays ?? 7;
}

export function calculateDaysTaken(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function getKPIStatus(record: WorkRecord): {
  label: string;
  color: string;
  isOnTime: boolean;
} {
  const targetDays = record.targetDays ?? getTargetDays(record.workType);
  const today = new Date().toISOString().split("T")[0];
  const endDate = record.completionDate ?? record.closingDate ?? today;
  const daysTaken = calculateDaysTaken(record.date, endDate);
  const daysLeft = targetDays - daysTaken;

  if (record.status === "VERIFIED" || record.status === "CLOSED") {
    if (daysTaken <= targetDays) {
      return {
        color: "text-emerald-400",
        label: `Completed (${daysTaken}d / ${targetDays}d)`,
        isOnTime: true,
      };
    }
    return {
      color: "text-rose-400",
      label: `Delayed by ${daysTaken - targetDays}d`,
      isOnTime: false,
    };
  }

  if (daysLeft < 0)
    return {
      color: "text-rose-400",
      label: `OVERDUE: ${Math.abs(daysLeft)}d`,
      isOnTime: false,
    };
  if (daysLeft < 3)
    return {
      color: "text-amber-400",
      label: `Urgent: ${daysLeft}d left`,
      isOnTime: true,
    };
  return {
    color: "text-blue-400",
    label: `On Track (${daysLeft}d left)`,
    isOnTime: true,
  };
}

export function checkDuplicates(record: Partial<WorkRecord>, existing: WorkRecord[]): WorkRecord[] {
  if (!record.eOfficeNumber || !record.workType) return [];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return existing.filter((r) => {
    const rDate = new Date(r.date);
    return (
      r.eOfficeNumber === record.eOfficeNumber &&
      r.workType === record.workType &&
      rDate >= thirtyDaysAgo
    );
  });
}

export const WorkLedgerService = {
  getAll(): Promise<WorkRecord[]> {
    return Promise.resolve([..._store]);
  },

  getById(id: string): Promise<WorkRecord | null> {
    return Promise.resolve(_store.find((w) => w.id === id) ?? null);
  },

  add(data: Omit<WorkRecord, "id" | "createdAt">): Promise<WorkRecord> {
    const now = new Date().toISOString().split("T")[0];
    const record: WorkRecord = {
      ...data,
      id: generateId(),
      createdAt: now,
    };
    _store = [record, ..._store];
    return Promise.resolve(record);
  },

  update(id: string, patch: Partial<WorkRecord>): Promise<WorkRecord | null> {
    const idx = _store.findIndex((w) => w.id === id);
    if (idx < 0) return Promise.resolve(null);
    if (_store[idx].isLocked && !patch.isLocked) return Promise.resolve(_store[idx]);
    _store[idx] = { ..._store[idx], ...patch };
    return Promise.resolve(_store[idx]);
  },

  verify(id: string, verifierName: string): Promise<WorkRecord | null> {
    const today = new Date().toISOString().split("T")[0];
    const record = _store.find((w) => w.id === id);
    if (!record) return Promise.resolve(null);
    return WorkLedgerService.update(id, {
      status: "VERIFIED",
      isLocked: true,
      verifiedBy: verifierName,
      verificationDate: today,
      completionDate: record.completionDate ?? today,
      daysTaken: calculateDaysTaken(record.date, today),
    });
  },

  delete(id: string): Promise<boolean> {
    const before = _store.length;
    _store = _store.filter((w) => w.id !== id);
    return Promise.resolve(_store.length < before);
  },

  search(query: string): Promise<WorkRecord[]> {
    const q = query.trim().toLowerCase();
    if (!q) return WorkLedgerService.getAll();
    return Promise.resolve(
      _store.filter(
        (w) =>
          w.id.toLowerCase().includes(q) ||
          w.workType.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q) ||
          (w.plNumber?.toLowerCase().includes(q) ?? false) ||
          (w.eOfficeNumber?.toLowerCase().includes(q) ?? false) ||
          (w.tenderNumber?.toLowerCase().includes(q) ?? false) ||
          (w.userName?.toLowerCase().includes(q) ?? false),
      ),
    );
  },

  checkDuplicates(record: Partial<WorkRecord>): Promise<WorkRecord[]> {
    return Promise.resolve(checkDuplicates(record, _store));
  },

  getAnalytics(): Promise<{
    byCategory: { category: string; count: number }[];
    byStatus: { status: string; count: number }[];
    avgDaysByType: { workType: string; avgDays: number; targetDays: number }[];
    onTimeRate: number;
    overdueCount: number;
    totalRecords: number;
  }> {
    const byCategory = Object.entries(
      _store.reduce(
        (acc, w) => {
          acc[w.workCategory] = (acc[w.workCategory] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    ).map(([category, count]) => ({ category, count }));

    const byStatus = Object.entries(
      _store.reduce(
        (acc, w) => {
          acc[w.status] = (acc[w.status] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    ).map(([status, count]) => ({ status, count }));

    const typeGroups: Record<string, number[]> = {};
    for (const w of _store) {
      if (w.daysTaken != null) {
        typeGroups[w.workType] ??= [];
        typeGroups[w.workType].push(w.daysTaken);
      }
    }
    const avgDaysByType = Object.entries(typeGroups).map(([workType, days]) => ({
      workType,
      avgDays: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
      targetDays: getTargetDays(workType),
    }));

    const completed = _store.filter((w) => w.status === "VERIFIED" || w.status === "CLOSED");
    const onTime = completed.filter(
      (w) => (w.daysTaken ?? 0) <= (w.targetDays ?? getTargetDays(w.workType)),
    );
    const onTimeRate =
      completed.length > 0 ? Math.round((onTime.length / completed.length) * 100) : 0;

    const today = new Date().toISOString().split("T")[0];
    const overdueCount = _store.filter((w) => {
      if (w.status === "VERIFIED" || w.status === "CLOSED") return false;
      const days = calculateDaysTaken(w.date, today);
      return days > (w.targetDays ?? getTargetDays(w.workType));
    }).length;

    return Promise.resolve({
      byCategory,
      byStatus,
      avgDaysByType,
      onTimeRate,
      overdueCount,
      totalRecords: _store.length,
    });
  },
};
