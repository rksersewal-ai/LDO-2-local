import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Download,
  FileSearch,
  Filter,
  Info,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { DataTable, type DataTableColumn } from "../components/ui/DataTable";
import { DatePicker } from "../components/ui/DatePicker";
import { EmptyState } from "../components/ui/EmptyState";
import { Badge, Button, GlassCard, Input, PageHeader } from "../components/ui/Shared";
import { MOCK_AUDIT_EXTENDED } from "../lib/mockExtended";

type AuditEvent = (typeof MOCK_AUDIT_EXTENDED)[number] & {
  details?: string;
};

const severityVariant = (s: string) => {
  if (s === "Critical") return "danger" as const;
  if (s === "Warning") return "warning" as const;
  return "default" as const;
};
const severityIcon = (s: string) => {
  if (s === "Critical") return <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
  if (s === "Warning") return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
  return <Info className="w-3.5 h-3.5 text-muted-foreground" />;
};

const PAGE_SIZE = 20;

export default function AuditLog() {
  const [moduleFilter, setModuleFilter] = useState<string>("All");
  const [severityFilter, setSeverityFilter] = useState<string>("All");
  const [userFilter, setUserFilter] = useState<string>("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [page, setPage] = useState(1);

  const modules = useMemo(
    () => ["All", ...Array.from(new Set(MOCK_AUDIT_EXTENDED.map((e) => e.module))).sort()],
    [],
  );
  const users = useMemo(
    () => ["All", ...Array.from(new Set(MOCK_AUDIT_EXTENDED.map((e) => e.user))).sort()],
    [],
  );

  const filtered = useMemo(() => {
    return MOCK_AUDIT_EXTENDED.filter((e) => {
      if (moduleFilter !== "All" && e.module !== moduleFilter) return false;
      if (severityFilter !== "All" && e.severity !== severityFilter) return false;
      if (userFilter !== "All" && e.user !== userFilter) return false;
      if (
        search &&
        !e.action.toLowerCase().includes(search.toLowerCase()) &&
        !e.user.toLowerCase().includes(search.toLowerCase()) &&
        !e.entity.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      if (dateFrom) {
        const evDate = e.time?.split(" ")[0] ?? "";
        if (evDate < dateFrom) return false;
      }
      if (dateTo) {
        const evDate = e.time?.split(" ")[0] ?? "";
        if (evDate > dateTo) return false;
      }
      return true;
    });
  }, [moduleFilter, severityFilter, userFilter, search, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [filtered]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilters = [
    moduleFilter !== "All",
    severityFilter !== "All",
    userFilter !== "All",
    !!dateFrom,
    !!dateTo,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setModuleFilter("All");
    setSeverityFilter("All");
    setUserFilter("All");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  };

  const exportCSV = () => {
    const headers = [
      "Event ID",
      "Severity",
      "Action",
      "Module",
      "Entity",
      "User",
      "IP Address",
      "Timestamp",
      "Details",
    ];
    const rows = filtered.map((e) => [
      e.id,
      e.severity,
      e.action,
      e.module,
      e.entity,
      e.user,
      e.ip,
      e.time,
      (e as AuditEvent).details ?? "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const headers = [
      "Event ID",
      "Severity",
      "Action",
      "Module",
      "Entity",
      "User",
      "IP Address",
      "Timestamp",
      "Details",
    ];
    const rows = filtered.map((e) => [
      e.id,
      e.severity,
      e.action,
      e.module,
      e.entity,
      e.user,
      e.ip,
      e.time,
      (e as AuditEvent).details ?? "",
    ]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map((_, i) => ({
      wch: i === 2 ? 35 : i === 8 ? 50 : 18,
    }));
    XLSX.utils.book_append_sheet(wb, ws, "Audit Log");
    XLSX.writeFile(wb, `audit-log-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const auditColumns = useMemo<DataTableColumn<AuditEvent>[]>(
    () => [
      {
        key: "id",
        header: "Event ID",
        cell: (event) => <span className="font-mono text-xs text-primary">{event.id}</span>,
      },
      {
        key: "severity",
        header: "Severity",
        cell: (event) => (
          <div className="flex items-center gap-1.5">
            {severityIcon(event.severity)}
            <Badge variant={severityVariant(event.severity)}>{event.severity}</Badge>
          </div>
        ),
      },
      {
        key: "action",
        header: "Action",
        cell: (event) => (
          <span className="font-mono text-xs text-foreground/90">{event.action}</span>
        ),
      },
      {
        key: "module",
        header: "Module",
        cell: (event) => <span className="text-xs text-muted-foreground">{event.module}</span>,
      },
      {
        key: "entity",
        header: "Entity",
        cell: (event) => <span className="font-mono text-xs text-foreground">{event.entity}</span>,
      },
      {
        key: "user",
        header: (
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            User
          </span>
        ),
        cell: (event) => <span className="text-xs text-foreground/90">{event.user}</span>,
      },
      {
        key: "ip",
        header: "IP Address",
        cell: (event) => (
          <span className="font-mono text-xs text-muted-foreground">{event.ip}</span>
        ),
      },
      {
        key: "time",
        header: "Timestamp",
        cell: (event) => <span className="text-xs text-muted-foreground">{event.time}</span>,
      },
    ],
    [],
  );

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Audit Log"
        subtitle="System-wide event traceability and investigation workspace"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={exportCSV}>
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={exportExcel}>
              <Download className="w-3.5 h-3.5" /> Excel
            </Button>
          </div>
        }
      />

      <GlassCard className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md">
        {/* Search + Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <FileSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by user, entity, action..."
              className="pl-9 w-full h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Module filter */}
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="bg-slate-950/50 border border-border/50 text-foreground text-xs rounded-md px-3 h-9 focus:outline-none focus:border-teal-500/40"
          >
            {modules.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>

          {/* Severity filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-950/50 border border-border/50 text-foreground text-xs rounded-md px-3 h-9 focus:outline-none focus:border-teal-500/40"
          >
            {["All", "Critical", "Warning", "Info"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>

          {/* User filter */}
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="bg-slate-950/50 border border-border/50 text-foreground text-xs rounded-md px-3 h-9 focus:outline-none focus:border-teal-500/40"
          >
            {users.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>

          {activeFilters > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 h-9 rounded-md text-xs font-medium bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Clear ({activeFilters})
            </button>
          )}
        </div>

        {/* Date range row */}
        <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 text-slate-600" />
            <span>Date range:</span>
          </div>
          <DatePicker
            value={dateFrom}
            onChange={setDateFrom}
            placeholder="Start date"
            maxDate={dateTo || undefined}
            className="w-[168px]"
          />
          <span className="text-slate-600 text-xs">to</span>
          <DatePicker
            value={dateTo}
            onChange={setDateTo}
            placeholder="End date"
            minDate={dateFrom || undefined}
            className="w-[168px]"
          />
          <span className="text-xs text-muted-foreground ml-auto">
            <span className="text-primary font-semibold">{filtered.length}</span> events
            {activeFilters > 0 && (
              <span className="text-muted-foreground">
                {" "}
                (filtered from {MOCK_AUDIT_EXTENDED.length})
              </span>
            )}
          </span>
        </div>

        <DataTable
          data={paginated}
          columns={auditColumns}
          density="normal"
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={filtered.length}
          onPageChange={setPage}
          emptyMessage="No audit events match your filters."
          emptyState={
            <EmptyState
              icon={Filter}
              title="No audit events match"
              description="Adjust the filters or clear them to return to the full audit stream."
              primaryAction={
                <Button type="button" size="sm" variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
              className="border-0 bg-transparent shadow-none"
            />
          }
          onRowClick={(event) => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
          getRowClassName={(event) => (selectedEvent?.id === event.id ? "bg-secondary/50" : "")}
        />

        {/* Expanded event detail */}
        {selectedEvent && (
          <div className="mt-4 rounded-lg border border-border bg-secondary/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground">
                Event Detail: <span className="font-mono text-primary">{selectedEvent.id}</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(selectedEvent).map(([k, v]) => (
                <div key={k}>
                  <p className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wider font-semibold">
                    {k}
                  </p>
                  <p className="text-xs font-mono text-foreground break-all">{String(v)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </GlassCard>
    </div>
  );
}
