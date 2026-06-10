import { ArrowRight, BarChart3, Download, Search } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { useNavigate } from "react-router";

const ReportsBarChart = lazy(() => import("../components/charts/ReportsBarChart"));
const ReportsPieChart = lazy(() => import("../components/charts/ReportsPieChart"));

import { Badge, Button, GlassCard, Input } from "../components/ui/Shared";
import { MOCK_DOCUMENTS } from "../lib/mock";
import { MOCK_WORK_LEDGER } from "../lib/mockExtended";
import { getReportDefinition, REPORT_DEFINITIONS } from "../lib/reporting";
import { cn } from "../lib/utils";
import { ExportImportService } from "../services/ExportImportService";

const docStatusData = [
  {
    name: "Approved",
    value: MOCK_DOCUMENTS.filter((d) => d.status === "Approved").length,
  },
  {
    name: "In Review",
    value: MOCK_DOCUMENTS.filter((d) => d.status === "In Review").length,
  },
  {
    name: "Draft",
    value: MOCK_DOCUMENTS.filter((d) => d.status === "Draft").length,
  },
  {
    name: "Obsolete",
    value: MOCK_DOCUMENTS.filter((d) => d.status === "Obsolete").length,
  },
];

const workByType = [
  {
    type: "Inspection",
    count: MOCK_WORK_LEDGER.filter((r) => r.type === "Inspection").length,
  },
  {
    type: "Calibration",
    count: MOCK_WORK_LEDGER.filter((r) => r.type === "Calibration").length,
  },
  {
    type: "Review",
    count: MOCK_WORK_LEDGER.filter((r) => r.type === "Review").length,
  },
  {
    type: "Reporting",
    count: MOCK_WORK_LEDGER.filter((r) => r.type === "Reporting").length,
  },
  {
    type: "Audit",
    count: MOCK_WORK_LEDGER.filter((r) => r.type === "Audit").length,
  },
];

function getStatusVariant(status: string) {
  if (status === "Ready") return "success";
  if (status === "Generating") return "processing";
  return "warning";
}

export default function Reports() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const [sort, setSort] = useState<"name" | "category" | "rows">("name");

  const reportCards = useMemo(
    () =>
      REPORT_DEFINITIONS.map((report) => ({
        ...report,
        rowCount: getReportDefinition(report.id)?.getRows().length ?? 0,
      })),
    [],
  );
  const categoryOptions = [
    "All",
    ...Array.from(new Set(reportCards.map((report) => report.category))).sort(),
  ];
  const statusOptions = [
    "All",
    ...Array.from(new Set(reportCards.map((report) => report.status))).sort(),
  ];
  const filteredReports = reportCards
    .filter((report) => {
      const haystack =
        `${report.name} ${report.description} ${report.category} ${report.status}`.toLowerCase();
      return (
        (!search.trim() || haystack.includes(search.trim().toLowerCase())) &&
        (category === "All" || report.category === category) &&
        (status === "All" || report.status === status)
      );
    })
    .sort((left, right) => {
      if (sort === "rows") return right.rowCount - left.rowCount;
      return String(left[sort]).localeCompare(String(right[sort]));
    });

  const exportCatalog = (format: "csv" | "json") => {
    const headers = ["Report", "Category", "Status", "Rows", "Generated", "Description"];
    const rows = filteredReports.map((report) => [
      report.name,
      report.category,
      report.status,
      report.rowCount,
      report.generated,
      report.description,
    ]);
    if (format === "csv") {
      ExportImportService.downloadGenericTableCSV(headers, rows, "report-catalog");
    } else {
      ExportImportService.exportGenericTableJson(headers, rows, "report-catalog");
    }
  };

  return (
    <div className="flex flex-col gap-4 max-w-7xl mx-auto">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
          <p className="text-muted-foreground text-xs">
            Operational summaries, analytics, slicers, and exportable report tables.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportCatalog("csv")}
            className="h-8 text-xs"
          >
            <Download className="w-3.5 h-3.5" /> Catalog CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportCatalog("json")}
            className="h-8 text-xs"
          >
            <Download className="w-3.5 h-3.5" /> Catalog JSON
          </Button>
        </div>
      </div>

      <GlassCard className="p-2.5">
        <div className="grid gap-2.5 md:grid-cols-[1fr_160px_140px_140px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 w-3.5 h-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find reports by name, category, status..."
              className="pl-9 h-8 text-xs"
            />
          </div>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          >
            {categoryOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          >
            {statusOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as "name" | "category" | "rows")}
            className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          >
            <option value="name">Sort by name</option>
            <option value="category">Sort by category</option>
            <option value="rows">Sort by row count</option>
          </select>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredReports.map((report) => (
          <div
            key={report.id}
            className="flex flex-col justify-between rounded-xl border bg-card/40 p-3.5 hover:border-primary/25 hover:bg-card/60 transition-all duration-200 cursor-pointer"
            onClick={() => navigate(`/reports/${report.id}`)}
          >
            <div>
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md border text-xs",
                    report.status === "Ready"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : report.status === "Generating"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20",
                  )}
                >
                  <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                </span>
                <Badge
                  variant={getStatusVariant(report.status)}
                  size="sm"
                  className="h-5 text-[9px] px-1.5 uppercase font-semibold"
                >
                  {report.status}
                </Badge>
              </div>
              <h3 className="text-xs font-semibold text-foreground mb-1 truncate">{report.name}</h3>
              <p className="text-[11px] text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
                {report.description}
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2.5 mt-auto text-[10px] text-muted-foreground">
              <span className="px-2 py-0.5 bg-secondary rounded text-muted-foreground uppercase font-semibold font-mono text-[9px]">
                {report.category}
              </span>
              <span className="font-mono">{report.rowCount} live rows</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-primary/90 font-medium">
              <span>Open live table</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard className="p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">
            Document Status Distribution
          </h2>
          <Suspense
            fallback={<div className="w-full h-[180px] animate-pulse bg-slate-800/30 rounded-xl" />}
          >
            <ReportsPieChart data={docStatusData} />
          </Suspense>
        </GlassCard>

        <GlassCard className="p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-3">
            Work Records by Type
          </h2>
          <Suspense
            fallback={<div className="w-full h-[180px] animate-pulse bg-slate-800/30 rounded-xl" />}
          >
            <ReportsBarChart data={workByType} />
          </Suspense>
        </GlassCard>
      </div>
    </div>
  );
}
