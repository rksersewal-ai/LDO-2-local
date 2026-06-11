import { Clock, FileText, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  type RecentDocumentEntry,
  RecentDocumentsService,
} from "../../services/RecentDocumentsService";
import { GlassCard } from "./Shared";

/**
 * RecentDocumentsPanel - A collapsible panel showing recently viewed documents.
 * Each item shows doc title, type icon, and relative time.
 * Clicking navigates to /documents/:id.
 */
export function RecentDocumentsPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [items, setItems] = useState<RecentDocumentEntry[]>([]);

  useEffect(() => {
    if (isOpen) {
      setItems(RecentDocumentsService.getRecent(10));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <GlassCard className="p-3 w-72">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Recent Documents</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close recent documents"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No recent documents</p>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
          {items.map((item) => (
            <button
              type="button"
              key={`${item.documentId}-${item.viewedAt}`}
              onClick={() => {
                navigate(`/documents/${item.documentId}`);
                onClose();
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-secondary/50 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground truncate">{item.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatRelativeTime(item.viewedAt)}
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {item.documentType}
              </span>
            </button>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}
