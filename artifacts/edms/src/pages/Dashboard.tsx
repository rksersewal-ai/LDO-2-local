import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Bell,
  CheckSquare,
  Database,
  Download,
  FileText,
  FolderOpen,
  MoreHorizontal,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  DocumentPreviewButton,
  getDocumentContextAttributes,
} from "../components/documents/DocumentPreviewActions";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Badge as StatusBadge } from "../components/ui/Shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { cn } from "../lib/utils";
import { DashboardDataService } from "../services/DashboardDataService";
import { ExportImportService } from "../services/ExportImportService";

type MetricTone = "neutral" | "good" | "warning" | "danger";

const toneClass: Record<MetricTone, string> = {
  neutral: "text-muted-foreground",
  good: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-rose-600",
};

function parseDateSafe(value?: string) {
  return value ? new Date(value).getTime() : 0;
}

function formatCompactDate(value?: string) {
  if (!value) return "No date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatBytes(bytes: number) {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

function statusVariant(status: string) {
  const value = status.toLowerCase();
  if (
    value.includes("approved") ||
    value.includes("complete") ||
    value.includes("resolved") ||
    value.includes("active") ||
    value.includes("released")
  ) {
    return "success" as const;
  }
  if (value.includes("processing") || value.includes("progress")) return "processing" as const;
  if (
    value.includes("failed") ||
    value.includes("rejected") ||
    value.includes("obsolete") ||
    value.includes("escalated")
  ) {
    return "danger" as const;
  }
  if (value.includes("review") || value.includes("pending") || value.includes("open")) {
    return "warning" as const;
  }
  return "default" as const;
}

function sparkValues(primary: number, secondary: number) {
  const base = Math.max(primary + secondary, 1);
  return [0.28, 0.44, 0.38, 0.62, 0.5, 0.72, 0.64].map((ratio, index) =>
    Math.max(8, Math.round(base * ratio + index * 2)),
  );
}

function TinySparkline({ values, tone = "neutral" }: { values: number[]; tone?: MetricTone }) {
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 88;
      const y = 34 - (value / max) * 28;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 88 38" className={cn("h-10 w-24", toneClass[tone])} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MetricCard({
  title,
  value,
  description,
  trend,
  tone,
  icon: Icon,
  values,
  onClick,
}: {
  title: string;
  value: string;
  description: string;
  trend: string;
  tone: MetricTone;
  icon: React.ComponentType<{ className?: string }>;
  values: number[];
  onClick?: () => void;
}) {
  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "shadow-sm border-border/50 bg-card/40 backdrop-blur-md transition-all duration-200",
        onClick &&
          "cursor-pointer hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40",
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 p-3 pb-1">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border bg-background text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <CardDescription className="text-xs font-medium">{title}</CardDescription>
        </div>
        <span className={cn("text-xs font-medium", toneClass[tone])}>{trend}</span>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-3 p-3 pt-1">
        <div className="min-w-0">
          <div className="font-mono text-2xl font-semibold leading-none text-foreground">
            {value}
          </div>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <TinySparkline values={values} tone={tone} />
      </CardContent>
    </Card>
  );
}

function MiniBarChart({
  rows,
}: {
  rows: Array<{ label: string; value: number; tone: MetricTone }>;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[112px_1fr_48px] items-center gap-3">
          <span className="truncate text-xs text-muted-foreground">{row.label}</span>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full bg-foreground", toneClass[row.tone])}
              style={{
                width: `${Math.max(8, (row.value / max) * 100)}%`,
                backgroundColor: "currentColor",
              }}
            />
          </div>
          <span className="text-right font-mono text-xs text-foreground">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function ActivityList({
  items,
}: {
  items: Array<{ id: string; title: string; meta: string; status: string; onClick: () => void }>;
}) {
  return (
    <div className="flex flex-col divide-y divide-border">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onClick}
          className="flex items-center justify-between gap-3 py-2.5 text-left transition-colors hover:bg-muted/50"
        >
          <div className="min-w-0 px-1">
            <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.meta}</p>
          </div>
          <StatusBadge variant={statusVariant(item.status)} size="sm">
            {item.status}
          </StatusBadge>
        </button>
      ))}
    </div>
  );
}

interface DrilldownTable {
  title: string;
  description: string;
  filenamePrefix: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}

function DashboardDrilldownDialog({
  table,
  onClose,
}: {
  table: DrilldownTable | null;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sortIndex, setSortIndex] = useState(0);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const visibleRows = useMemo(() => {
    if (!table) return [];
    const filtered = table.rows.filter((row) =>
      row.join(" ").toLowerCase().includes(query.trim().toLowerCase()),
    );
    return [...filtered].sort((left, right) => {
      const compared = String(left[sortIndex] ?? "").localeCompare(
        String(right[sortIndex] ?? ""),
        undefined,
        {
          numeric: true,
          sensitivity: "base",
        },
      );
      return sortDir === "asc" ? compared : -compared;
    });
  }, [query, sortDir, sortIndex, table]);

  // Reset pagination to first page when search query, sort index/dir, or active table changes
  useEffect(() => {
    setCurrentPage(1);
  }, [query, sortIndex, sortDir, table]);

  if (!table) return null;

  const setSort = (index: number) => {
    if (sortIndex === index) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortIndex(index);
      setSortDir("asc");
    }
  };

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRows = visibleRows.slice(startIndex, startIndex + pageSize);

  const subtitle = `Showing ${visibleRows.length > 0 ? startIndex + 1 : 0}–${Math.min(
    startIndex + pageSize,
    visibleRows.length,
  )} of ${visibleRows.length} rows · Generated: ${new Date().toLocaleString()}`;

  return (
    <Dialog open={Boolean(table)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>{table.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="max-w-2xl text-xs text-muted-foreground">{table.description}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  ExportImportService.downloadGenericTableCSV(
                    table.columns,
                    visibleRows,
                    table.filenamePrefix,
                  )
                }
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  ExportImportService.exportGenericTableExcel(
                    table.title,
                    table.columns,
                    visibleRows,
                    table.filenamePrefix,
                  )
                }
              >
                <Download className="h-3.5 w-3.5" />
                Excel
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  ExportImportService.exportGenericTableJson(
                    table.columns,
                    visibleRows,
                    table.filenamePrefix,
                  )
                }
              >
                <Download className="h-3.5 w-3.5" />
                JSON
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  ExportImportService.exportGenericTablePdf(
                    table.title,
                    table.columns,
                    visibleRows,
                    subtitle,
                  )
                }
              >
                <Download className="h-3.5 w-3.5" />
                PDF
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter drilldown rows..."
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="max-h-[380px] overflow-auto custom-scrollbar rounded-md border">
            <table className="erp-table min-w-full">
              <thead>
                <tr>
                  {table.columns.map((column, index) => (
                    <th key={column}>
                      <button
                        type="button"
                        onClick={() => setSort(index)}
                        className="inline-flex items-center gap-1"
                      >
                        {column}
                        {sortIndex === index && (
                          <span className="text-[10px] text-muted-foreground">
                            {sortDir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row, rowIndex) => (
                  <tr key={`${table.filenamePrefix}-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${table.filenamePrefix}-${rowIndex}-${cellIndex}`}>
                        {String(cell ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded-md border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
              >
                {[5, 10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground ml-4">{subtitle}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Prev
              </Button>
              <span className="px-3 text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const snapshot = DashboardDataService.getCachedOrBuild();
  const [drilldownKey, setDrilldownKey] = useState<string | null>(null);

  const documents = [...snapshot.documents.data]
    .sort((a, b) => parseDateSafe(b.date) - parseDateSafe(a.date))
    .slice(0, 6);
  const approvals = [...snapshot.approvals.data]
    .filter((item) => item.status !== "Approved")
    .sort((a, b) => parseDateSafe(a.dueDate) - parseDateSafe(b.dueDate))
    .slice(0, 5);
  const activeCases = [...snapshot.cases.data]
    .filter((item) => !["Closed", "Resolved"].includes(item.status))
    .slice(0, 4);
  const notifications = [...snapshot.notifications.data].slice(0, 4);
  const products = [...snapshot.products.data].slice(0, 4);
  const dedupSavings = snapshot.dedupGroups.data.reduce(
    (total, group) => total + group.potentialSavingsBytes,
    0,
  );
  const ocrAttention = snapshot.ocrJobs.processing + snapshot.ocrJobs.failed;
  const approvalRatio = Math.round(
    (snapshot.approvals.pending / Math.max(snapshot.approvals.total, 1)) * 100,
  );
  const documentRatio = Math.round(
    (snapshot.documents.approved / Math.max(snapshot.documents.total, 1)) * 100,
  );

  const drilldowns = useMemo<Record<string, DrilldownTable>>(
    () => ({
      documents: {
        title: "Controlled Documents Drilldown",
        description: "Document-level rows behind the dashboard document KPI.",
        filenamePrefix: "dashboard-documents",
        columns: [
          "Document ID",
          "Title",
          "Status",
          "Revision",
          "Type",
          "Owner",
          "Linked PL",
          "Date",
        ],
        rows: snapshot.documents.data.map((document) => [
          document.id,
          document.name,
          document.status,
          document.revision,
          document.type,
          document.owner,
          document.linkedPL ?? "—",
          document.date,
        ]),
      },
      approvals: {
        title: "Approval Queue Drilldown",
        description: "Pending and active approval records backing the dashboard queue KPI.",
        filenamePrefix: "dashboard-approvals",
        columns: [
          "Approval ID",
          "Title",
          "Type",
          "Status",
          "Requester",
          "Urgency",
          "Linked Doc",
          "Due Date",
        ],
        rows: snapshot.approvals.data.map((approval) => [
          approval.id,
          approval.title,
          approval.type,
          approval.status,
          approval.requester,
          approval.urgency,
          approval.linkedDoc,
          approval.dueDate,
        ]),
      },
      ocr: {
        title: "OCR Attention Drilldown",
        description: "OCR processing and failure records used by the dashboard attention KPI.",
        filenamePrefix: "dashboard-ocr-attention",
        columns: [
          "Job ID",
          "Document",
          "Filename",
          "Status",
          "Confidence",
          "Pages",
          "Started",
          "Ended",
        ],
        rows: snapshot.ocrJobs.data.map((job) => [
          job.id,
          job.document,
          job.filename,
          job.status,
          job.confidence == null ? "—" : `${job.confidence}%`,
          job.pages,
          job.startTime || "—",
          job.endTime || "—",
        ]),
      },
      cases: {
        title: "Open Cases Drilldown",
        description: "Case records behind the dashboard open-case and severity KPIs.",
        filenamePrefix: "dashboard-cases",
        columns: ["Case ID", "Title", "Status", "Severity", "Assignee", "Linked PL", "Created"],
        rows: snapshot.cases.data.map((item) => [
          item.id,
          item.title,
          item.status,
          item.severity,
          item.assignee,
          item.linkedPL,
          item.created,
        ]),
      },
      workload: {
        title: "Operational Workload Drilldown",
        description: "Work ledger rows behind current operational workload cards.",
        filenamePrefix: "dashboard-workload",
        columns: [
          "Work ID",
          "Title",
          "Type",
          "Status",
          "Priority",
          "Assignee",
          "Linked PL",
          "Date",
        ],
        rows: snapshot.workRecords.data.map((record) => [
          record.id,
          record.title,
          record.type,
          record.status,
          record.priority,
          record.assignee,
          record.linkedPL,
          record.date,
        ]),
      },
    }),
    [snapshot],
  );

  const activityItems = [
    ...approvals.slice(0, 2).map((approval) => ({
      id: approval.id,
      title: approval.title,
      meta: `${approval.requester} · due ${formatCompactDate(approval.dueDate)}`,
      status: approval.status,
      onClick: () => navigate("/approvals"),
    })),
    ...activeCases.slice(0, 2).map((item) => ({
      id: item.id,
      title: item.title,
      meta: `${item.assignee} · ${item.linkedPL}`,
      status: item.status,
      onClick: () => navigate("/cases"),
    })),
  ];

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Operations
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate("/search")}>
            <Search className="h-3.5 w-3.5" />
            Search
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/reports")}>
            <BarChart3 className="h-3.5 w-3.5" />
            Reports
          </Button>
          <Button size="sm" onClick={() => navigate("/documents")}>
            <FolderOpen className="h-3.5 w-3.5" />
            Documents
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="flex flex-col gap-4">
        <TabsList className="h-8 w-fit rounded-md border bg-card p-0.5">
          <TabsTrigger value="overview" className="h-7 px-3 text-xs">
            Overview
          </TabsTrigger>
          <TabsTrigger value="analytics" className="h-7 px-3 text-xs">
            Analytics
          </TabsTrigger>
          <TabsTrigger value="reports" className="h-7 px-3 text-xs">
            Reports
          </TabsTrigger>
          <TabsTrigger value="notifications" className="h-7 px-3 text-xs">
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="m-0 flex flex-col gap-4">
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Controlled Documents"
              value={snapshot.documents.total.toLocaleString()}
              description={`${snapshot.documents.approved.toLocaleString()} approved · ${documentRatio}% release ready`}
              trend={`${documentRatio}% ready`}
              tone="good"
              icon={FileText}
              values={sparkValues(snapshot.documents.total, snapshot.documents.approved)}
              onClick={() => setDrilldownKey("documents")}
            />
            <MetricCard
              title="Approval Queue"
              value={snapshot.approvals.pending.toLocaleString()}
              description={`${approvalRatio}% of approval records are still pending`}
              trend={`${approvalRatio}% pending`}
              tone={snapshot.approvals.pending > 0 ? "warning" : "good"}
              icon={CheckSquare}
              values={sparkValues(snapshot.approvals.total, snapshot.approvals.pending)}
              onClick={() => setDrilldownKey("approvals")}
            />
            <MetricCard
              title="OCR Attention"
              value={ocrAttention.toLocaleString()}
              description={`${snapshot.ocrJobs.failed} failed · ${snapshot.ocrJobs.processing} processing`}
              trend={snapshot.ocrJobs.failed > 0 ? "needs review" : "stable"}
              tone={snapshot.ocrJobs.failed > 0 ? "danger" : "neutral"}
              icon={Activity}
              values={sparkValues(snapshot.ocrJobs.total, ocrAttention)}
              onClick={() => setDrilldownKey("ocr")}
            />
            <MetricCard
              title="Open Cases"
              value={snapshot.cases.open.toLocaleString()}
              description={`${snapshot.cases.highSeverity} high severity investigations open`}
              trend={`${snapshot.cases.highSeverity} high`}
              tone={snapshot.cases.highSeverity > 0 ? "danger" : "neutral"}
              icon={ShieldAlert}
              values={sparkValues(snapshot.cases.total, snapshot.cases.highSeverity)}
              onClick={() => setDrilldownKey("cases")}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
            <Card className="shadow-sm border-border/50 bg-card/40 backdrop-blur-md">
              <CardHeader className="flex flex-row items-start justify-between gap-4 p-3">
                <div>
                  <CardTitle className="text-base">Operational Load</CardTitle>
                  <CardDescription className="text-xs">
                    Current workload grouped by controlled business area.
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate("/health")}>
                  System Health
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDrilldownKey("workload")}>
                  Drilldown
                </Button>
              </CardHeader>
              <CardContent className="grid gap-3 p-3 pt-0 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-xl border border-border/50 bg-background/50 p-3">
                  <MiniBarChart
                    rows={[
                      {
                        label: "Documents",
                        value: snapshot.documents.total,
                        tone: "neutral",
                      },
                      {
                        label: "Work records",
                        value: snapshot.workRecords.total,
                        tone: "neutral",
                      },
                      {
                        label: "PL items",
                        value: snapshot.plItems.total,
                        tone: "good",
                      },
                      {
                        label: "Approvals",
                        value: snapshot.approvals.pending,
                        tone: "warning",
                      },
                      {
                        label: "Cases",
                        value: snapshot.cases.open,
                        tone: "danger",
                      },
                    ]}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <div className="rounded-xl border border-border/50 bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground">Deduplication savings</p>
                    <p className="mt-2 font-mono text-xl font-semibold">
                      {formatBytes(dedupSavings)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground">Reports available</p>
                    <p className="mt-2 font-mono text-xl font-semibold">
                      {snapshot.reports.total.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background/50 p-3">
                    <p className="text-xs text-muted-foreground">Unread notices</p>
                    <p className="mt-2 font-mono text-xl font-semibold">
                      {snapshot.notifications.unread.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/50 bg-card/40 backdrop-blur-md">
              <CardHeader className="p-3">
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <CardDescription className="text-xs">
                  Approval and case items requiring operator focus.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <ActivityList items={activityItems} />
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
            <Card className="shadow-sm border-border/50 bg-card/40 backdrop-blur-md">
              <CardHeader className="flex flex-row items-start justify-between gap-4 p-3">
                <div>
                  <CardTitle className="text-base">Controlled Documents</CardTitle>
                  <CardDescription className="text-xs">
                    Latest documents from the existing dashboard data service.
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate("/documents")}>
                  View All
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-9 px-4 text-xs">Document</TableHead>
                      <TableHead className="h-9 text-xs">Owner</TableHead>
                      <TableHead className="h-9 text-xs">Status</TableHead>
                      <TableHead className="h-9 text-right text-xs">Date</TableHead>
                      <TableHead className="h-9 w-[96px] text-right text-xs">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((document) => (
                      <TableRow
                        key={document.id}
                        {...getDocumentContextAttributes(document.id, document.name)}
                      >
                        <TableCell className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/documents/${document.id}`)}
                            className="min-w-0 text-left"
                          >
                            <p className="truncate text-sm font-medium">{document.name}</p>
                            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                              {document.id} · Rev {document.revision}
                            </p>
                          </button>
                        </TableCell>
                        <TableCell className="py-2 text-sm">{document.owner}</TableCell>
                        <TableCell className="py-2">
                          <StatusBadge variant={statusVariant(document.status)} size="sm">
                            {document.status}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="py-2 text-right text-xs text-muted-foreground">
                          {formatCompactDate(document.date)}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <DocumentPreviewButton
                            documentId={document.id}
                            title={document.name}
                            variant="ghost"
                            label="Preview"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border/50 bg-card/40 backdrop-blur-md">
              <CardHeader className="flex flex-row items-start justify-between gap-4 p-3">
                <div>
                  <CardTitle className="text-base">Product Teams</CardTitle>
                  <CardDescription className="text-xs">
                    Production and development items from the configured product list.
                  </CardDescription>
                </div>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="flex flex-col gap-3 p-3 pt-0">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{product.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {product.category} · Rev {product.revision}
                      </p>
                    </div>
                    <StatusBadge
                      variant={product.lifecycle === "Production" ? "success" : "processing"}
                      size="sm"
                    >
                      {product.lifecycle}
                    </StatusBadge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="analytics" className="m-0 grid gap-4 xl:grid-cols-2">
          <Card className="shadow-sm border-border/50 bg-card/40 backdrop-blur-md">
            <CardHeader className="p-3">
              <CardTitle className="text-base">Workload Analytics</CardTitle>
              <CardDescription className="text-xs">
                Dense summary of records, approvals, cases, and OCR load.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <MiniBarChart
                rows={[
                  { label: "Completed work", value: snapshot.workRecords.completed, tone: "good" },
                  { label: "In progress", value: snapshot.workRecords.inProgress, tone: "warning" },
                  { label: "OCR failed", value: snapshot.ocrJobs.failed, tone: "danger" },
                  { label: "OCR processing", value: snapshot.ocrJobs.processing, tone: "neutral" },
                ]}
              />
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50 bg-card/40 backdrop-blur-md">
            <CardHeader className="p-3">
              <CardTitle className="text-base">Approval Queue</CardTitle>
              <CardDescription className="text-xs">
                Pending sign-off records sorted by due date.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-9 px-4 text-xs">Request</TableHead>
                    <TableHead className="h-9 text-xs">Requester</TableHead>
                    <TableHead className="h-9 text-xs">Due</TableHead>
                    <TableHead className="h-9 text-right text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvals.map((approval) => (
                    <TableRow key={approval.id}>
                      <TableCell className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => navigate("/approvals")}
                          className="min-w-0 text-left"
                        >
                          <p className="truncate text-sm font-medium">{approval.title}</p>
                          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                            {approval.id}
                          </p>
                        </button>
                      </TableCell>
                      <TableCell className="py-2 text-sm">{approval.requester}</TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        {formatCompactDate(approval.dueDate)}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <StatusBadge variant={statusVariant(approval.status)} size="sm">
                          {approval.status}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="m-0 grid gap-4 xl:grid-cols-3">
          {snapshot.reports.data.slice(0, 6).map((report) => (
            <Card
              key={report.id}
              className="shadow-sm border-border/50 bg-card/40 backdrop-blur-md hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 transition-all duration-200"
            >
              <CardHeader className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-sm">{report.name}</CardTitle>
                    <CardDescription className="mt-1 text-xs">{report.category}</CardDescription>
                  </div>
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/reports/${report.id}`)}
                >
                  Open Report
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="notifications" className="m-0 grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <Card className="shadow-sm border-border/50 bg-card/40 backdrop-blur-md">
            <CardHeader className="p-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4" />
                Notifications
              </CardTitle>
              <CardDescription className="text-xs">
                Current notification feed from dashboard state.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <ActivityList
                items={notifications.map((item) => ({
                  id: item.id,
                  title: item.title,
                  meta: item.message,
                  status: item.read ? "Read" : "Open",
                  onClick: () => navigate("/notifications"),
                }))}
              />
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50 bg-card/40 backdrop-blur-md">
            <CardHeader className="p-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4" />
                Repository Health
              </CardTitle>
              <CardDescription className="text-xs">
                Storage and background processing indicators.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 p-3 pt-0">
              <div className="rounded-xl border border-border/50 bg-background/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Duplicate groups pending</span>
                  <span className="font-mono text-sm font-semibold">
                    {snapshot.dedupGroups.pending}
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">OCR jobs total</span>
                  <span className="font-mono text-sm font-semibold">{snapshot.ocrJobs.total}</span>
                </div>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Audit entries</span>
                  <span className="font-mono text-sm font-semibold">
                    {snapshot.auditLog.length}
                  </span>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate("/admin/deduplication")}>
                Open Deduplication
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {snapshot.ocrJobs.failed > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/40 backdrop-blur-md p-3 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            <p className="truncate text-sm text-muted-foreground">
              {snapshot.ocrJobs.failed} OCR job(s) failed and may block preview or search accuracy.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate("/ocr")}>
            Review
          </Button>
        </div>
      )}

      <DashboardDrilldownDialog
        table={drilldownKey ? drilldowns[drilldownKey] : null}
        onClose={() => setDrilldownKey(null)}
      />
    </div>
  );
}
