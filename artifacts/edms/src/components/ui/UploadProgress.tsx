import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type UploadProgressItem,
  UploadProgressService,
} from "../../services/UploadProgressService";
import { GlassCard, Badge } from "./Shared";
import { Progress } from "./progress";
import { Spinner } from "./spinner";

/**
 * UploadProgress - A floating panel (fixed bottom-right) showing active uploads
 * with progress bars. Collapses when no active uploads.
 */
export function UploadProgress() {
  const [items, setItems] = useState<UploadProgressItem[]>(() =>
    UploadProgressService.getActive(),
  );

  useEffect(() => {
    const unsubscribe = UploadProgressService.subscribe(setItems);
    return unsubscribe;
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <GlassCard className="p-3 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-foreground">Uploads</span>
          <button
            type="button"
            onClick={() => UploadProgressService.clear()}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss uploads"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {items.map((item) => (
          <div key={item.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <StatusIcon status={item.status} />
              <span className="text-xs text-foreground truncate flex-1">{item.filename}</span>
              <StatusBadge status={item.status} progress={item.progress} />
            </div>
            {item.status === "uploading" && (
              <Progress value={item.progress} className="h-1.5" />
            )}
            {item.error && (
              <p className="text-[10px] text-rose-400 truncate">{item.error}</p>
            )}
          </div>
        ))}
      </GlassCard>
    </div>
  );
}

function StatusIcon({ status }: { status: UploadProgressItem["status"] }) {
  switch (status) {
    case "uploading":
    case "processing":
      return <Spinner className="size-3.5 text-primary" />;
    case "success":
      return <Check className="w-3.5 h-3.5 text-emerald-400" />;
    case "failed":
      return <X className="w-3.5 h-3.5 text-rose-400" />;
  }
}

function StatusBadge({
  status,
  progress,
}: {
  status: UploadProgressItem["status"];
  progress: number;
}) {
  switch (status) {
    case "uploading":
      return (
        <span className="text-[10px] text-muted-foreground font-mono">{progress}%</span>
      );
    case "processing":
      return <Badge variant="processing" size="sm">Processing</Badge>;
    case "success":
      return <Badge variant="success" size="sm">Done</Badge>;
    case "failed":
      return <Badge variant="danger" size="sm">Failed</Badge>;
  }
}
