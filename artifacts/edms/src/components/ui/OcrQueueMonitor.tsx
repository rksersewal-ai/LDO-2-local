import { Activity } from "lucide-react";
import { Badge, GlassCard } from "./Shared";
import { AdminMetricsService } from "../../services/AdminMetricsService";

function healthIndicator(depth: number): { label: string; variant: "success" | "warning" | "danger"; dot: string } {
  if (depth < 5) return { label: "Healthy", variant: "success", dot: "bg-emerald-500" };
  if (depth <= 20) return { label: "Under Load", variant: "warning", dot: "bg-amber-500" };
  return { label: "Backlogged", variant: "danger", dot: "bg-rose-500" };
}

export function OcrQueueMonitor() {
  const metrics = AdminMetricsService.getMetrics();
  const health = healthIndicator(metrics.ocrQueueDepth);
  const estimatedMinutes =
    metrics.ocrProcessingRate > 0
      ? Math.round((metrics.ocrQueueDepth / metrics.ocrProcessingRate) * 60)
      : 0;

  const processingJobs = [
    { id: "pj-1", document: "DOC-0201", page: "3/12", worker: "alpha" },
    { id: "pj-2", document: "DOC-0198", page: "7/7", worker: "beta" },
    { id: "pj-3", document: "DOC-0195", page: "22/45", worker: "gamma" },
    { id: "pj-4", document: "DOC-0210", page: "1/3", worker: "delta" },
    { id: "pj-5", document: "DOC-0212", page: "5/8", worker: "alpha" },
  ];

  return (
    <GlassCard className="overflow-hidden border border-border/50 bg-card/40 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">OCR Queue Monitor</h3>
        </div>
        <Badge variant={health.variant} size="sm" className="inline-flex items-center gap-1">
          <span className={`h-1.5 w-1.5 rounded-full ${health.dot} animate-pulse`} />
          {health.label}
        </Badge>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Queue Depth
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {metrics.ocrQueueDepth}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Rate (jobs/hr)
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {metrics.ocrProcessingRate}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Est. Clear Time
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {estimatedMinutes}m
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
            Currently Processing (Top 5)
          </p>
          <div className="space-y-1.5">
            {processingJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between rounded-lg border bg-card/30 px-3 py-1.5 text-xs"
              >
                <span className="font-mono text-foreground">{job.document}</span>
                <span className="text-muted-foreground">
                  Page {job.page} - Worker {job.worker}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
