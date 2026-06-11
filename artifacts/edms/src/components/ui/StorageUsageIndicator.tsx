import { HardDrive } from "lucide-react";
import { GlassCard } from "./Shared";
import { Progress } from "./progress";
import { AdminMetricsService } from "../../services/AdminMetricsService";

function usageColor(percent: number): string {
  if (percent > 85) return "[&>div]:bg-rose-500";
  if (percent > 70) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-emerald-500";
}

function usageTextColor(percent: number): string {
  if (percent > 85) return "text-rose-400";
  if (percent > 70) return "text-amber-400";
  return "text-emerald-400";
}

export function StorageUsageIndicator() {
  const metrics = AdminMetricsService.getMetrics();
  const percent = Math.round((metrics.storageUsedGB / metrics.storageTotalGB) * 100);

  const breakdown = [
    { label: "Documents", value: "89.2 GB", percent: 62 },
    { label: "OCR Outputs", value: "34.1 GB", percent: 24 },
    { label: "Backups", value: "19.4 GB", percent: 14 },
  ];

  return (
    <GlassCard className="overflow-hidden border border-border/50 bg-card/40 backdrop-blur-md">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <HardDrive className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Storage Usage</h3>
      </div>
      <div className="p-4 space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Used / Total
            </p>
            <p className="text-xl font-bold tabular-nums text-foreground mt-1">
              {metrics.storageUsedGB.toFixed(1)} GB{" "}
              <span className="text-sm text-muted-foreground font-normal">
                / {metrics.storageTotalGB} GB
              </span>
            </p>
          </div>
          <span className={`text-lg font-bold tabular-nums ${usageTextColor(percent)}`}>
            {percent}%
          </span>
        </div>

        <Progress value={percent} className={`h-2.5 ${usageColor(percent)}`} />

        <div className="space-y-2 pt-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Breakdown
          </p>
          {breakdown.map((item) => (
            <div key={item.label} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-mono text-foreground">
                {item.value}{" "}
                <span className="text-muted-foreground">({item.percent}%)</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
