import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Database,
  Download,
  HardDrive,
  type LucideIcon,
  RefreshCw,
  Server,
} from "lucide-react";
import { lazy, type ReactNode, Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageContainer } from "../components/layout/PageContainer";
import { Badge, Button, GlassCard, PageHeader } from "../components/ui/Shared";
import { cn } from "../lib/utils";
import { type BackupRecord, SystemHealthService } from "../services/SystemHealthService";

const TelemetryChart = lazy(() => import("../components/charts/TelemetryChart"));

type IntegrationStatus = "healthy" | "warning" | "critical";

interface IntegrationModule {
  name: string;
  summary: string;
  status: IntegrationStatus;
  uptime: string;
  latency: string;
  lastCheck: string;
  icon: LucideIcon;
}

const generateMetricHistory = (base: number, variance: number) =>
  Array.from({ length: 20 }, (_, index) => ({
    time: `${20 - index}m`,
    value: Math.max(0, Math.min(100, base + (Math.random() - 0.5) * variance * 2)),
  })).reverse();

const INTEGRATIONS: IntegrationModule[] = [
  {
    name: "EDMS Web App",
    summary: "Primary operator workspace for documents, approvals, and release control.",
    status: "healthy",
    uptime: "99.98%",
    latency: "42ms",
    lastCheck: "5s ago",
    icon: Server,
  },
  {
    name: "API Server",
    summary: "Shared service layer handling request routing, orchestration, and data exchange.",
    status: "healthy",
    uptime: "99.95%",
    latency: "67ms",
    lastCheck: "5s ago",
    icon: Database,
  },
  {
    name: "OCR Pipeline",
    summary: "Document extraction lane for text capture, indexing readiness, and preview quality.",
    status: "warning",
    uptime: "97.2%",
    latency: "1.4s",
    lastCheck: "5s ago",
    icon: Activity,
  },
  {
    name: "Search Index",
    summary: "Retrieval layer powering fast lookups across metadata, OCR text, and links.",
    status: "healthy",
    uptime: "99.99%",
    latency: "12ms",
    lastCheck: "5s ago",
    icon: BarChart3,
  },
  {
    name: "Auth Service",
    summary: "Identity gate for session validation, access control, and admin boundaries.",
    status: "healthy",
    uptime: "100%",
    latency: "8ms",
    lastCheck: "5s ago",
    icon: CheckCircle,
  },
  {
    name: "Backup Service",
    summary:
      "Recovery workflow for scheduled snapshots, manual requests, and retention monitoring.",
    status: "healthy",
    uptime: "99.7%",
    latency: "Queued",
    lastCheck: "10m ago",
    icon: HardDrive,
  },
];

const SLOW_QUERIES = [
  {
    query: 'SELECT * FROM documents WHERE ocr_status = "Processing"',
    duration: "1840ms",
    hits: 42,
  },
  {
    query: 'JOIN work_records ON pl_number LIKE "%WAP%"',
    duration: "920ms",
    hits: 18,
  },
  {
    query: "COUNT(*) FROM audit_log GROUP BY user_id",
    duration: "640ms",
    hits: 7,
  },
];

function statusLabel(status: IntegrationStatus) {
  if (status === "warning") return "Watch";
  if (status === "critical") return "Critical";
  return "Stable";
}

function statusVariant(status: IntegrationStatus): "success" | "warning" | "danger" {
  if (status === "warning") return "warning";
  if (status === "critical") return "danger";
  return "success";
}

function formatUpdatedTime(value: Date) {
  return value.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="erp-section-heading">{eyebrow}</div>
        <h2 className="mt-1 text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

function _SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <GlassCard className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </p>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </GlassCard>
  );
}

function _MetricCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <GlassCard className="p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {label}
            </p>
            <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
          </div>
        </div>
        <Badge variant="info" size="sm">
          Live
        </Badge>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{note}</p>
    </GlassCard>
  );
}

function IntegrationCard({ integration }: { integration: IntegrationModule }) {
  const Icon = integration.icon;

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card/40 p-2.5 hover:border-primary/20 hover:bg-card/60 transition-all duration-200">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-xs",
            integration.status === "healthy"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : integration.status === "warning"
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-rose-500/10 text-rose-400 border-rose-500/20",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-foreground truncate">{integration.name}</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
            {integration.latency} · {integration.uptime}
          </p>
        </div>
      </div>
      <Badge
        variant={statusVariant(integration.status)}
        size="sm"
        className="h-5 text-[9px] px-1.5 uppercase font-semibold"
      >
        {statusLabel(integration.status)}
      </Badge>
    </div>
  );
}

function TelemetryCard({
  metricKey,
  title,
  value,
  detail,
  data,
}: {
  metricKey: string;
  title: string;
  value: string;
  detail: string;
  data: Array<{ time: string; value: number }>;
}) {
  return (
    <GlassCard className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {title}
          </p>
          <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</div>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/15">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      <div className="mt-3 h-24">
        <Suspense fallback={<div className="h-full w-full animate-pulse rounded-md bg-muted" />}>
          <TelemetryChart data={data} metricKey={metricKey} />
        </Suspense>
      </div>
    </GlassCard>
  );
}

export default function SystemHealth() {
  const [cpuData, setCpuData] = useState(() => generateMetricHistory(34, 20));
  const [memData, setMemData] = useState(() => generateMetricHistory(58, 10));
  const [diskData, setDiskData] = useState(() => generateMetricHistory(61, 3));
  const [refreshTime, setRefreshTime] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [backups, setBackups] = useState<BackupRecord[]>([]);

  useEffect(() => {
    SystemHealthService.getBackups().then(setBackups);
  }, []);

  const refresh = () => {
    setIsRefreshing(true);
    window.setTimeout(() => {
      setCpuData(generateMetricHistory(34, 20));
      setMemData(generateMetricHistory(58, 10));
      setDiskData(generateMetricHistory(61, 3));
      setRefreshTime(new Date());
      setIsRefreshing(false);
    }, 700);
  };

  const triggerBackup = async () => {
    setBackups(await SystemHealthService.queueManualBackup());
    toast.success("Backup queued", {
      description: "A manual backup request has been added to the operations queue.",
    });
  };

  const currentCPU = Math.round(cpuData[cpuData.length - 1].value);
  const currentMem = Math.round(memData[memData.length - 1].value);
  const currentDisk = Math.round(diskData[diskData.length - 1].value);
  const healthyCount = INTEGRATIONS.filter(
    (integration) => integration.status === "healthy",
  ).length;
  const queuedBackups = backups.filter((backup) => backup.status === "pending");

  return (
    <PageContainer maxWidth="xl" className="space-y-4 pb-6">
      <PageHeader
        title="System Health"
        subtitle={`Status updated at ${formatUpdatedTime(refreshTime)} · Backup queue: ${queuedBackups.length} pending jobs`}
      >
        <Button variant="secondary" onClick={refresh} size="sm" className="h-8">
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button onClick={triggerBackup} size="sm" className="h-8">
          <Download className="h-3.5 w-3.5" />
          Trigger Backup
        </Button>
      </PageHeader>

      {/* Main Grid for Integrations and Live Telemetry charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Monitored service modules list */}
        <GlassCard className="lg:col-span-2 overflow-hidden flex flex-col justify-between border border-border/50 bg-card/40 backdrop-blur-md">
          <SectionHeader eyebrow="Integrations" title="Monitored service modules" />
          <div className="grid gap-2.5 p-3 sm:grid-cols-2 flex-1">
            {INTEGRATIONS.map((integration) => (
              <IntegrationCard key={integration.name} integration={integration} />
            ))}
          </div>
        </GlassCard>

        {/* Dynamic Summary Panel */}
        <GlassCard className="overflow-hidden flex flex-col border border-border/50 bg-card/40 backdrop-blur-md">
          <SectionHeader eyebrow="Overview" title="Service Diagnostics" />
          <div className="p-4 flex-1 flex flex-col justify-center gap-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs text-muted-foreground">Modules status:</span>
              <span className="text-sm font-semibold text-foreground">
                {healthyCount} / {INTEGRATIONS.length} healthy
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs text-muted-foreground">Last snapshot:</span>
              <span className="text-sm font-semibold text-foreground font-mono">
                {formatUpdatedTime(refreshTime)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Backup queue:</span>
              <span className="text-sm font-semibold text-foreground font-mono">
                {queuedBackups.length} pending
              </span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Telemetry charts row */}
      <GlassCard className="overflow-hidden border border-border/50 bg-card/40 backdrop-blur-md">
        <SectionHeader eyebrow="Telemetry" title="Live resource utilization" />
        <div className="grid gap-3 p-3 sm:grid-cols-3">
          <TelemetryCard
            metricKey="cpu"
            title="CPU usage"
            value={`${currentCPU}%`}
            detail="Compute pressure."
            data={cpuData}
          />
          <TelemetryCard
            metricKey="memory"
            title="Memory usage"
            value={`${currentMem}%`}
            detail="Application profile."
            data={memData}
          />
          <TelemetryCard
            metricKey="disk"
            title="Disk usage"
            value={`${currentDisk}%`}
            detail="Storage footprint."
            data={diskData}
          />
        </div>
      </GlassCard>

      {/* Recovery list and Slow Query watch list */}
      <section className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="overflow-hidden border border-border/50 bg-card/40 backdrop-blur-md">
          <SectionHeader eyebrow="Recovery" title="Backup history" />
          <div className="overflow-x-auto p-3">
            <table className="erp-table min-w-full">
              <thead>
                <tr>
                  <th>Backup</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th className="numeric">Size</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={`${backup.label}-${backup.time}`}>
                    <td className="font-medium text-foreground text-xs">{backup.label}</td>
                    <td>
                      <Badge
                        variant={backup.status === "success" ? "success" : "warning"}
                        size="sm"
                        className="text-[9px] uppercase font-semibold h-4 px-1"
                      >
                        {backup.status}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground text-xs">{backup.time}</td>
                    <td className="numeric font-medium text-foreground text-xs">{backup.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <GlassCard className="overflow-hidden border border-border/50 bg-card/40 backdrop-blur-md">
          <SectionHeader eyebrow="Query Watch" title="Slow database work" />
          <div className="space-y-2.5 p-3">
            {SLOW_QUERIES.map((query) => (
              <div
                key={query.query}
                className="rounded-lg border bg-card/30 p-2.5 hover:border-primary/10 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-foreground">{query.query}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <div className="text-xs font-semibold text-foreground font-mono">
                      {query.duration}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded">
                      {query.hits} hits
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="rounded-lg border border-amber-500/10 bg-amber-500/5 p-2.5 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-500">
                  Current focus
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-normal">
                  OCR throughput is the only module in watch state. Search and auth remain stable,
                  so remediation can stay scoped to the extraction lane.
                </p>
              </div>
            </div>
          </div>
        </GlassCard>
      </section>
    </PageContainer>
  );
}
