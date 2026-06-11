import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Briefcase,
  CheckSquare,
  ExternalLink,
  Eye,
  GitBranch,
  GitCommitHorizontal,
  MoreHorizontal,
  ServerCog,
  X,
} from "lucide-react";
import type { KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import {
  resolveDocumentPreviewPath,
  resolveNotificationPreviewDocumentId,
} from "../../lib/documentPreview";
import { getWorkflowActions, type InboxAction } from "../../lib/inboxActions";
import {
  resolveNotificationActionLabel,
  resolveNotificationPath,
} from "../../lib/notificationRouting";
import type { AppInboxItem } from "../../lib/types";
import type { DocumentChangeAlert } from "../../services/DocumentChangeAlertService";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

// Theme-aware icon color mapping using semantic colors
const TYPE_ICON_CONFIG: Record<string, { Icon: typeof Bell; color: string }> = {
  approval: { Icon: CheckSquare, color: "text-[color:var(--status-warning)]" },
  ocr: { Icon: ServerCog, color: "text-[color:var(--status-info)]" },
  case: { Icon: AlertCircle, color: "text-[color:var(--status-danger)]" },
  work: { Icon: Briefcase, color: "text-primary" },
  "design-change": { Icon: AlertTriangle, color: "text-[color:var(--status-warning)]" },
  dedup_review: { Icon: AlertTriangle, color: "text-[color:var(--status-warning)]" },
  indexing_failure: { Icon: ServerCog, color: "text-[color:var(--status-danger)]" },
  change_request: { Icon: GitBranch, color: "text-[color:var(--status-info)]" },
  change_notice: { Icon: GitCommitHorizontal, color: "text-[color:var(--status-info)]" },
};

const typeIcon = (type: string) => {
  const config = TYPE_ICON_CONFIG[type] || { Icon: Bell, color: "text-muted-foreground" };
  const { Icon, color } = config;
  return <Icon className={`w-4 h-4 ${color}`} />;
};

export function NotificationPanel({
  onClose,
  inboxItems = [],
  documentChangeAlerts = [],
  onApproveAlert,
  onBypassAlert,
  onWorkflowAction,
  actionable = false,
  busyItemId = null,
}: {
  onClose: () => void;
  inboxItems?: AppInboxItem[];
  documentChangeAlerts?: DocumentChangeAlert[];
  onApproveAlert?: (alertId: string, notes?: string) => Promise<void> | void;
  onBypassAlert?: (
    alertId: string,
    payload?: { notes?: string; bypassReason?: string },
  ) => Promise<void> | void;
  onWorkflowAction?: (notification: AppInboxItem, action: InboxAction) => Promise<void> | void;
  actionable?: boolean;
  busyItemId?: string | null;
}) {
  const navigate = useNavigate();
  const unread = inboxItems.length + documentChangeAlerts.length;

  const openDocumentAlert = (alert: DocumentChangeAlert) => {
    navigate(`/pl/${alert.plId}?tab=crossrefs&doc=${alert.documentId}`);
    onClose();
  };

  const openNotification = (notification: AppInboxItem) => {
    navigate(resolveNotificationPath(notification));
    onClose();
  };

  const openPreview = (documentId: string) => {
    navigate(resolveDocumentPreviewPath(documentId));
    onClose();
  };

  const activateRowFromKeyboard = (event: KeyboardEvent<HTMLDivElement>, action: () => void) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
    }
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-96 bg-card/95 backdrop-blur-xl border border-teal-500/20 rounded-2xl shadow-2xl shadow-teal-950/50 z-50 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Notifications</span>
          {unread > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {unread}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground/90 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {documentChangeAlerts.length > 0 && (
          <div className="border-b border-border/50">
            <div className="px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--status-warning)] bg-[color:var(--status-warning)]/8">
              Linked document change alerts
            </div>
            {documentChangeAlerts.map((alert) => (
              // biome-ignore lint/a11y/useSemanticElements: outer container needs click handler, but nested buttons make semantic button tag invalid HTML
              <div
                role="button"
                tabIndex={0}
                key={alert.id}
                className="w-full px-5 py-4 border-b border-border/40 hover:bg-amber-500/6 transition-colors text-left"
                onClick={() => openDocumentAlert(alert)}
                onKeyDown={(event) =>
                  activateRowFromKeyboard(event, () => openDocumentAlert(alert))
                }
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">{typeIcon("design-change")}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-foreground">
                        PL {alert.plNumber} change review
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed">
                      {alert.documentName}
                    </p>
                    <p className="text-[11px] text-[color:var(--status-warning)] mt-1">{alert.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {alert.designSupervisor
                        ? `Design Supervisor: ${alert.designSupervisor}`
                        : "Supervisor review pending"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openPreview(alert.documentId);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold text-sky-200 hover:border-sky-400/40 hover:bg-sky-500/14 transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openDocumentAlert(alert);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-teal-500/25 bg-teal-500/10 px-2.5 py-1 text-[10px] font-semibold text-teal-200 hover:border-teal-400/40 hover:bg-teal-500/14 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open PL
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Review actions for PL ${alert.plNumber}`}
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-200 hover:border-amber-400/40 hover:bg-amber-500/14 transition-colors"
                      >
                        <MoreHorizontal className="w-3 h-3" />
                        Review
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-48 border border-border bg-popover text-popover-foreground"
                    >
                      <DropdownMenuItem
                        className="focus:bg-secondary"
                        onSelect={() =>
                          void onApproveAlert?.(alert.id, "Approved from header notification")
                        }
                      >
                        Approve update
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="focus:bg-secondary text-rose-200 focus:text-rose-100"
                        onSelect={() =>
                          void onBypassAlert?.(alert.id, {
                            bypassReason: "Bypassed from header notification",
                          })
                        }
                      >
                        Bypass update
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}

        {inboxItems.map((n) => {
          const actions = actionable ? getWorkflowActions(n) : [];
          const previewDocumentId = resolveNotificationPreviewDocumentId(n);
          return (
            // biome-ignore lint/a11y/useSemanticElements: outer container needs click handler, but nested buttons make semantic button tag invalid HTML
            <div
              role="button"
              tabIndex={0}
              key={n.id}
              onClick={() => openNotification(n)}
              onKeyDown={(event) => activateRowFromKeyboard(event, () => openNotification(n))}
              className="w-full flex items-start gap-3 px-5 py-4 border-b border-border/50 hover:bg-secondary/30 transition-colors text-left"
            >
              <div className="mt-0.5 shrink-0">{typeIcon(n.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-foreground">{n.title}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {n.subtitle || "Actionable workflow item waiting in the queue."}
                </p>
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  {n.created_at || "Now"}
                </span>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {previewDocumentId && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openPreview(previewDocumentId);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold text-sky-200 transition-colors hover:border-sky-400/40 hover:bg-sky-500/14"
                    >
                      <Eye className="w-3 h-3" />
                      Preview
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openNotification(n);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-teal-500/20 bg-teal-500/8 px-2.5 py-1 text-[10px] font-semibold text-teal-200 transition-colors hover:border-teal-400/40 hover:bg-teal-500/14"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {resolveNotificationActionLabel(n)}
                  </button>
                  {actions.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Workflow actions for ${n.title}`}
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-lg border border-teal-500/20 bg-teal-500/8 px-2.5 py-1 text-[10px] font-semibold text-teal-200 transition-colors hover:border-teal-400/40 hover:bg-teal-500/14"
                        >
                          <MoreHorizontal className="w-3 h-3" />
                          Actions
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-48 border border-border bg-popover text-popover-foreground"
                      >
                        {actions.map((action) => (
                          <DropdownMenuItem
                            key={action.key}
                            disabled={busyItemId === `${n.id}:${action.key}`}
                            className={`focus:bg-secondary ${action.variant === "danger" ? "text-rose-200 focus:text-rose-100" : ""}`}
                            onSelect={() => void onWorkflowAction?.(n, action)}
                          >
                            {busyItemId === `${n.id}:${action.key}` ? "Working..." : action.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              <div className="shrink-0 self-center text-muted-foreground">
                <ExternalLink className="w-3.5 h-3.5" />
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-5 py-3 border-t border-border">
        <button
          type="button"
          onClick={() => {
            navigate("/notifications");
            onClose();
          }}
          className="text-xs text-primary hover:text-primary/90 transition-colors flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3" /> View all notifications
        </button>
      </div>
    </div>
  );
}
