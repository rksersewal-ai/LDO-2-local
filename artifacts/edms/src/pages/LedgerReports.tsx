import { AlertCircle, CheckCircle, Clock, Download, FileBarChart, TrendingUp } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { SafeSection } from "../components/ui/SafeSection";
import { Button, GlassCard } from "../components/ui/Shared";
import { ExportImportService } from "../services/ExportImportService";
import { WorkLedgerService } from "../services/WorkLedgerService";

const LedgerWorkVolumeChart = lazy(() => import("../components/charts/LedgerWorkVolumeChart"));
const LedgerStatusChart = lazy(() => import("../components/charts/LedgerStatusChart"));
const LedgerAvgDaysChart = lazy(() => import("../components/charts/LedgerAvgDaysChart"));

const CATEGORY_LABEL: Record<string, string> = {
  GENERAL: "General",
  DRAWING: "Drawing",
  SPECIFICATION: "Specification",
  TENDER: "Tender",
  SHOP: "Shop",
  IC: "IC",
  AMENDMENT: "Amendment",
  VENDOR: "Vendor",
  EXTERNAL: "External",
  FAILURE: "Failure",
  INSPECTION: "Inspection",
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  SUBMITTED: "In Progress",
  VERIFIED: "Verified",
  CLOSED: "Closed",
};

type Analytics = Awaited<ReturnType<typeof WorkLedgerService.getAnalytics>>;

export default function LedgerReports() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [avgDays, setAvgDays] = useState(0);
  const [last12MonthsByCategory, setLast12MonthsByCategory] = useState<Record<string, number>>({});

  useEffect(() => {
    WorkLedgerService.getAnalytics().then(setAnalytics);
    WorkLedgerService.getAll().then((records) => {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 12);
      const cutoffStr = cutoff.toISOString().split("T")[0];

      const recent = records.filter((r) => r.date >= cutoffStr);
      const catCounts: Record<string, number> = {};
      recent.forEach((r) => {
        catCounts[r.workCategory] = (catCounts[r.workCategory] ?? 0) + 1;
      });
      setLast12MonthsByCategory(catCounts);

      const completed = records.filter((r) => r.daysTaken != null);
      if (completed.length > 0) {
        const avg = Math.round(
          completed.reduce((s, r) => s + (r.daysTaken ?? 0), 0) / completed.length,
        );
        setAvgDays(avg);
      }
    });
  }, []);

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
      </div>
    );
  }

  const categoryData = Object.entries(last12MonthsByCategory)
    .map(([cat, count]) => ({ name: CATEGORY_LABEL[cat] ?? cat, count }))
    .sort((a, b) => b.count - a.count);

  const statusData = analytics.byStatus.map((s) => ({
    name: STATUS_LABEL[s.status] ?? s.status,
    value: s.count,
    key: s.status,
  }));

  const avgDaysData = analytics.avgDaysByType
    .slice(0, 8)
    .map((t) => ({
      name: t.workType.length > 20 ? `${t.workType.substring(0, 20)}…` : t.workType,
      avg: t.avgDays,
      target: t.targetDays,
    }))
    .sort((a, b) => b.avg - a.avg);

  const stats = [
    {
      label: "Total Records",
      value: analytics.totalRecords,
      icon: <FileBarChart className="w-4 h-4 text-primary" />,
      color: "text-white",
    },
    {
      label: "On-Time Rate",
      value: `${analytics.onTimeRate}%`,
      icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
      color: analytics.onTimeRate >= 80 ? "text-emerald-400" : "text-amber-400",
    },
    {
      label: "Overdue",
      value: analytics.overdueCount,
      icon: <AlertCircle className="w-4 h-4 text-rose-400" />,
      color: analytics.overdueCount > 0 ? "text-rose-400" : "text-foreground/90",
    },
    {
      label: "Avg Completion",
      value: avgDays ? `${avgDays}d` : "—",
      icon: <Clock className="w-4 h-4 text-blue-400" />,
      color: "text-blue-300",
    },
  ];

  const handleExport = () => {
    const rows: Array<Array<string | number>> = [
      ["Total Records", analytics.totalRecords, "Current dataset"],
      ["On-Time Rate", `${analytics.onTimeRate}%`, "Operational KPI"],
      ["Overdue Count", analytics.overdueCount, "Active backlog"],
      ["Average Completion", avgDays ? `${avgDays} days` : "—", "Closed records"],
      ...avgDaysData.map((entry) => [
        entry.name,
        `${entry.avg} days`,
        `Target ${entry.target} days`,
      ]),
    ];

    ExportImportService.exportGenericTableExcel(
      "Work Ledger Report",
      ["Metric", "Value", "Context"],
      rows,
      "work-ledger-report",
    );
    toast.success("Work ledger report exported");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">Work Ledger Reports</h1>
          <p className="text-muted-foreground text-sm">
            Analytics and operational reporting for work records.
          </p>
        </div>
        <Button variant="secondary" onClick={handleExport}>
          <Download className="w-4 h-4" /> Export
        </Button>
      </div>

      {/* Summary stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => (
          <GlassCard
            key={s.label}
            className="p-3.5 flex items-center gap-3 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 transition-all duration-200"
          >
            <div className="w-9 h-9 rounded-xl bg-secondary/60 flex items-center justify-center shrink-0">
              {s.icon}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {s.label}
              </p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Work volume by category */}
        <SafeSection name="Work Volume Chart" minHeight="min-h-[300px]">
          <GlassCard className="p-3.5 hover:border-primary/20 transition-all duration-200 h-full">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <FileBarChart className="w-4 h-4 text-primary" /> Work Volume by Category (Last 12
              Months)
            </h2>
            {categoryData.length > 0 ? (
              <Suspense
                fallback={
                  <div className="w-full h-[240px] animate-pulse bg-slate-800/50 rounded-xl" />
                }
              >
                <LedgerWorkVolumeChart data={categoryData} />
              </Suspense>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                No category data yet
              </p>
            )}
          </GlassCard>
        </SafeSection>

        {/* Status distribution donut */}
        <SafeSection name="Status Distribution Chart" minHeight="min-h-[300px]">
          <GlassCard className="p-3.5 hover:border-primary/20 transition-all duration-200 h-full">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-primary" /> Records by Status
            </h2>
            {statusData.length > 0 ? (
              <Suspense
                fallback={
                  <div className="w-full h-[240px] animate-pulse bg-slate-800/50 rounded-xl" />
                }
              >
                <LedgerStatusChart data={statusData} />
              </Suspense>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">No status data yet</p>
            )}
          </GlassCard>
        </SafeSection>
      </div>

      {/* Avg days vs target — horizontal bar */}
      <SafeSection name="Completion Time Chart" minHeight="min-h-[300px]">
        <GlassCard className="p-3.5 hover:border-primary/20 transition-all duration-200 h-full">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Avg Days to Completion vs Target (by Work
            Type)
          </h2>
          {avgDaysData.length > 0 ? (
            <Suspense
              fallback={
                <div className="w-full h-[240px] animate-pulse bg-slate-800/50 rounded-xl" />
              }
            >
              <LedgerAvgDaysChart data={avgDaysData} />
            </Suspense>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">
              No completed records with day data yet
            </p>
          )}
        </GlassCard>
      </SafeSection>
    </div>
  );
}
