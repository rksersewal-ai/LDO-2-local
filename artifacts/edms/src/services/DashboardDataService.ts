/**
 * DashboardDataService
 *
 * Centralizes all data access for the Dashboard page. In mock mode the data comes
 * from in-memory mock stores; in production mode it delegates to ApiClient.
 *
 * Pages should import from this service instead of pulling mock arrays directly.
 */

import { z } from "zod";
import { PL_DATABASE, PRODUCTS, type Product } from "../lib/bomData";
import { DUPLICATE_GROUPS } from "../lib/deduplicationMock";
import { MOCK_AUDIT_LOG, MOCK_DOCUMENTS } from "../lib/mock";
import {
  MOCK_APPROVALS,
  MOCK_CASES,
  MOCK_NOTIFICATIONS,
  MOCK_OCR_JOBS,
  MOCK_REPORTS,
  MOCK_WORK_LEDGER,
} from "../lib/mockExtended";
import apiClient from "./ApiClient";

const useMockApi = import.meta.env.VITE_ENABLE_DEV_MOCK_API === "true";

type DashboardDocument = (typeof MOCK_DOCUMENTS)[number];
type DashboardApproval = (typeof MOCK_APPROVALS)[number];
type DashboardOcrJob = (typeof MOCK_OCR_JOBS)[number];
type DashboardNotification = (typeof MOCK_NOTIFICATIONS)[number];
type DashboardCase = (typeof MOCK_CASES)[number];
type DashboardWorkRecord = (typeof MOCK_WORK_LEDGER)[number];
type DashboardDuplicateGroup = (typeof DUPLICATE_GROUPS)[number];
type DashboardReport = (typeof MOCK_REPORTS)[number];
type DashboardAuditLogEntry = (typeof MOCK_AUDIT_LOG)[number];
type DashboardPlRecord = (typeof PL_DATABASE)[keyof typeof PL_DATABASE];
type DashboardPlItem = DashboardPlRecord & { id: string };

const DashboardStatsSchema = z
  .object({
    documents: z
      .object({
        total: z.number().nullish(),
        approved: z.number().nullish(),
      })
      .nullish(),
  })
  .passthrough();

export interface DashboardKpiSnapshot {
  documents: { total: number; approved: number; data: readonly DashboardDocument[] };
  approvals: { total: number; pending: number; data: readonly DashboardApproval[] };
  ocrJobs: {
    total: number;
    failed: number;
    processing: number;
    data: readonly DashboardOcrJob[];
  };
  notifications: { total: number; unread: number; data: readonly DashboardNotification[] };
  cases: {
    total: number;
    open: number;
    highSeverity: number;
    data: readonly DashboardCase[];
  };
  workRecords: {
    total: number;
    completed: number;
    inProgress: number;
    data: readonly DashboardWorkRecord[];
  };
  plItems: { total: number; data: readonly DashboardPlItem[] };
  products: {
    total: number;
    inProduction: number;
    inDevelopment: number;
    data: readonly Product[];
  };
  dedupGroups: { total: number; pending: number; data: readonly DashboardDuplicateGroup[] };
  reports: { total: number; data: readonly DashboardReport[] };
  auditLog: readonly DashboardAuditLogEntry[];
}

function buildMockSnapshot(): DashboardKpiSnapshot {
  const plRecords: DashboardPlItem[] = Object.entries(PL_DATABASE).map(([id, rec]) => ({
    id,
    ...rec,
  }));

  return {
    documents: {
      total: MOCK_DOCUMENTS.length,
      approved: MOCK_DOCUMENTS.filter((d) => d.status === "Approved").length,
      data: MOCK_DOCUMENTS,
    },
    approvals: {
      total: MOCK_APPROVALS.length,
      pending: MOCK_APPROVALS.filter((a) => a.status === "Pending").length,
      data: MOCK_APPROVALS,
    },
    ocrJobs: {
      total: MOCK_OCR_JOBS.length,
      failed: MOCK_OCR_JOBS.filter((j) => j.status === "Failed").length,
      processing: MOCK_OCR_JOBS.filter((j) => j.status === "Processing").length,
      data: MOCK_OCR_JOBS,
    },
    notifications: {
      total: MOCK_NOTIFICATIONS.length,
      unread: MOCK_NOTIFICATIONS.filter((n) => !n.read).length,
      data: MOCK_NOTIFICATIONS,
    },
    cases: {
      total: MOCK_CASES.length,
      open: MOCK_CASES.filter((c) => c.status !== "Resolved").length,
      highSeverity: MOCK_CASES.filter((c) => c.severity === "High").length,
      data: MOCK_CASES,
    },
    workRecords: {
      total: MOCK_WORK_LEDGER.length,
      completed: MOCK_WORK_LEDGER.filter((w) => w.status === "Complete").length,
      inProgress: MOCK_WORK_LEDGER.filter(
        (w) => w.status === "Pending" || w.status === "In Progress",
      ).length,
      data: MOCK_WORK_LEDGER,
    },
    plItems: {
      total: plRecords.length,
      data: plRecords,
    },
    products: {
      total: PRODUCTS.length,
      inProduction: PRODUCTS.filter((p) => p.lifecycle === "Production").length,
      inDevelopment: PRODUCTS.filter((p) => p.lifecycle === "In Development").length,
      data: PRODUCTS,
    },
    dedupGroups: {
      total: DUPLICATE_GROUPS.length,
      pending: DUPLICATE_GROUPS.filter((g) => g.status === "pending").length,
      data: DUPLICATE_GROUPS,
    },
    reports: {
      total: MOCK_REPORTS.length,
      data: MOCK_REPORTS,
    },
    auditLog: MOCK_AUDIT_LOG,
  };
}

let _cached: DashboardKpiSnapshot | null = null;

export const DashboardDataService = {
  /**
   * Returns the full dashboard KPI snapshot.
   * In mock mode this is synchronous (returns immediately).
   * With a real backend it calls /api/dashboard/stats/ and normalizes the response.
   */
  async getSnapshot(): Promise<DashboardKpiSnapshot> {
    if (useMockApi) {
      if (!_cached) _cached = buildMockSnapshot();
      return _cached;
    }

    // Real API path — falls back to mock on failure
    try {
      const rawStats = await apiClient.getDashboardStats();
      const stats = DashboardStatsSchema.parse(rawStats);
      // Map backend stats to our snapshot shape; fill gaps from mock for now
      const mock = buildMockSnapshot();
      return {
        ...mock,
        documents: {
          total: stats.documents?.total ?? mock.documents.total,
          approved: stats.documents?.approved ?? mock.documents.approved,
          data: mock.documents.data,
        },
      };
    } catch {
      return buildMockSnapshot();
    }
  },

  /** Synchronous access to the cached snapshot (for initial render). */
  getCachedOrBuild(): DashboardKpiSnapshot {
    if (!_cached) _cached = buildMockSnapshot();
    return _cached;
  },

  /** Invalidate cached data (e.g. after a mutation). */
  invalidate() {
    _cached = null;
  },
};
