import { ArrowLeft, CheckCircle2, History, RotateCcw, Save, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Badge, Button, GlassCard, PageHeader } from "../components/ui/Shared";
import { useAuth } from "../lib/auth";
import type { PLNumber } from "../lib/types";
import {
  type PLPreviewPayload,
  PLPreviewService,
  type PLRevisionEntry,
} from "../services/PLPreviewService";
import { PLService } from "../services/PLService";

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stringifyValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "—";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return String(value);
}

function payloadToSnapshot(payload: PLPreviewPayload, baseline?: PLNumber | null): PLNumber {
  const now = new Date().toISOString().split("T")[0];
  return {
    id: baseline?.id ?? payload.plNumber,
    createdAt: baseline?.createdAt ?? now,
    updatedAt: baseline?.updatedAt ?? now,
    recentActivity: baseline?.recentActivity ?? [],
    engineeringChanges: baseline?.engineeringChanges ?? [],
    ...payload,
  };
}

function previewFields(payload: PLPreviewPayload): Array<{ label: string; value: unknown }> {
  return [
    { label: "PL Number", value: payload.plNumber },
    { label: "Name", value: payload.name },
    { label: "Description", value: payload.description },
    { label: "Inspection Category", value: payload.category },
    { label: "Controlling Agency", value: payload.controllingAgency },
    { label: "Status", value: payload.status },
    { label: "Safety Critical", value: payload.safetyCritical ? "Yes" : "No" },
    { label: "Safety Classification", value: payload.safetyClassification },
    { label: "Severity of Failure", value: payload.severityOfFailure },
    { label: "Consequences", value: payload.consequences },
    { label: "Functionality", value: payload.functionality },
    { label: "Application Area", value: payload.applicationArea },
    { label: "Used In", value: payload.usedIn },
    { label: "Drawing Numbers", value: payload.drawingNumbers },
    { label: "Specification Numbers", value: payload.specNumbers },
    { label: "Mother Part", value: payload.motherPart },
    { label: "UVAM Item ID", value: payload.uvamId },
    { label: "STR Number", value: payload.strNumber },
    { label: "Eligibility Criteria", value: payload.eligibilityCriteria },
    { label: "Procurement Conditions", value: payload.procurementConditions },
    { label: "Design Supervisor", value: payload.designSupervisor },
    { label: "Concerned Supervisor", value: payload.concernedSupervisor },
    { label: "e-Office File", value: payload.eOfficeFile },
    { label: "Vendor Type", value: payload.vendorType },
    { label: "Linked Documents", value: payload.linkedDocumentIds },
  ].filter((entry) => stringifyValue(entry.value) !== "—");
}

export default function PLPreviewPage() {
  const { draftId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [activeRevisionId, setActiveRevisionId] = useState<string | null>(null);

  const draft = draftId ? PLPreviewService.getDraft(draftId) : null;

  const history = useMemo(
    () => (draft ? PLPreviewService.getRevisionHistory(draft.plNumber) : []),
    [draft],
  );

  const activeRevision = useMemo<PLRevisionEntry | null>(
    () => history.find((entry) => entry.id === activeRevisionId) ?? null,
    [activeRevisionId, history],
  );

  if (!draft) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader
          title="PL Review Preview"
          subtitle="The requested draft could not be found. It may have been discarded after save or cancel."
          actions={
            <Button onClick={() => navigate("/pl")}>
              <ArrowLeft className="w-4 h-4" />
              Back to PL Hub
            </Button>
          }
        />
        <GlassCard className="p-4 text-center hover:border-primary/20 transition-all duration-200">
          <XCircle className="mx-auto h-10 w-10 text-rose-400" />
          <p className="mt-4 text-sm text-foreground/90">No PL draft is available for review.</p>
        </GlassCard>
      </div>
    );
  }

  const effectiveSnapshot = activeRevision
    ? activeRevision.snapshot
    : payloadToSnapshot(draft.draft, draft.baseline);
  const effectivePayload = PLPreviewService.toPreviewPayload(effectiveSnapshot);
  const effectiveChangeLog = activeRevision
    ? PLPreviewService.buildChangeLog(draft.baseline, effectivePayload, draft.actor)
    : draft.changeLog;

  const isRollbackMode = Boolean(activeRevision);
  const canSave = draft.mode === "create" || effectiveChangeLog.length > 0;

  const handleCancel = () => {
    PLPreviewService.discardDraft(draft.draftId);
    navigate(draft.originPath, { replace: true });
  };

  const handleResetToCurrent = () => {
    setActiveRevisionId(null);
    toast.success("Rollback selection cleared");
  };

  const handleSave = async () => {
    if (!canSave) {
      toast.info("No changes to save");
      return;
    }

    setSaving(true);
    try {
      let saved: PLNumber;
      if (draft.mode === "create") {
        saved = await PLService.add(effectivePayload);
      } else {
        const { plNumber: _plNumber, ...updatePayload } = effectivePayload;
        const updated = await PLService.update(draft.baseline?.id ?? draft.plNumber, updatePayload);
        if (!updated) {
          throw new Error("Unable to save PL record changes");
        }
        saved = updated;
      }

      PLPreviewService.recordRevision({
        snapshot: saved,
        actor: user ?? undefined,
        action: draft.mode === "create" ? "create" : isRollbackMode ? "rollback" : "update",
        note: isRollbackMode
          ? `Rolled back from revision ${activeRevision?.id}`
          : "Saved from PL review preview",
      });
      PLPreviewService.discardDraft(draft.draftId);
      toast.success(
        draft.mode === "create"
          ? "PL record created"
          : isRollbackMode
            ? "PL record rolled back"
            : "PL record updated",
        { description: `PL-${saved.plNumber}` },
      );
      navigate(`/pl/${saved.plNumber}`, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save PL record");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title={draft.mode === "create" ? "PL Record Review Preview" : "PL Record Change Preview"}
        subtitle="Review the proposed PL metadata changes, inspect the user change log, and save or cancel from this dedicated PL preview page."
        breadcrumb={
          <button
            type="button"
            onClick={() => navigate(draft.originPath)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary/90 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to source page
          </button>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleCancel}>
              <XCircle className="w-4 h-4" />
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={handleResetToCurrent}
              disabled={!draft.baseline && !activeRevisionId}
            >
              <RotateCcw className="w-4 h-4" />
              Reset rollback
            </Button>
            <Button onClick={handleSave} disabled={saving || !canSave}>
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save PL Record"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_420px]">
        <div className="space-y-6">
          <GlassCard className="p-3.5 hover:border-primary/20 transition-all duration-200">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Preview summary
                </p>
                <h2 className="mt-1 text-xl font-bold text-white">
                  PL-{effectivePayload.plNumber} · {effectivePayload.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Prepared by{" "}
                  <span className="text-primary/90">
                    {user?.name ?? user?.username ?? "Current user"}
                  </span>{" "}
                  on {formatDateTime(draft.updatedAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={draft.mode === "create" ? "info" : "warning"}>
                  {draft.mode === "create" ? "New record" : "Edit review"}
                </Badge>
                {isRollbackMode && <Badge variant="danger">Rollback preview</Badge>}
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {previewFields(effectivePayload).map((field) => (
                <div
                  key={field.label}
                  className="rounded-2xl border border-border/70 bg-slate-950/35 px-4 py-3"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {field.label}
                  </p>
                  <p className="mt-2 text-sm text-foreground break-words">
                    {stringifyValue(field.value)}
                  </p>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-3.5 hover:border-primary/20 transition-all duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary/90" />
              <h2 className="text-sm font-bold text-white">User change log</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              This log shows the exact field-level changes the user is about to save.
            </p>
            <div className="mt-4 space-y-3">
              {effectiveChangeLog.length > 0 ? (
                effectiveChangeLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-border/70 bg-slate-950/35 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{entry.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {entry.changedBy} · {formatDateTime(entry.changedAt)}
                      </p>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-border/70 bg-card/40 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          Previous
                        </p>
                        <p className="mt-1 text-sm text-foreground/90 break-words">
                          {entry.before}
                        </p>
                      </div>
                      <div className="rounded-xl border border-teal-500/20 bg-teal-500/8 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          Proposed
                        </p>
                        <p className="mt-1 text-sm text-teal-100 break-words">{entry.after}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-border/70 bg-slate-950/35 px-4 py-5 text-sm text-muted-foreground">
                  No pending field changes detected.
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        <div className="space-y-6">
          <GlassCard className="p-3.5 hover:border-primary/20 transition-all duration-200">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-amber-300" />
              <h2 className="text-sm font-bold text-white">Rollback history</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Restore a previously saved PL snapshot, then save from this page to complete the
              rollback.
            </p>

            <div className="mt-4 space-y-3">
              {draft.baseline && (
                <button
                  type="button"
                  onClick={() => setActiveRevisionId(null)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                    !activeRevisionId
                      ? "border-teal-400/30 bg-teal-500/10"
                      : "border-border/70 bg-slate-950/35 hover:border-border/80"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Current saved version</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Last updated{" "}
                        {formatDateTime(draft.baseline.updatedAt || draft.baseline.createdAt)}
                      </p>
                    </div>
                    {!activeRevisionId && <Badge variant="success">Active</Badge>}
                  </div>
                </button>
              )}

              {history.length > 0 ? (
                history.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() =>
                      setActiveRevisionId((current) => (current === entry.id ? null : entry.id))
                    }
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                      activeRevisionId === entry.id
                        ? "border-amber-400/30 bg-amber-500/10"
                        : "border-border/70 bg-slate-950/35 hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {entry.action === "rollback"
                            ? "Rollback snapshot"
                            : entry.action === "create"
                              ? "Created record"
                              : "Saved revision"}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {entry.savedBy} · {formatDateTime(entry.savedAt)}
                        </p>
                      </div>
                      {activeRevisionId === entry.id && (
                        <Badge variant="warning">Rollback source</Badge>
                      )}
                    </div>
                    {entry.note && (
                      <p className="mt-2 text-xs text-muted-foreground">{entry.note}</p>
                    )}
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-border/70 bg-slate-950/35 px-4 py-5 text-sm text-muted-foreground">
                  No saved PL revisions are available yet.
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
