import { AlertTriangle, Users } from "lucide-react";
import { Badge, GlassCard } from "./Shared";
import { AdminMetricsService, type WorkerInfo } from "../../services/AdminMetricsService";

function statusDot(status: WorkerInfo["status"]): string {
  if (status === "healthy") return "bg-emerald-500";
  if (status === "overloaded") return "bg-amber-500";
  return "bg-rose-500";
}

function statusBadgeVariant(status: WorkerInfo["status"]): "success" | "warning" | "danger" {
  if (status === "healthy") return "success";
  if (status === "overloaded") return "warning";
  return "danger";
}

function formatHeartbeat(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.round(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}

function hasStaleWorker(workers: WorkerInfo[]): boolean {
  return workers.some((w) => {
    const diff = Date.now() - new Date(w.lastHeartbeat).getTime();
    return diff > 5 * 60 * 1000;
  });
}

export function WorkerStatusPanel() {
  const workers = AdminMetricsService.getWorkers();
  const staleAlert = hasStaleWorker(workers);

  return (
    <GlassCard className="overflow-hidden border border-border/50 bg-card/40 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Worker Status</h3>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">
          {workers.length} registered
        </span>
      </div>
      <div className="p-4 space-y-3">
        {staleAlert && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 p-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-300">
              One or more workers have not reported a heartbeat in over 5 minutes.
            </p>
          </div>
        )}
        <div className="space-y-2">
          {workers.map((worker) => (
            <div
              key={worker.id}
              className="flex items-center justify-between rounded-lg border bg-card/30 p-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`h-2 w-2 rounded-full ${statusDot(worker.status)} shrink-0`} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{worker.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {worker.currentTask ?? "Idle"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {formatHeartbeat(worker.lastHeartbeat)}
                </span>
                <Badge
                  variant={statusBadgeVariant(worker.status)}
                  size="sm"
                  className="text-[9px] uppercase font-semibold"
                >
                  {worker.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
