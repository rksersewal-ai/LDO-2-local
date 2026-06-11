import { ArrowRight, CheckCircle, CheckSquare, Clock, FileText, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  DocumentPreviewButton,
  getDocumentContextAttributes,
} from "../components/documents/DocumentPreviewActions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Badge, Button, GlassCard } from "../components/ui/Shared";
import { useAuth } from "../lib/auth";
import { MOCK_DOCUMENTS } from "../lib/mock";
import { type ApprovalRecord, ApprovalService } from "../services/ApprovalService";

const statusVariant = (status: string) => {
  if (status === "Approved") return "success" as const;
  if (status === "Pending") return "warning" as const;
  if (status === "Rejected") return "danger" as const;
  return "default" as const;
};

function formatReviewedAt(value?: string) {
  if (!value) return null;
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

export default function Approvals() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<string>("Pending");
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRecord | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    action: "Approved" | "Rejected";
  } | null>(null);
  const [actionInFlight, setActionInFlight] = useState(false);

  const filtered =
    filter === "All" ? approvals : approvals.filter((approval) => approval.status === filter);
  const pendingCount = approvals.filter((approval) => approval.status === "Pending").length;

  const loadApprovals = useCallback(async () => {
    const next = await ApprovalService.getAll();
    setApprovals(next);
    setHydrated(true);
    return next;
  }, []);

  const focusApproval = (approval: ApprovalRecord | null) => {
    setSelectedApproval(approval);
    const next = new URLSearchParams(searchParams);
    if (approval) {
      next.set("id", approval.id);
      if (approval.status !== "Pending" && filter === "Pending") {
        setFilter("All");
      }
    } else {
      next.delete("id");
    }
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    void loadApprovals();
  }, [loadApprovals]);

  useEffect(() => {
    const docsParam = searchParams.get("docs");
    if (!docsParam) {
      return;
    }

    const requestedDocumentIds = Array.from(
      new Set(
        docsParam
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );

    if (requestedDocumentIds.length === 0) {
      const next = new URLSearchParams(searchParams);
      next.delete("docs");
      setSearchParams(next, { replace: true });
      return;
    }

    const matchedDocuments = MOCK_DOCUMENTS.filter((document) =>
      requestedDocumentIds.includes(document.id),
    );

    if (matchedDocuments.length === 0) {
      const next = new URLSearchParams(searchParams);
      next.delete("docs");
      setSearchParams(next, { replace: true });
      return;
    }

    let cancelled = false;

    const syncQueuedApprovals = async () => {
      const additions = await ApprovalService.queueDocumentApprovals(matchedDocuments);
      const nextApprovals = await loadApprovals();
      if (cancelled) {
        return;
      }

      if (additions.length > 0) {
        toast.success(
          `${additions.length} document approval${additions.length > 1 ? "s" : ""} queued`,
        );
      }

      const focusTarget =
        additions[0]?.id ??
        nextApprovals.find((approval) => requestedDocumentIds.includes(approval.linkedDoc))?.id;

      const next = new URLSearchParams(searchParams);
      next.delete("docs");
      if (focusTarget) {
        next.set("id", focusTarget);
      }
      setFilter("Pending");
      setSearchParams(next, { replace: true });
    };

    void syncQueuedApprovals();

    return () => {
      cancelled = true;
    };
  }, [loadApprovals, searchParams, setSearchParams]);

  useEffect(() => {
    const requestedId = searchParams.get("id");
    if (!requestedId) {
      return;
    }

    const match = approvals.find((approval) => approval.id === requestedId) ?? null;
    if (match) {
      setSelectedApproval(match);
      if (match.status !== "Pending") {
        setFilter("All");
      }
    }
  }, [approvals, searchParams]);

  const handleAction = (id: string, action: "Approved" | "Rejected") => {
    setConfirmAction({ id, action });
  };

  const executeAction = async () => {
    if (!confirmAction || actionInFlight) return;

    setActionInFlight(true);
    try {
      const updated = await ApprovalService.updateStatus(
        confirmAction.id,
        confirmAction.action,
        user?.name,
      );
      if (!updated) {
        throw new Error("Approval was not found");
      }

      await loadApprovals();
      focusApproval(null);
      toast.success(`Approval ${confirmAction.action.toLowerCase()}`);
    } catch (error) {
      console.error("[Approvals] Action failed", error);
      toast.error("Failed to process approval action");
    } finally {
      setActionInFlight(false);
      setConfirmAction(null);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">Approvals</h1>
        <p className="text-muted-foreground text-sm">
          Review and action pending approval requests.{" "}
          {pendingCount > 0 && (
            <span className="text-amber-400 font-semibold">
              {pendingCount} items awaiting your decision.
            </span>
          )}
        </p>
      </div>

      <div className="flex gap-2">
        {["Pending", "Approved", "Rejected", "All"].map((status) => (
          <button
            type="button"
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 h-9 rounded-md text-xs transition-colors border font-medium ${
              filter === status
                ? "bg-teal-500/20 border-teal-500/40 text-primary/90"
                : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {status} {status === "Pending" && `(${pendingCount})`}
          </button>
        ))}
      </div>

      <div
        className={`grid gap-6 ${selectedApproval ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}
      >
        <div className="space-y-3">
          {hydrated && filtered.length === 0 && (
            <GlassCard className="p-12 text-center">
              <CheckCircle className="w-10 h-10 text-primary mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">No {filter.toLowerCase()} approvals</p>
            </GlassCard>
          )}
          {filtered.map((approval) => (
            <GlassCard
              key={approval.id}
              className={`p-3.5 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 backdrop-blur-md cursor-pointer transition-all duration-200 ${
                selectedApproval?.id === approval.id
                  ? "border-primary/50 bg-secondary/30"
                  : "border-border/50 bg-card/40"
              }`}
              onClick={() => focusApproval(approval)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-semibold text-foreground">{approval.title}</span>
                    <Badge variant={statusVariant(approval.status)}>{approval.status}</Badge>
                    {approval.urgency === "High" && <Badge variant="danger">High Priority</Badge>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="font-mono text-primary">{approval.id}</span>
                    <span>{approval.type}</span>
                    <span>By {approval.requester}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Due {approval.dueDate}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {approval.status === "Pending" && (
                    <>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleAction(approval.id, "Approved");
                        }}
                        className="p-1.5 rounded-lg bg-teal-500/10 text-primary hover:bg-teal-500/20 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleAction(approval.id, "Rejected");
                        }}
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <ArrowRight className="w-4 h-4 text-muted-foreground self-center" />
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        {selectedApproval && (
          <GlassCard className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md self-start">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">{selectedApproval.title}</h2>
                <span className="font-mono text-xs text-primary">{selectedApproval.id}</span>
              </div>
              <button
                type="button"
                onClick={() => focusApproval(null)}
                className="text-muted-foreground hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 mb-6">
              {[
                { label: "Type", value: selectedApproval.type },
                { label: "Requester", value: selectedApproval.requester },
                { label: "Submitted", value: selectedApproval.submitted },
                { label: "Due Date", value: selectedApproval.dueDate },
                { label: "Status", value: selectedApproval.status },
                { label: "Priority", value: selectedApproval.urgency },
                { label: "Reviewed By", value: selectedApproval.reviewedBy ?? "Not reviewed" },
                {
                  label: "Reviewed At",
                  value: formatReviewedAt(selectedApproval.reviewedAt) ?? "Not reviewed",
                },
              ].map((field) => (
                <div key={field.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{field.label}</span>
                  <span className="text-foreground font-medium">{field.value}</span>
                </div>
              ))}
            </div>
            {selectedApproval.linkedDoc && (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-2">Linked Document</p>
                <div
                  {...getDocumentContextAttributes(
                    selectedApproval.linkedDoc,
                    selectedApproval.title,
                  )}
                  className="flex items-center gap-2 p-2 rounded-lg bg-secondary/40 hover:bg-secondary/60 w-full transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/documents/${selectedApproval.linkedDoc}`)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-sm font-mono text-primary">
                      {selectedApproval.linkedDoc}
                    </span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto" />
                  </button>
                  <DocumentPreviewButton
                    documentId={selectedApproval.linkedDoc}
                    title={selectedApproval.title}
                    iconOnly
                    className="h-8 min-h-0 px-2 text-foreground/90 hover:text-teal-200"
                  />
                </div>
              </div>
            )}
            {selectedApproval.status === "Pending" && (
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  onClick={() => handleAction(selectedApproval.id, "Approved")}
                >
                  <CheckCircle className="w-4 h-4" /> Approve
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={() => handleAction(selectedApproval.id, "Rejected")}
                >
                  <XCircle className="w-4 h-4" /> Reject
                </Button>
              </div>
            )}
          </GlassCard>
        )}
      </div>

      <Dialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <DialogContent className="border border-border/60 bg-popover text-foreground sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              Confirm {confirmAction?.action === "Approved" ? "Approval" : "Rejection"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to {confirmAction?.action === "Approved" ? "approve" : "reject"}{" "}
              this item? This action will update the approval status.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="secondary"
              onClick={() => setConfirmAction(null)}
              disabled={actionInFlight}
            >
              Cancel
            </Button>
            <Button
              variant={confirmAction?.action === "Rejected" ? "danger" : undefined}
              onClick={() => void executeAction()}
              disabled={actionInFlight}
            >
              {actionInFlight
                ? "Processing..."
                : confirmAction?.action === "Approved"
                  ? "Approve"
                  : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
