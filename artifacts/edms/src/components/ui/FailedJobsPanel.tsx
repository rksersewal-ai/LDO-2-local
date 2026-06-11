import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, GlassCard } from "./Shared";
import { AdminMetricsService, type FailedJob } from "../../services/AdminMetricsService";

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FailedJobsPanel() {
  const [jobs, setJobs] = useState<FailedJob[]>(() => AdminMetricsService.getFailedJobs());

  // Refresh failed jobs every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setJobs(AdminMetricsService.getFailedJobs());
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleRetry = (jobId: string) => {
    const updated = AdminMetricsService.retryJob(jobId);
    setJobs(updated);
    toast.success("Job queued for retry", {
      description: "The failed job has been re-added to the processing queue.",
    });
  };

  const handleRetryAll = () => {
    const count = jobs.length;
    const updated = AdminMetricsService.retryAllFailed();
    setJobs(updated);
    toast.success("All failed jobs queued", {
      description: `${count} job(s) re-added to the processing queue.`,
    });
  };

  return (
    <GlassCard className="overflow-hidden border border-border/50 bg-card/40 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-400" />
          <h3 className="text-sm font-semibold text-foreground">Failed Jobs</h3>
          {jobs.length > 0 && (
            <Badge variant="danger" size="sm">
              {jobs.length}
            </Badge>
          )}
        </div>
        {jobs.length > 0 && (
          <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={handleRetryAll}>
            <RotateCcw className="h-3 w-3" />
            Retry All
          </Button>
        )}
      </div>
      <div className="p-4">
        {jobs.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">No failed jobs</p>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="rounded-lg border bg-card/30 p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {job.filename}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {job.documentId} - Failed at {formatTime(job.failedAt)}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-6 text-[10px] px-2 shrink-0"
                    onClick={() => handleRetry(job.id)}
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                    Retry
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="danger" size="sm">
                    Failed
                  </Badge>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {job.errorReason}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Retry count: {job.retryCount}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
