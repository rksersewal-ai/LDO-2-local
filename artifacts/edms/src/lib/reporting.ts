import { MOCK_DOCUMENTS } from "./mock";
import {
  MOCK_APPROVALS,
  MOCK_AUDIT_EXTENDED,
  MOCK_OCR_JOBS,
  MOCK_REPORTS,
  MOCK_WORK_LEDGER,
} from "./mockExtended";

export interface ReportColumn {
  key: string;
  label: string;
  mono?: boolean;
  align?: "left" | "right";
}

export interface ReportRow {
  [key: string]: string | number | null | undefined;
}

export interface ReportDefinition {
  id: string;
  name: string;
  category: string;
  generated: string;
  status: string;
  description: string;
  filenamePrefix: string;
  dateKey: string;
  emptyState: string;
  columns: ReportColumn[];
  getRows: () => ReportRow[];
}

function daysBetween(start: string, end: Date = new Date()) {
  const startTime = new Date(start).getTime();
  const endTime = end.getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) return 0;
  return Math.floor((endTime - startTime) / (1000 * 60 * 60 * 24));
}

export function parseReportDate(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return value;
  if (!value) return null;
  const normalized = String(value).includes(" ") ? String(value).replace(" ", "T") : String(value);
  const timestamp = new Date(normalized).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    ...MOCK_REPORTS[0],
    filenamePrefix: "document-status-summary",
    dateKey: "uploadDate",
    emptyState: "No documents match the selected date range and search criteria.",
    columns: [
      { key: "documentId", label: "Document ID", mono: true },
      { key: "title", label: "Title" },
      { key: "status", label: "Status" },
      { key: "revision", label: "Revision", mono: true },
      { key: "type", label: "Type" },
      { key: "owner", label: "Owner" },
      { key: "linkedPL", label: "Linked PL", mono: true },
      { key: "uploadDate", label: "Upload Date" },
      { key: "ocrStatus", label: "OCR Status" },
    ],
    getRows: () =>
      MOCK_DOCUMENTS.map((doc) => ({
        documentId: doc.id,
        title: doc.name,
        status: doc.status,
        revision: doc.revision,
        type: doc.type,
        owner: doc.owner,
        linkedPL: doc.linkedPL,
        uploadDate: doc.date,
        ocrStatus: doc.ocrStatus || "Pending",
      })),
  },
  {
    ...MOCK_REPORTS[1],
    filenamePrefix: "ocr-processing-report",
    dateKey: "startedAt",
    emptyState: "No OCR jobs match the selected date range and search criteria.",
    columns: [
      { key: "jobId", label: "Job ID", mono: true },
      { key: "documentId", label: "Document ID", mono: true },
      { key: "filename", label: "Filename" },
      { key: "status", label: "Status" },
      { key: "confidence", label: "Confidence", align: "right" },
      { key: "pages", label: "Pages", align: "right" },
      { key: "extractedRefs", label: "Refs", align: "right" },
      { key: "startedAt", label: "Started At" },
      { key: "endedAt", label: "Ended At" },
    ],
    getRows: () =>
      MOCK_OCR_JOBS.map((job) => ({
        jobId: job.id,
        documentId: job.document,
        filename: job.filename,
        status: job.status,
        confidence: job.confidence == null ? "—" : `${job.confidence}%`,
        pages: job.pages,
        extractedRefs: job.extractedRefs,
        startedAt: job.startTime || "—",
        endedAt: job.endTime || "—",
      })),
  },
  {
    ...MOCK_REPORTS[2],
    filenamePrefix: "approval-cycle-time-analysis",
    dateKey: "submitted",
    emptyState: "No approvals match the selected date range and search criteria.",
    columns: [
      { key: "approvalId", label: "Approval ID", mono: true },
      { key: "title", label: "Title" },
      { key: "type", label: "Type" },
      { key: "status", label: "Status" },
      { key: "requester", label: "Requester" },
      { key: "urgency", label: "Urgency" },
      { key: "linkedDoc", label: "Linked Doc", mono: true },
      { key: "linkedPL", label: "Linked PL", mono: true },
      { key: "submitted", label: "Submitted" },
      { key: "dueDate", label: "Due Date" },
      { key: "daysInFlow", label: "Days In Flow", align: "right" },
    ],
    getRows: () =>
      MOCK_APPROVALS.map((approval) => ({
        approvalId: approval.id,
        title: approval.title,
        type: approval.type,
        status: approval.status,
        requester: approval.requester,
        urgency: approval.urgency,
        linkedDoc: approval.linkedDoc,
        linkedPL: approval.linkedPL,
        submitted: approval.submitted,
        dueDate: approval.dueDate,
        daysInFlow: daysBetween(approval.submitted),
      })),
  },
  {
    ...MOCK_REPORTS[3],
    filenamePrefix: "work-ledger-activity-report",
    dateKey: "activityDate",
    emptyState: "No work ledger activity matches the selected date range and search criteria.",
    columns: [
      { key: "workId", label: "Work ID", mono: true },
      { key: "title", label: "Title" },
      { key: "type", label: "Type" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" },
      { key: "assignee", label: "Assignee" },
      { key: "linkedPL", label: "Linked PL", mono: true },
      { key: "linkedDoc", label: "Linked Doc", mono: true },
      { key: "activityDate", label: "Date" },
    ],
    getRows: () =>
      MOCK_WORK_LEDGER.map((record) => ({
        workId: record.id,
        title: record.title,
        type: record.type,
        status: record.status,
        priority: record.priority,
        assignee: record.assignee,
        linkedPL: record.linkedPL,
        linkedDoc: record.linkedDoc,
        activityDate: record.date,
      })),
  },
  {
    ...MOCK_REPORTS[4],
    filenamePrefix: "user-access-audit-report",
    dateKey: "eventTime",
    emptyState: "No audit events match the selected date range and search criteria.",
    columns: [
      { key: "eventId", label: "Event ID", mono: true },
      { key: "action", label: "Action" },
      { key: "module", label: "Module" },
      { key: "user", label: "User" },
      { key: "entity", label: "Entity" },
      { key: "severity", label: "Severity" },
      { key: "ip", label: "IP Address", mono: true },
      { key: "eventTime", label: "Event Time" },
    ],
    getRows: () =>
      MOCK_AUDIT_EXTENDED.map((event) => ({
        eventId: event.id,
        action: event.action,
        module: event.module,
        user: event.user,
        entity: event.entity,
        severity: event.severity,
        ip: event.ip,
        eventTime: event.time,
      })),
  },
];

export function getReportDefinition(reportId: string | undefined) {
  return REPORT_DEFINITIONS.find((report) => report.id === reportId) ?? null;
}
