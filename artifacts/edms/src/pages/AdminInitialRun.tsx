import {
  Activity,
  ArrowRight,
  ChevronRight,
  CopyCheck,
  Database,
  FileSearch,
  Layers3,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { AxiosError } from "axios";
import { Badge, Button, GlassCard, Input, PageHeader } from "../components/ui/Shared";
import { useToast } from "../contexts/ToastContext";
import type { InitialRunActionResult, InitialRunSummary } from "../lib/types";
import apiClient, { ApiClient } from "../services/ApiClient";

type InitialRunAction =
  | "index_sources"
  | "backfill_hashes"
  | "refresh_deduplication"
  | "queue_pending_ocr";

const ACTION_ORDER: Array<{
  action: InitialRunAction;
  title: string;
  shortDesc: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "primary" | "secondary";
}> = [
  {
    action: "index_sources",
    title: "Index Sources",
    shortDesc: "Scan file sources and index new file records.",
    icon: Layers3,
  },
  {
    action: "backfill_hashes",
    title: "Calculate Hashes",
    shortDesc: "Generate content-based sparse & SHA-256 hashes.",
    icon: Database,
    variant: "secondary",
  },
  {
    action: "refresh_deduplication",
    title: "Refresh Dedup",
    shortDesc: "Re-group duplicates based on new file hash signatures.",
    icon: CopyCheck,
    variant: "secondary",
  },
  {
    action: "queue_pending_ocr",
    title: "Queue OCR",
    shortDesc: "Process backlog queue for text extraction.",
    icon: FileSearch,
    variant: "secondary",
  },
];

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusVariant(status: string) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "RUNNING") return "processing" as const;
  if (status === "FAILED") return "danger" as const;
  return "warning" as const;
}

export default function AdminInitialRun() {
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();
  const [summary, setSummary] = useState<InitialRunSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [runningAction, setRunningAction] = useState<InitialRunAction | null>(null);
  const [skipIndexed, setSkipIndexed] = useState(true);
  const [forceFullHash, setForceFullHash] = useState(false);
  const [batchSize, setBatchSize] = useState("");
  const [activeTab, setActiveTab] = useState<"sources" | "crawls" | "hashes">("sources");

  const fetchSummary = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const payload = await apiClient.getInitialRunSummary();
      setSummary(payload);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load initial-run summary.";
      showError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showError]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  const resolvedBatchSize = useMemo(() => {
    const parsed = Number(batchSize);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }, [batchSize]);

  const actionMetrics = useMemo(() => {
    if (!summary) return null;
    return {
      index_sources: {
        primary: `${summary.sources.active_sources} active roots`,
        secondary: `${summary.sources.tracked_files} tracked files`,
      },
      backfill_hashes: {
        primary: `${summary.documents.missing_sparse_hash} sparse gaps`,
        secondary: `${summary.documents.missing_full_hash} full gaps`,
      },
      refresh_deduplication: {
        primary: `${summary.documents.pending_dedup} docs pending`,
        secondary: `${summary.documents.duplicate_groups} groups found`,
      },
      queue_pending_ocr: {
        primary: `${summary.documents.pending_ocr} pending OCR`,
        secondary: `${summary.documents.processing_ocr} processing`,
      },
    };
  }, [summary]);

  const runAction = async (action: InitialRunAction) => {
    setRunningAction(action);
    try {
      const result: InitialRunActionResult = await apiClient.triggerInitialRunAction({
        action,
        batch_size: resolvedBatchSize,
        skip_indexed: skipIndexed,
        force_full_hash: forceFullHash,
      });
      showSuccess(result.message);
      await fetchSummary();
    } catch (error) {
      const message =
        error && typeof error === "object" && "isAxiosError" in error
          ? ApiClient.getErrorMessage(error as AxiosError)
          : error instanceof Error
            ? error.message
            : "Unable to launch the selected initial-run action.";
      showError(message);
    } finally {
      setRunningAction(null);
    }
  };

  if (isLoading && !summary) {
    return (
      <div className="mx-auto max-w-[1380px] space-y-6">
        <PageHeader
          title="Initial Production Run"
          subtitle="Loading source inventory and backlog state."
        />
      </div>
    );
  }

  const documents = summary?.documents;
  const sources = summary?.sources;

  return (
    <div className="mx-auto max-w-[1380px] space-y-5">
      {/* Header */}
      <PageHeader
        title="Initial Production Run"
        subtitle="Bootstrap file indexing, hash calculations, deduplication, and OCR tasks."
        breadcrumb={<span>Admin / Operations / Bootstrap</span>}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void fetchSummary()}>
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate("/admin/deduplication")}>
            Dedup Console
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate("/ocr")}>
            OCR Monitor
          </Button>
        </div>
      </PageHeader>

      {/* Top Section: Operator Guide & Stats Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Compact Runbook Checklist */}
        <GlassCard className="lg:col-span-2 p-4 flex flex-col justify-between border-border/50 bg-card/40 backdrop-blur-md">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary shrink-0" />
              <h2 className="text-sm font-semibold text-white">Bootstrap Runbook Sequence</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl mb-4">
              Recommended sequence for bootstrap crawl: first index sources, backfill content
              hashes, settle duplicate groups, then queue OCR backlog. Each step is safe to re-run.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2 border border-border/30 rounded-xl p-2.5 bg-secondary/15">
            {[
              { num: "01", step: "Index" },
              { num: "02", step: "Hash" },
              { num: "03", step: "Dedup" },
              { num: "04", step: "OCR" },
            ].map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-primary/70">{step.num}</span>
                  <span className="text-xs font-semibold text-foreground">{step.step}</span>
                </div>
                {idx < 3 && (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-700 ml-auto shrink-0" />
                )}
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Stats Summary Panel */}
        <div className="grid grid-cols-2 gap-3">
          <GlassCard className="p-3 border-border/50 bg-card/40 backdrop-blur-md hover:-translate-y-0.5 hover:border-primary/30 transition-all duration-200">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block">
              Footprint
            </span>
            <span className="mt-1 text-xl font-bold text-white block">
              {sources?.active_sources ?? 0}
            </span>
            <span className="text-[10px] text-muted-foreground">Active Sources</span>
          </GlassCard>
          <GlassCard className="p-3 border-border/50 bg-card/40 backdrop-blur-md hover:-translate-y-0.5 hover:border-primary/30 transition-all duration-200">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block">
              OCR Gaps
            </span>
            <span className="mt-1 text-xl font-bold text-white block">
              {documents?.pending_ocr ?? 0}
            </span>
            <span className="text-[10px] text-muted-foreground">Pending Docs</span>
          </GlassCard>
          <GlassCard className="p-3 border-border/50 bg-card/40 backdrop-blur-md hover:-translate-y-0.5 hover:border-primary/30 transition-all duration-200">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block">
              Hash Gaps
            </span>
            <span className="mt-1 text-xl font-bold text-white block">
              {documents?.missing_sparse_hash ?? 0}
            </span>
            <span className="text-[10px] text-muted-foreground">Missing Hashes</span>
          </GlassCard>
          <GlassCard className="p-3 border-border/50 bg-card/40 backdrop-blur-md hover:-translate-y-0.5 hover:border-primary/30 transition-all duration-200">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block">
              Deduplication
            </span>
            <span className="mt-1 text-xl font-bold text-white block">
              {documents?.duplicate_groups ?? 0}
            </span>
            <span className="text-[10px] text-muted-foreground">Duplicate Groups</span>
          </GlassCard>
        </div>
      </div>

      {/* Execution Toggles & Control Bar */}
      <GlassCard className="p-3 border-border/50 bg-card/40 backdrop-blur-md flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-2 shrink-0">
          <Activity className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">Crawl Options</h3>
        </div>

        <div className="flex flex-wrap items-center gap-4 flex-1 justify-end">
          {/* Skip Toggle */}
          <button
            type="button"
            onClick={() => setSkipIndexed((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/40 hover:bg-secondary/40 text-xs text-foreground/90 transition-all"
          >
            <div
              className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${skipIndexed ? "bg-teal-500/20 border-primary" : "border-slate-700"}`}
            >
              {skipIndexed && <div className="w-1.5 h-1.5 rounded bg-primary" />}
            </div>
            Skip Indexed Files
          </button>

          {/* Force Hash Toggle */}
          <button
            type="button"
            onClick={() => setForceFullHash((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/40 hover:bg-secondary/40 text-xs text-foreground/90 transition-all"
          >
            <div
              className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${forceFullHash ? "bg-teal-500/20 border-primary" : "border-slate-700"}`}
            >
              {forceFullHash && <div className="w-1.5 h-1.5 rounded bg-primary" />}
            </div>
            Force SHA-256
          </button>

          {/* Batch Size Input */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Cap Limit:</span>
            <Input
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="No Limit"
              className="w-24 h-8 text-xs font-mono text-center"
            />
          </div>
        </div>
      </GlassCard>

      {/* 4 Action Steps Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {ACTION_ORDER.map((item) => {
          const Icon = item.icon;
          const metrics = actionMetrics?.[item.action];
          const isBusy = runningAction === item.action;
          return (
            <GlassCard
              key={item.action}
              className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md flex flex-col justify-between hover:border-primary/20 transition-all duration-200"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center border border-teal-500/20">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white">{item.title}</h3>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        {item.shortDesc}
                      </p>
                    </div>
                  </div>
                  <Badge variant={isBusy ? "processing" : "default"} className="text-[9px] px-1.5">
                    {isBusy ? "Running" : "Idle"}
                  </Badge>
                </div>

                {/* Info row */}
                <div className="grid grid-cols-2 gap-2 my-3">
                  <div className="bg-secondary/15 rounded-lg p-2 border border-border/30">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground block">
                      Backlog Scope
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      {metrics?.primary ?? "—"}
                    </span>
                  </div>
                  <div className="bg-secondary/15 rounded-lg p-2 border border-border/30">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground block">
                      Discovered state
                    </span>
                    <span className="text-xs text-foreground truncate block">
                      {metrics?.secondary ?? "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action trigger */}
              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <Button
                  variant={item.variant ?? "primary"}
                  size="sm"
                  onClick={() => void runAction(item.action)}
                  disabled={!!runningAction}
                  className="h-8 text-[11px]"
                >
                  {isBusy ? (
                    <RefreshCw className="h-3 w-3 animate-spin mr-1.5" />
                  ) : (
                    <ArrowRight className="h-3 w-3 mr-1.5" />
                  )}
                  {isBusy ? "Launching..." : "Execute Step"}
                </Button>

                {item.action === "refresh_deduplication" && (
                  <button
                    type="button"
                    className="text-[10px] text-primary hover:underline font-medium"
                    onClick={() => navigate("/admin/deduplication")}
                  >
                    Dedup console
                  </button>
                )}
                {item.action === "queue_pending_ocr" && (
                  <button
                    type="button"
                    className="text-[10px] text-primary hover:underline font-medium"
                    onClick={() => navigate("/ocr")}
                  >
                    OCR monitor
                  </button>
                )}
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Tabs Layout for Inventory & Job Logs */}
      <GlassCard className="p-3 border-border/50 bg-card/40 backdrop-blur-md">
        {/* Tabs selector */}
        <div className="flex border-b border-border/40 mb-3 pb-1 gap-2">
          {[
            { id: "sources", label: "Active Sources" },
            { id: "crawls", label: "Crawl Logs" },
            { id: "hashes", label: "Hash Logs" },
          ].map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "sources" | "crawls" | "hashes")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? "bg-teal-500/15 border border-teal-500/25 text-primary"
                  : "text-muted-foreground hover:text-foreground/90 hover:bg-secondary/40"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Active Source Inventory */}
        {activeTab === "sources" && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-border/40 text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary/10">
                <tr>
                  <th className="px-3 py-2">Source / System</th>
                  <th className="px-3 py-2">Path</th>
                  <th className="px-3 py-2">Files Tracked</th>
                  <th className="px-3 py-2">Indexed</th>
                  <th className="px-3 py-2">Issues (Missing / Failed)</th>
                  <th className="px-3 py-2">Last Crawl</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 text-[11px] text-foreground/90">
                {(!summary?.active_source_details ||
                  summary.active_source_details.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      No active indexed sources.
                    </td>
                  </tr>
                )}
                {summary?.active_source_details?.map((source) => (
                  <tr key={source.id} className="hover:bg-secondary/10">
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-white">{source.name}</p>
                      <p className="text-[10px] text-muted-foreground">{source.source_system}</p>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground">
                      {source.root_path}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-white">
                      {source.tracked_files}{" "}
                      <span className="text-muted-foreground font-normal">
                        ({source.active_files} active)
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground">
                      {source.indexed_documents}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <Badge
                          variant={source.missing_files > 0 ? "warning" : "success"}
                          className="text-[9px] px-1 py-0 scale-90"
                        >
                          M: {source.missing_files}
                        </Badge>
                        <Badge
                          variant={source.failed_files > 0 ? "danger" : "success"}
                          className="text-[9px] px-1 py-0 scale-90"
                        >
                          F: {source.failed_files}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-[10px]">
                      {formatDateTime(source.last_crawled_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Crawl Jobs */}
        {activeTab === "crawls" && (
          <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
            {(!summary?.latest_jobs?.crawl || summary.latest_jobs.crawl.length === 0) && (
              <p className="text-xs text-muted-foreground p-3">No recent crawl jobs.</p>
            )}
            {summary?.latest_jobs?.crawl?.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/10 border border-border/30 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-white">
                    {job.source_name || "All active roots"}
                  </p>
                  <p className="font-mono text-[9px] text-muted-foreground mt-0.5">{job.id}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={statusVariant(job.status)} className="text-[9px]">
                    {job.status}
                  </Badge>
                  <div className="text-right text-[10px] text-muted-foreground leading-tight">
                    <div>Started: {formatDateTime(job.started_at || job.created_at)}</div>
                    {"indexed_count" in job && (
                      <div className="text-primary mt-0.5">
                        Indexed: {job.indexed_count} / discovered: {job.discovered_count}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Hash Backfill Jobs */}
        {activeTab === "hashes" && (
          <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
            {(!summary?.latest_jobs?.hash_backfill ||
              summary.latest_jobs.hash_backfill.length === 0) && (
              <p className="text-xs text-muted-foreground p-3">No recent hash backfill jobs.</p>
            )}
            {summary?.latest_jobs?.hash_backfill?.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/10 border border-border/30 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-white">
                    {job.source_name || "Database Inventory"}
                  </p>
                  <p className="font-mono text-[9px] text-muted-foreground mt-0.5">{job.id}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={statusVariant(job.status)} className="text-[9px]">
                    {job.status}
                  </Badge>
                  <div className="text-right text-[10px] text-muted-foreground leading-tight">
                    <div>Started: {formatDateTime(job.started_at || job.created_at)}</div>
                    {"documents_indexed" in job && (
                      <div className="text-primary mt-0.5">
                        Indexed: {job.documents_indexed} / scanned: {job.documents_scanned}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
