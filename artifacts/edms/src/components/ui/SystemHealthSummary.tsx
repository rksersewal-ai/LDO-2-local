import { Activity, CheckCircle, HardDrive, Users } from "lucide-react";
import { Badge, GlassCard } from "./Shared";
import { Progress } from "./progress";
import { AdminMetricsService } from "../../services/AdminMetricsService";

function queueColor(depth: number): "success" | "warning" | "danger" {
  if (depth < 5) return "success";
  if (depth <= 20) return "warning";
  return "danger";
}

export function SystemHealthSummary() {
  const metrics = AdminMetricsService.getMetrics();
  const storagePercent = Math.round((metrics.storageUsedGB / metrics.storageTotalGB) * 100);

  const cards = [
    {
      icon: CheckCircle,
      label: "Services Healthy",
      value: `${metrics.workersHealthy + 3} / ${metrics.workerCount + 3}`,
      color: "text-emerald-400 bg-emerald-500/10",
    },
    {
      icon: Activity,
      label: "OCR Queue Depth",
      value: String(metrics.ocrQueueDepth),
      badge: queueColor(metrics.ocrQueueDepth),
    },
    {
      icon: HardDrive,
      label: "Storage Usage",
      value: `${storagePercent}%`,
      progress: storagePercent,
    },
    {
      icon: Users,
      label: "Active Workers",
      value: `${metrics.workersHealthy} / ${metrics.workerCount}`,
      color: "text-sky-400 bg-sky-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <GlassCard
            key={card.label}
            className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {card.label}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xl font-bold tabular-nums text-foreground">
                    {card.value}
                  </span>
                  {card.badge && (
                    <Badge variant={card.badge} size="sm">
                      {card.badge === "success"
                        ? "Low"
                        : card.badge === "warning"
                          ? "Moderate"
                          : "High"}
                    </Badge>
                  )}
                </div>
              </div>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${card.color ?? "bg-muted text-muted-foreground"}`}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>
            {card.progress !== undefined && (
              <div className="mt-2">
                <Progress
                  value={card.progress}
                  className={`h-1.5 ${
                    card.progress > 85
                      ? "[&>div]:bg-rose-500"
                      : card.progress > 70
                        ? "[&>div]:bg-amber-500"
                        : "[&>div]:bg-emerald-500"
                  }`}
                />
              </div>
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}
