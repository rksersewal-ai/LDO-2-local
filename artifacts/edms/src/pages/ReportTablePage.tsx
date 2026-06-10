import { ArrowLeft, ArrowUpDown, Download, FileText, RefreshCw, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { DatePicker } from "../components/ui/DatePicker";
import { Badge, Button, GlassCard, Input } from "../components/ui/Shared";
import {
  getReportDefinition,
  parseReportDate,
  type ReportColumn,
  type ReportRow,
} from "../lib/reporting";
import { ExportImportService } from "../services/ExportImportService";

function getStatusVariant(status: string) {
  if (status === "Ready") return "success";
  if (status === "Generating") return "processing";
  return "warning";
}

function buildExportRows(rows: ReportRow[], columns: ReportColumn[]) {
  return rows.map((row) => columns.map((column) => String(row[column.key] ?? "—")));
}

export default function ReportTablePage() {
  const navigate = useNavigate();
  const { reportId } = useParams<{ reportId: string }>();
  const report = getReportDefinition(reportId);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [refreshStamp, setRefreshStamp] = useState(Date.now());
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [slicerKey, setSlicerKey] = useState("");
  const [slicerValue, setSlicerValue] = useState("All");

  const allRows = useMemo(() => (report ? report.getRows() : []), [report, refreshStamp]);

  const slicerColumns = useMemo(() => {
    if (!report) return [];
    return report.columns
      .map((column) => ({
        ...column,
        values: Array.from(
          new Set(allRows.map((row) => String(row[column.key] ?? "—")).filter(Boolean)),
        ).sort(),
      }))
      .filter((column) => column.values.length > 1 && column.values.length <= 12);
  }, [allRows, report]);

  const filteredRows = useMemo(() => {
    const filtered = allRows.filter((row) => {
      const rowDate = parseReportDate(row[report?.dateKey ?? ""]);
      const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
      const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
      const matchesDate =
        (!fromTime || (rowDate != null && rowDate >= fromTime)) &&
        (!toTime || (rowDate != null && rowDate <= toTime));

      const haystack = Object.values(row).join(" ").toLowerCase();
      const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
      const matchesSlicer =
        !slicerKey || slicerValue === "All" || String(row[slicerKey] ?? "—") === slicerValue;
      return matchesDate && matchesSearch && matchesSlicer;
    });

    if (!sortKey) return filtered;

    return [...filtered].sort((left, right) => {
      const compared = String(left[sortKey] ?? "").localeCompare(
        String(right[sortKey] ?? ""),
        undefined,
        { numeric: true, sensitivity: "base" },
      );
      return sortDir === "asc" ? compared : -compared;
    });
  }, [allRows, dateFrom, dateTo, report, search, slicerKey, slicerValue, sortDir, sortKey]);

  const activeSlicer = slicerColumns.find((column) => column.key === slicerKey);

  const setSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  useEffect(() => {
    if (detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [reportId]);

  if (!report) {
    return (
      <div className="max-w-5xl mx-auto">
        <GlassCard className="p-8 text-center">
          <h1 className="text-xl font-bold text-white">Report not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The selected report definition does not exist.
          </p>
          <Button className="mt-4" onClick={() => navigate("/reports")}>
            <ArrowLeft className="w-4 h-4" /> Back to Reports
          </Button>
        </GlassCard>
      </div>
    );
  }

  const exportRows = buildExportRows(filteredRows, report.columns);
  const exportHeaders = report.columns.map((column) => column.label);
  const subtitle = [
    `Rows: ${filteredRows.length}`,
    dateFrom ? `From: ${dateFrom}` : null,
    dateTo ? `To: ${dateTo}` : null,
    slicerKey && slicerValue !== "All"
      ? `${activeSlicer?.label ?? slicerKey}: ${slicerValue}`
      : null,
    sortKey
      ? `Sorted: ${report.columns.find((column) => column.key === sortKey)?.label ?? sortKey} ${sortDir}`
      : null,
    `Refreshed: ${new Date(refreshStamp).toLocaleString()}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div ref={detailRef} className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate("/reports")}
            className="mb-3 inline-flex items-center gap-2 text-xs text-primary/90 hover:text-teal-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to reports
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-foreground">{report.name}</h1>
            <Badge variant={getStatusVariant(report.status)}>{report.status}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{report.description}</p>
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="secondary" size="sm" onClick={() => setRefreshStamp(Date.now())}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh snapshot
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              ExportImportService.downloadGenericTableCSV(
                exportHeaders,
                exportRows,
                report.filenamePrefix,
              )
            }
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              ExportImportService.exportGenericTableExcel(
                report.name,
                exportHeaders,
                exportRows,
                report.filenamePrefix,
              )
            }
          >
            <Download className="w-3.5 h-3.5" /> Excel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              ExportImportService.exportGenericTableJson(
                exportHeaders,
                exportRows,
                report.filenamePrefix,
              )
            }
          >
            <Download className="w-3.5 h-3.5" /> JSON
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              ExportImportService.exportGenericTablePdf(
                report.name,
                exportHeaders,
                exportRows,
                subtitle,
              )
            }
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </Button>
          <Button
            size="sm"
            onClick={() =>
              ExportImportService.exportGenericTableWord(
                report.name,
                exportHeaders,
                exportRows,
                report.filenamePrefix,
                subtitle,
              )
            }
          >
            <FileText className="w-3.5 h-3.5" /> Word
          </Button>
        </div>
      </div>

      <GlassCard className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <DatePicker
            label="Date From"
            value={dateFrom}
            onChange={setDateFrom}
            placeholder="All dates"
          />
          <DatePicker label="Date To" value={dateTo} onChange={setDateTo} placeholder="All dates" />
          <label className="flex flex-col gap-1.5">
            <span className="block text-xs font-medium text-muted-foreground">Slicer</span>
            <select
              value={slicerKey}
              onChange={(event) => {
                setSlicerKey(event.target.value);
                setSlicerValue("All");
              }}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="">None</option>
              {slicerColumns.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="block text-xs font-medium text-muted-foreground">Slice Value</span>
            <select
              value={slicerValue}
              disabled={!slicerKey}
              onChange={(event) => setSlicerValue(event.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground disabled:opacity-60"
            >
              <option value="All">All</option>
              {activeSlicer?.values.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">
              Search In Rows
            </span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by ID, title, user, PL, document, status..."
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="info">{filteredRows.length} rows</Badge>
            <Badge variant="default">{report.category}</Badge>
            <span className="text-xs text-muted-foreground">Generated {report.generated}</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
              setSearch("");
              setSlicerKey("");
              setSlicerValue("All");
              setSortKey("");
              setSortDir("asc");
            }}
          >
            <X className="w-3.5 h-3.5" /> Reset Filters
          </Button>
        </div>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>

        {filteredRows.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-foreground/90 font-medium">No rows available</p>
            <p className="mt-2 text-sm text-muted-foreground">{report.emptyState}</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[70vh]">
            <table className="erp-table w-full min-w-[980px]">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-border">
                  {report.columns.map((column) => (
                    <th
                      key={column.key}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${column.align === "right" ? "text-right" : "text-left"}`}
                    >
                      <button
                        type="button"
                        onClick={() => setSort(column.key)}
                        className={`inline-flex items-center gap-1 ${column.align === "right" ? "justify-end" : ""}`}
                      >
                        {column.label}
                        <ArrowUpDown className="w-3 h-3" />
                        {sortKey === column.key && (
                          <span className="text-[10px]">{sortDir === "asc" ? "↑" : "↓"}</span>
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, rowIndex) => (
                  <tr
                    key={`${report.id}-${rowIndex}`}
                    className="border-b border-border hover:bg-card/30 transition-colors"
                  >
                    {report.columns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-4 py-3 text-sm ${column.align === "right" ? "text-right" : "text-left"} ${column.mono ? "font-mono text-primary/90" : "text-foreground"}`}
                      >
                        {String(row[column.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
