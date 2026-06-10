import {
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  ServerCog,
  SkipForward,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { Badge, Button, GlassCard } from "../components/ui/Shared";
import { MOCK_OCR_JOBS } from "../lib/mockExtended";
import apiClient from "../services/ApiClient";
import { type OcrJobRecord, OcrJobService } from "../services/OcrJobService";

const statusIcon = (s: string) => {
  if (s === "Completed") return <CheckCircle className="w-4 h-4 text-primary" />;
  if (s === "Processing") return <Clock className="w-4 h-4 text-blue-400 animate-pulse" />;
  if (s === "Failed") return <XCircle className="w-4 h-4 text-rose-500" />;
  return <SkipForward className="w-4 h-4 text-muted-foreground" />;
};
const statusVariant = (s: string) => {
  if (s === "Completed") return "success" as const;
  if (s === "Processing") return "processing" as const;
  if (s === "Failed") return "danger" as const;
  return "default" as const;
};

export default function OCRMonitor() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<string>("All");
  const [selectedJob, setSelectedJob] = useState<OcrJobRecord | null>(null);
  const [jobs, setJobs] = useState<OcrJobRecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

  const mapJob = useCallback(
    (job: any): OcrJobRecord => ({
      id: String(job.id),
      document: String(job.document_id || job.document || ""),
      filename: String(job.document_name || job.filename || job.document_id || "Unknown document"),
      status: String(job.status || "Queued"),
      confidence:
        typeof job.confidence === "number"
          ? Math.round(job.confidence * (job.confidence <= 1 ? 100 : 1))
          : null,
      pages: Number(job.page_count || 0),
      startTime: job.started_at || null,
      endTime: job.completed_at || null,
      extractedRefs: Number(job.entity_count || 0),
      failureReason: job.error_message || undefined,
    }),
    [],
  );

  const fetchJobs = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await apiClient.getOcrJobs({
        page: 1,
        pageSize: 100,
        filters: filter === "All" ? {} : { status: filter },
      });
      setJobs(response.items.map(mapJob));
    } catch (error) {
      console.warn("Falling back to mock OCR jobs", error);
      const fallbackSource = await OcrJobService.getAll();
      const fallback =
        fallbackSource.length > 0
          ? fallbackSource
          : filter === "All"
            ? [...MOCK_OCR_JOBS]
            : MOCK_OCR_JOBS.filter((job) => job.status === filter);
      setJobs(fallback);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, [filter, mapJob]);

  const filtered = filter === "All" ? jobs : jobs.filter((j) => j.status === filter);
  const completed = jobs.filter((j) => j.status === "Completed").length;
  const failed = jobs.filter((j) => j.status === "Failed").length;
  const processing = jobs.filter((j) => j.status === "Processing").length;

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const requestedJobId = searchParams.get("id");
    const requestedDocumentId = searchParams.get("document");
    const match =
      jobs.find((job) => job.id === requestedJobId) ??
      jobs.find((job) => job.document === requestedDocumentId) ??
      null;
    setSelectedJob(match);
  }, [jobs, searchParams]);

  const updateSelectedJob = (job: OcrJobRecord | null) => {
    setSelectedJob(job);
    const next = new URLSearchParams(searchParams);
    if (job) {
      next.set("id", job.id);
      next.set("document", job.document);
    } else {
      next.delete("id");
      next.delete("document");
    }
    setSearchParams(next, { replace: true });
  };

  const handleRetry = (id: string) => {
    if (retryingJobId) return;
    const target = jobs.find((job) => job.id === id);
    if (!target) {
      return;
    }
    setRetryingJobId(id);
    void apiClient
      .startOcrJob(target.document)
      .then(async () => {
        toast.success("OCR job restarted", {
          description: `Document ${target.document} was re-queued.`,
        });
        updateSelectedJob(null);
        await fetchJobs();
      })
      .catch((error: any) => {
        const message = error?.response?.data?.detail;
        if (message) {
          toast.error(message);
          return;
        }

        void OcrJobService.queueRetry(target.document)
          .then(async (fallbackJob) => {
            toast.success("OCR job re-queued locally", {
              description: `Document ${target.document} is now processing as ${fallbackJob.id}.`,
            });
            updateSelectedJob(fallbackJob);
            await fetchJobs();
          })
          .catch(() => {
            toast.error("Unable to restart OCR job.");
          });
      })
      .finally(() => setRetryingJobId(null));
  };

  const handleRefresh = async () => {
    await fetchJobs();
    toast.success("OCR jobs refreshed", {
      description: "Current pipeline state has been reloaded.",
    });
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">OCR Monitor</h1>
        <p className="text-muted-foreground text-sm">
          Pipeline monitoring, job tracking, and extraction oversight.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "Completed",
            value: completed,
            color: "text-primary bg-teal-500/10",
          },
          {
            label: "Processing",
            value: processing,
            color: "text-blue-400 bg-blue-500/10",
          },
          {
            label: "Failed",
            value: failed,
            color: "text-rose-400 bg-rose-500/10",
          },
          {
            label: "Total Jobs",
            value: jobs.length,
            color: "text-foreground/90 bg-slate-700/30",
          },
        ].map((s) => (
          <GlassCard
            key={s.label}
            className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md flex items-center gap-3 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 transition-all duration-200"
          >
            <div className={`w-10 h-10 rounded-full ${s.color} flex items-center justify-center`}>
              <ServerCog className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className={`grid gap-6 ${selectedJob ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        <GlassCard className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex gap-2">
              {["All", "Completed", "Processing", "Failed", "Skipped"].map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-3 h-9 rounded-md text-xs font-medium border transition-colors ${
                    filter === s
                      ? "bg-teal-500/20 border-teal-500/40 text-primary/90"
                      : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              className="ml-auto h-9"
              onClick={() => void handleRefresh()}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-3 pl-4 font-semibold">Job ID</th>
                  <th className="pb-3 font-semibold">Document</th>
                  <th className="pb-3 font-semibold">Filename</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Confidence</th>
                  <th className="pb-3 font-semibold">Pages</th>
                  <th className="pb-3 font-semibold">Start Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      No OCR jobs match the current filter.
                    </td>
                  </tr>
                )}
                {filtered.map((job) => (
                  <tr
                    key={job.id}
                    className={`hover:bg-secondary/30 cursor-pointer transition-colors group ${selectedJob?.id === job.id ? "bg-secondary/30" : ""}`}
                    onClick={() => updateSelectedJob(job)}
                  >
                    <td className="py-3 pl-4 font-mono text-xs text-primary">{job.id}</td>
                    <td className="py-3 font-mono text-xs text-blue-400">{job.document}</td>
                    <td className="py-3 text-foreground/90 text-xs">{job.filename}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {statusIcon(job.status)}
                        <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                      </div>
                    </td>
                    <td className="py-3">
                      {job.confidence !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${job.confidence >= 90 ? "bg-teal-500" : job.confidence >= 70 ? "bg-amber-500" : "bg-rose-500"}`}
                              style={{ width: `${job.confidence}%` }}
                            />
                          </div>
                          <span className="text-xs text-foreground/90">{job.confidence}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 text-muted-foreground text-xs">{job.pages}</td>
                    <td className="py-3 text-muted-foreground text-xs">{job.startTime ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        {selectedJob && (
          <GlassCard className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md self-start">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Job Detail</h2>
              <button
                type="button"
                onClick={() => updateSelectedJob(null)}
                className="text-muted-foreground hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 mb-4">
              {[
                { label: "Job ID", value: selectedJob.id },
                { label: "Document", value: selectedJob.document },
                { label: "Filename", value: selectedJob.filename },
                { label: "Status", value: selectedJob.status },
                { label: "Pages", value: String(selectedJob.pages) },
                { label: "Start Time", value: selectedJob.startTime ?? "—" },
                { label: "End Time", value: selectedJob.endTime ?? "—" },
                {
                  label: "References Found",
                  value: String(selectedJob.extractedRefs),
                },
              ].map((f) => (
                <div key={f.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className="text-foreground font-mono text-xs font-medium">{f.value}</span>
                </div>
              ))}
            </div>
            {"failureReason" in selectedJob && selectedJob.failureReason && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5" />
                  <p className="text-xs text-rose-300">{selectedJob.failureReason}</p>
                </div>
              </div>
            )}
            {selectedJob.status === "Failed" && (
              <Button
                onClick={() => handleRetry(selectedJob.id)}
                disabled={retryingJobId === selectedJob.id}
              >
                <RefreshCw
                  className={`w-4 h-4 ${retryingJobId === selectedJob.id ? "animate-spin" : ""}`}
                />{" "}
                {retryingJobId === selectedJob.id ? "Retrying..." : "Retry Job"}
              </Button>
            )}
          </GlassCard>
        )}
      </div>
    </div>
  );
}
