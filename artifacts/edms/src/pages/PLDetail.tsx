import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Box,
  Briefcase,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Cpu,
  DatabaseBackup,
  Download,
  Edit3,
  ExternalLink,
  FileSearch,
  FileText,
  GitBranch,
  Hash,
  Info,
  Layers,
  Maximize,
  Minimize2,
  Minus,
  Package,
  Plus,
  Printer,
  Save,
  Shield,
  Square,
  User,
  Weight,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { DocumentChangeReviewCard } from "../components/documents/DocumentChangeReviewCard";
import {
  DocumentPreviewButton,
  getDocumentContextAttributes,
} from "../components/documents/DocumentPreviewActions";
import { DatePicker } from "../components/ui/DatePicker";
import { LoadingState } from "../components/ui/LoadingState";
import { PLNumberMultiSelect } from "../components/ui/PLNumberMultiSelect";
import { PLNumberSelect } from "../components/ui/PLNumberSelect";
import { Badge, Button, GlassCard, Input, Select } from "../components/ui/Shared";
import { Switch } from "../components/ui/switch";
import { useDocumentChangeAlerts } from "../hooks/useDocumentChangeAlerts";
import { usePLItem, usePLItems } from "../hooks/usePLItems";
import { type PlLinkableDocument, usePlLinkableDocuments } from "../hooks/usePlLinkableDocuments";
import { useAuth } from "../lib/auth";
import { getPLRecord } from "../lib/bomData";
import { AGENCIES, INSPECTION_CATEGORY_LABELS } from "../lib/constants";
import { resolveDocumentPreviewPath } from "../lib/documentPreview";
import { MOCK_PL_RECORDS } from "../lib/mock";
import type {
  EngineeringChange,
  InspectionCategory,
  PLNumber,
  SafetyClassification,
} from "../lib/types";
import type { DocumentChangeAlert } from "../services/DocumentChangeAlertService";
import { ExportImportService } from "../services/ExportImportService";
import { PLPreviewService } from "../services/PLPreviewService";
import { PLService } from "../services/PLService";

function NodeIcon({ type, className = "w-5 h-5" }: { type: string; className?: string }) {
  if (type === "assembly") return <Box className={`${className} text-[color:var(--status-info)]`} />;
  if (type === "sub-assembly") return <Layers className={`${className} text-[color:var(--status-info)]`} />;
  return <Cpu className={`${className} text-muted-foreground`} />;
}

function tagColor(tag: string) {
  const t = tag.toLowerCase();
  if (t.includes("safety")) return "bg-[color:var(--status-danger)]/10 text-[color:var(--status-danger)] border-[color:var(--status-danger)]/30";
  if (t.includes("high voltage")) return "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30";
  if (t.includes("electrical") || t.includes("electronics"))
    return "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30";
  if (t.includes("rotating") || t.includes("precision"))
    return "bg-[color:var(--status-processing)]/10 text-[color:var(--status-processing)] border-[color:var(--status-processing)]/30";
  return "bg-secondary text-muted-foreground border-border";
}

function statusBadgeVariant(
  status: string,
): "default" | "success" | "warning" | "danger" | "processing" {
  if (
    ["Approved", "Released", "Active", "Production", "Implemented", "ACTIVE", "RELEASED"].includes(
      status,
    )
  )
    return "success";
  if (
    [
      "In Review",
      "Preliminary",
      "In Development",
      "Prototyping",
      "Pending",
      "UNDER_REVIEW",
      "IN_REVIEW",
      "OPEN",
    ].includes(status)
  )
    return "warning";
  if (["Obsolete", "Superseded", "End of Life", "Cancelled", "OBSOLETE"].includes(status))
    return "danger";
  return "default";
}

const CATEGORY_COLORS: Record<string, string> = {
  "CAT-A": "bg-[color:var(--status-danger)]/10 text-[color:var(--status-danger)] border-[color:var(--status-danger)]/30",
  "CAT-B": "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  "CAT-C": "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
  "CAT-D": "bg-muted text-muted-foreground border-border",
};

const EC_STATUS_VARIANT: Record<string, string> = {
  OPEN: "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
  IN_REVIEW: "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  IMPLEMENTED: "bg-primary/10 text-primary/90 border-primary/30",
  RELEASED: "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
};

const EC_STATUS_DOT: Record<string, string> = {
  OPEN: "bg-[color:var(--status-info)]",
  IN_REVIEW: "bg-[color:var(--status-warning)]",
  IMPLEMENTED: "bg-primary",
  RELEASED: "bg-[color:var(--status-success)]",
};

function _Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <span className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</span>
      {children}
      {error && <p className="text-[10px] text-[color:var(--status-danger)] mt-1">{error}</p>}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
        {label}
      </span>
      <span className={`text-sm text-foreground ${mono ? "font-mono text-primary/90" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function exportPlDetails(title: string, rows: Array<[string, string | number]>) {
  ExportImportService.exportGenericTableExcel(
    title,
    ["Field", "Value"],
    rows.map(([field, value]) => [field, value]),
    title.toLowerCase().replace(/\s+/g, "-"),
  );
}

// ─── Document Linking Section (Two-Column Layout) ──────────────────────────────

interface DocumentLinkingSectionProps {
  pl: PLNumber;
  documents: PlLinkableDocument[];
  documentsLoading: boolean;
  documentAlerts?: Record<string, DocumentChangeAlert>;
  onLinkChange: (nextLinkedIds: string[]) => Promise<void> | void;
  onApproveAlert?: (alertId: string, notes?: string) => Promise<void> | void;
  onBypassAlert?: (
    alertId: string,
    payload?: { notes?: string; bypassReason?: string },
  ) => Promise<void> | void;
  focusedDocumentId?: string | null;
}

function DocumentLinkingSection({
  pl,
  documents,
  documentsLoading,
  documentAlerts = {},
  onLinkChange,
  onApproveAlert,
  onBypassAlert,
  focusedDocumentId,
}: DocumentLinkingSectionProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const linkedDocs = useMemo(
    () => documents.filter((d) => (pl.linkedDocumentIds ?? []).includes(d.id)),
    [documents, pl.linkedDocumentIds],
  );

  const availableDocs = useMemo(
    () =>
      documents
        .filter((d) => !(pl.linkedDocumentIds ?? []).includes(d.id))
        .filter(
          (d) =>
            !searchQuery ||
            d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.id.toLowerCase().includes(searchQuery.toLowerCase()),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [documents, pl.linkedDocumentIds, searchQuery],
  );

  const [linkingId, setLinkingId] = useState<string | null>(null);

  const handleLink = async (docId: string) => {
    setLinkingId(docId);
    try {
      await onLinkChange([...(pl.linkedDocumentIds ?? []), docId]);
    } finally {
      setLinkingId(null);
    }
  };

  const handleUnlink = async (docId: string) => {
    setLinkingId(docId);
    try {
      await onLinkChange((pl.linkedDocumentIds ?? []).filter((id) => id !== docId));
    } finally {
      setLinkingId(null);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Left Column: Search & Available Documents */}
      <GlassCard className="p-3.5 flex flex-col hover:border-primary/20 transition-all duration-200">
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <FileSearch className="w-4 h-4 text-primary" />
          Search & Link Documents
        </h3>

        <div className="mb-4">
          <Input
            placeholder="Search by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
          {documentsLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-xs">Loading documents...</p>
            </div>
          )}
          {availableDocs.length > 0 ? (
            availableDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/40 border border-border hover:border-teal-500/30 transition-all group"
              >
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground group-hover:text-teal-200 truncate">
                    {doc.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">{doc.id}</p>
                </div>
                <Button
                  size="sm"
                  variant="teal-outline"
                  className="text-[10px] h-6 px-2 shrink-0"
                  onClick={() => handleLink(doc.id)}
                  disabled={!!linkingId}
                >
                  {linkingId === doc.id ? (
                    <span className="w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-3 h-3" />
                  )}{" "}
                  Link
                </Button>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileSearch className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">
                {searchQuery ? "No matching documents" : "All documents linked"}
              </p>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Right Column: Linked Documents */}
      <GlassCard className="p-3.5 flex flex-col hover:border-primary/20 transition-all duration-200">
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Linked Documents
          <span className="ml-auto text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
            {linkedDocs.length}
          </span>
        </h3>

        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
          {linkedDocs.length > 0 ? (
            linkedDocs.map((doc) =>
              (() => {
                const alert = documentAlerts[doc.id];
                const isFocused = focusedDocumentId === doc.id;
                return (
                  <div
                    key={doc.id}
                    {...getDocumentContextAttributes(doc.id, doc.name)}
                    className={`p-3 rounded-lg bg-secondary/40 border transition-all ${alert ? "border-amber-500/30 hover:border-amber-400/50" : "border-teal-500/20 hover:border-teal-500/40"} ${isFocused ? "ring-2 ring-amber-400/60 shadow-[0_0_0_1px_rgba(251,191,36,0.18)]" : ""}`}
                  >
                    {alert && (
                      <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5">
                        <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-amber-200">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            Latest linked change pending supervisor review
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setExpandedAlertId((current) =>
                              current === alert.id ? null : alert.id,
                            );
                          }}
                          className="shrink-0 rounded-md border border-amber-400/30 px-2 py-0.5 text-[9px] font-semibold text-amber-100 hover:bg-amber-500/12 transition-colors"
                        >
                          {expandedAlertId === alert.id ? "Hide review" : "Review change"}
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{doc.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{doc.id}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[10px] h-6 px-2 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => navigate(resolveDocumentPreviewPath(doc.id))}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="text-[10px] h-6 px-2 shrink-0"
                        onClick={() => handleUnlink(doc.id)}
                        disabled={!!linkingId}
                      >
                        {linkingId === doc.id ? (
                          <span className="w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}{" "}
                        Unlink
                      </Button>
                    </div>
                    {alert && expandedAlertId === alert.id && (
                      <DocumentChangeReviewCard
                        alert={alert}
                        className="mt-3"
                        defaultOpen
                        onOpenPl={() => navigate(`/pl/${pl.id}?tab=crossrefs&doc=${doc.id}`)}
                        onApprove={() =>
                          onApproveAlert?.(alert.id, "Approved from PL linked documents")
                        }
                        onBypass={() =>
                          onBypassAlert?.(alert.id, {
                            bypassReason: "Bypassed from PL linked documents",
                          })
                        }
                      />
                    )}
                  </div>
                );
              })(),
            )
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No documents linked yet</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Search and link documents from the left panel
              </p>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Unified PL Form Modal (Create + Edit) ──────────────────────────────────

// ─── Shared form components (must be module-level to prevent focus loss) ──────

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <span className="block text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">
        {label}
      </span>
      {children}
      {error && <p className="text-[10px] text-[color:var(--status-danger)] mt-1">{error}</p>}
    </div>
  );
}

function FormTextInput({
  value,
  onChange,
  placeholder,
  mono,
  disabled,
  hasError,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  disabled?: boolean;
  hasError?: boolean;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full ${mono ? "font-mono text-xs" : ""} ${hasError ? "border-destructive/50" : ""}`}
      disabled={disabled}
    />
  );
}

export interface PLFormModalProps {
  mode: "create" | "edit";
  pl?: PLNumber | null;
  onClose: () => void;
  onSave: (patch: Partial<PLNumber>) => Promise<void>;
  plItems?: PLNumber[];
  plItemsLoading?: boolean;
}

export function PLFormModal({
  mode,
  pl,
  onClose,
  onSave,
  plItems: externalPlItems,
  plItemsLoading: externalLoading,
}: PLFormModalProps) {
  const { data: hookPlItems, loading: hookPlItemsLoading } = usePLItems();
  const plItems = externalPlItems ?? hookPlItems;
  const plItemsLoading = externalLoading ?? hookPlItemsLoading;

  const isEdit = mode === "edit" && pl;

  const [form, setForm] = useState({
    plNumber: isEdit ? pl.plNumber : "",
    name: isEdit ? pl.name : "",
    description: isEdit ? pl.description : "",
    category: isEdit ? pl.category : ("CAT-C" as InspectionCategory),
    controllingAgency: isEdit ? pl.controllingAgency : "CLW",
    status: isEdit ? pl.status : ("ACTIVE" as PLNumber["status"]),
    safetyCritical: isEdit ? pl.safetyCritical : false,
    safetyClassification: isEdit ? (pl.safetyClassification ?? "") : "",
    severityOfFailure: isEdit ? (pl.severityOfFailure ?? "") : "",
    consequences: isEdit ? (pl.consequences ?? "") : "",
    functionality: isEdit ? (pl.functionality ?? "") : "",
    applicationArea: isEdit ? (pl.applicationArea ?? "") : "",
    usedIn: isEdit ? (pl.usedIn ?? []).join(", ") : "",
    drawingNumbers: isEdit ? (pl.drawingNumbers ?? []).join(", ") : "",
    specNumbers: isEdit ? (pl.specNumbers ?? []).join(", ") : "",
    motherPart: isEdit ? (pl.motherPart ?? "") : "",
    uvamId: isEdit ? (pl.uvamId ?? "") : "",
    strNumber: isEdit ? (pl.strNumber ?? "") : "",
    eligibilityCriteria: isEdit ? (pl.eligibilityCriteria ?? "") : "",
    procurementConditions: isEdit ? (pl.procurementConditions ?? "") : "",
    designSupervisor: isEdit ? (pl.designSupervisor ?? "") : "",
    concernedSupervisor: isEdit ? (pl.concernedSupervisor ?? "") : "",
    eOfficeFile: isEdit ? (pl.eOfficeFile ?? "") : "",
    vendorType: isEdit ? (pl.vendorType ?? "") : "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isMaximized, setIsMaximized] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "general" | "vendor" | "safety" | "references" | "admin"
  >("general");

  const splitList = (s: string) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!isEdit && !form.plNumber.trim()) errs.plNumber = "PL Number is required";
    else if (!isEdit && !/^\d{8}$/.test(form.plNumber.trim()))
      errs.plNumber = "Must be exactly 8 digits";
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.description.trim()) errs.description = "Description is required";
    if (form.vendorType === "VD" && !form.uvamId.trim())
      errs.uvamId = "UVAM Item ID required for VD items";
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        plNumber: form.plNumber,
        name: form.name,
        description: form.description,
        category: form.category as InspectionCategory,
        controllingAgency: form.controllingAgency,
        status: form.status as PLNumber["status"],
        safetyCritical: form.safetyCritical,
        safetyClassification: (form.safetyClassification as SafetyClassification) || undefined,
        severityOfFailure: form.severityOfFailure || undefined,
        consequences: form.consequences || undefined,
        functionality: form.functionality || undefined,
        applicationArea: form.applicationArea || undefined,
        usedIn: splitList(form.usedIn),
        drawingNumbers: splitList(form.drawingNumbers),
        specNumbers: splitList(form.specNumbers),
        motherPart: form.motherPart || undefined,
        uvamId: form.uvamId || undefined,
        strNumber: form.strNumber || undefined,
        eligibilityCriteria: form.eligibilityCriteria || undefined,
        procurementConditions: form.procurementConditions || undefined,
        designSupervisor: form.designSupervisor || undefined,
        concernedSupervisor: form.concernedSupervisor || undefined,
        eOfficeFile: form.eOfficeFile || undefined,
        vendorType: (form.vendorType as "VD" | "NVD" | undefined) || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const F = FormField;

  const ta = `w-full bg-background border border-border text-foreground text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground resize-none`;

  // Keyboard shortcuts: Escape to close, Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const hasUnsavedChanges = isEdit
    ? Object.keys(form).some((k) => {
        const key = k as keyof typeof form;
        const orig =
          key === "usedIn"
            ? (pl?.usedIn ?? []).join(", ")
            : key === "drawingNumbers"
              ? (pl?.drawingNumbers ?? []).join(", ")
              : key === "specNumbers"
                ? (pl?.specNumbers ?? []).join(", ")
                : String(pl?.[key as keyof PLNumber] ?? "");
        return String(form[key]) !== orig;
      })
    : Object.values(form).some((v) => (typeof v === "string" ? v.trim() !== "" : v !== false));

  const [showDiscardWarning, setShowDiscardWarning] = useState(false);

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowDiscardWarning(true);
      return;
    }
    onClose();
  };

  const errorCount = Object.keys(errors).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed z-[100] flex items-center justify-center transition-all duration-300 ${
          isMaximized ? "inset-0 bg-background" : "inset-0 bg-background/60 backdrop-blur-sm p-4"
        } animate-in fade-in`}
      >
        <div
          className={`bg-card shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
            isMaximized
              ? "w-full h-full rounded-none"
              : isMinimized
                ? "w-96 h-auto rounded-t-2xl mt-auto mb-0"
                : "w-full max-w-7xl max-h-[92vh] rounded-2xl border border-border"
          }`}
        >
          {/* ── Title Bar (dark, desktop-app style) ─────────────────────── */}
          <div className="px-4 py-3 bg-secondary border-b border-border text-foreground flex justify-between items-center shrink-0 select-none">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="p-1.5 bg-primary rounded-lg">
                {isEdit ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </div>
              <div>
                <h3 className="text-sm font-bold">
                  {isEdit ? "Edit PL Record" : "New Engineering PL Record"}
                </h3>
                {!isMinimized && (
                  <p className="text-muted-foreground text-[10px]">
                    {isEdit
                      ? `PL-${pl.plNumber} — ${pl.name}`
                      : "Register a new 8-digit PL number in the system"}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {hasUnsavedChanges && (
                <span className="text-[10px] text-[color:var(--status-warning)] flex items-center gap-1 mr-2">
                  <AlertTriangle className="w-3 h-3" /> Unsaved
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-[10px] text-[color:var(--status-danger)] flex items-center gap-1 mr-2">
                  <AlertCircle className="w-3 h-3" /> {errorCount} error
                  {errorCount > 1 ? "s" : ""}
                </span>
              )}
              <span className="text-[9px] text-muted-foreground mr-2 hidden sm:inline">Ctrl+S · Esc</span>
              <button
                type="button"
                onClick={() => {
                  setIsMinimized(!isMinimized);
                  if (isMaximized) setIsMaximized(false);
                }}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                {isMinimized ? <Maximize className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMaximized(!isMaximized);
                  setIsMinimized(false);
                }}
                className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 hover:bg-destructive rounded-lg text-muted-foreground hover:text-destructive-foreground transition-colors ml-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── Form body (three-column, scrollable) ────────────────────── */}
          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-6">
                {/* Validation error banner */}
                {errorCount > 0 && (
                  <div className="mb-5 p-3.5 bg-[color:var(--status-danger)]/10 border border-[color:var(--status-danger)]/25 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2">
                    <div className="p-1.5 bg-[color:var(--status-danger)]/20 text-[color:var(--status-danger)] rounded-full shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[color:var(--status-danger)]">Validation Errors</h4>
                      <p className="text-[10px] text-[color:var(--status-danger)]/80 mt-0.5">
                        {Object.values(errors).join(" · ")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Clean Horizontal Tabs Bar */}
                <div className="sticky top-0 bg-card/90 backdrop-blur-md z-10 -mx-6 px-6 py-2.5 mb-6 border-b border-border/40 flex items-center justify-between gap-4 overflow-x-auto thin-scrollbar select-none">
                  <div className="flex gap-1.5">
                    {[
                      { id: "general", label: "General & Classification", icon: Hash },
                      { id: "vendor", label: "Vendor Details", icon: Package },
                      { id: "safety", label: "Safety Analysis", icon: Shield },
                      { id: "references", label: "Engineering Refs", icon: GitBranch },
                      { id: "admin", label: "Personnel & Admin", icon: User },
                    ].map((t) => {
                      const Icon = t.icon;
                      const isActive = activeTab === t.id;
                      const hasError = (() => {
                        if (t.id === "general") {
                          return !!(errors.plNumber || errors.name || errors.description);
                        }
                        if (t.id === "vendor") {
                          return !!errors.uvamId;
                        }
                        return false;
                      })();
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setActiveTab(t.id as any)}
                          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all border ${
                            isActive
                              ? "bg-teal-500/10 text-teal-400 border-teal-500/20 shadow-[0_2px_10px_rgba(20,184,166,0.08)]"
                              : "bg-transparent text-muted-foreground border-transparent hover:bg-secondary/40 hover:text-foreground"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{t.label}</span>
                          {hasError && (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse ml-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider hidden sm:inline-block">
                    Tab{" "}
                    {["general", "vendor", "safety", "references", "admin"].indexOf(activeTab) + 1}{" "}
                    of 5
                  </span>
                </div>

                <div className="min-h-[360px] animate-in fade-in-50 duration-200">
                  {/* ══════ GENERAL & CLASSIFICATION TABS ══════ */}
                  {activeTab === "general" && (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4 col-span-2 sm:col-span-1">
                        <h4 className="text-xs font-bold text-teal-400/90 uppercase tracking-widest flex items-center gap-2 mb-2">
                          <Hash className="w-3.5 h-3.5" /> General Identity
                        </h4>
                        <div className="space-y-4 bg-secondary/10 p-5 rounded-2xl border border-border/20">
                          {isEdit ? (
                            <F label="PL Number (read-only)">
                              <div className="bg-secondary/60 border border-border/30 rounded-xl px-4 py-2.5 text-sm font-mono text-muted-foreground">
                                {pl.plNumber}
                              </div>
                            </F>
                          ) : (
                            <F label="PL Number (8 digits) *" error={errors.plNumber}>
                              <Input
                                value={form.plNumber}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    plNumber: e.target.value,
                                  }))
                                }
                                placeholder="e.g. 38110000"
                                className={`w-full font-mono font-bold ${errors.plNumber ? "border-rose-500/50" : ""}`}
                                maxLength={8}
                                inputMode="numeric"
                              />
                            </F>
                          )}
                          <F label="Component Name *" error={errors.name}>
                            <FormTextInput
                              value={form.name}
                              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                              placeholder="Full descriptive name"
                              hasError={!!errors.name}
                            />
                          </F>
                          <div className="grid grid-cols-2 gap-4">
                            <F label="Status">
                              <Select
                                value={form.status}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    status: e.target.value as PLNumber["status"],
                                  }))
                                }
                                className="w-full"
                              >
                                <option value="ACTIVE">Active</option>
                                <option value="UNDER_REVIEW">Under Review</option>
                                <option value="OBSOLETE">Obsolete</option>
                              </Select>
                            </F>
                            <F label="Vendor Type">
                              <Select
                                value={form.vendorType}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    vendorType: e.target.value,
                                  }))
                                }
                                className="w-full"
                              >
                                <option value="">— Select —</option>
                                <option value="VD">VD (Vendor Drg)</option>
                                <option value="NVD">NVD (Non-Vendor)</option>
                              </Select>
                            </F>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 col-span-2 sm:col-span-1">
                        <h4 className="text-xs font-bold text-teal-400/90 uppercase tracking-widest flex items-center gap-2 mb-2">
                          <Layers className="w-3.5 h-3.5" /> Classification
                        </h4>
                        <div className="space-y-4 bg-secondary/10 p-5 rounded-2xl border border-border/20">
                          <div className="grid grid-cols-2 gap-4">
                            <F label="Inspection Category">
                              <Select
                                value={form.category}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    category: e.target.value as InspectionCategory,
                                  }))
                                }
                                className="w-full"
                              >
                                {(["CAT-A", "CAT-B", "CAT-C", "CAT-D"] as InspectionCategory[]).map(
                                  (c) => (
                                    <option key={c} value={c}>
                                      {c} — {INSPECTION_CATEGORY_LABELS[c]}
                                    </option>
                                  ),
                                )}
                              </Select>
                            </F>
                            <F label="Controlling Agency">
                              <Select
                                value={form.controllingAgency}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    controllingAgency: e.target.value,
                                  }))
                                }
                                className="w-full"
                              >
                                <option value="">— Select —</option>
                                {AGENCIES.map((a) => (
                                  <option key={a} value={a}>
                                    {a}
                                  </option>
                                ))}
                              </Select>
                            </F>
                          </div>
                          <F label="Application Area">
                            <FormTextInput
                              value={form.applicationArea}
                              onChange={(v) => setForm((f) => ({ ...f, applicationArea: v }))}
                              placeholder="e.g. WAP7, WAG9HC, WAG12B"
                            />
                          </F>
                        </div>
                      </div>

                      <div className="col-span-2 space-y-2">
                        <F label="Technical Description *" error={errors.description}>
                          <textarea
                            value={form.description}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                description: e.target.value,
                              }))
                            }
                            rows={4}
                            placeholder="Detailed technical description of the component..."
                            className={`${ta} ${errors.description ? "border-rose-500/50" : ""}`}
                          />
                        </F>
                      </div>
                    </div>
                  )}

                  {/* ══════ VENDOR DETAILS TAB ══════ */}
                  {activeTab === "vendor" && (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2">
                        <F label="Vendor Type Selection">
                          <Select
                            value={form.vendorType}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                vendorType: e.target.value,
                              }))
                            }
                            className="w-full max-w-xs"
                          >
                            <option value="">— Unspecified / Select —</option>
                            <option value="VD">VD (Vendor Drawing)</option>
                            <option value="NVD">NVD (Non-Vendor Directory)</option>
                          </Select>
                        </F>
                      </div>

                      {form.vendorType === "VD" && (
                        <div className="col-span-2 grid grid-cols-2 gap-6 bg-indigo-950/10 p-6 rounded-2xl border border-indigo-500/15 animate-in fade-in duration-200">
                          <div className="col-span-2 flex items-center gap-2.5 pb-2 border-b border-indigo-500/10">
                            <Package className="w-4 h-4 text-indigo-400" />
                            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                              Vendor Directory Configuration
                            </h4>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <F label="UVAM Item ID *" error={errors.uvamId}>
                              <FormTextInput
                                value={form.uvamId}
                                onChange={(v) => setForm((f) => ({ ...f, uvamId: v }))}
                                placeholder="Enter UVAM reference"
                                mono
                                hasError={!!errors.uvamId}
                              />
                            </F>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <F label="STR Number">
                              <FormTextInput
                                value={form.strNumber}
                                onChange={(v) => setForm((f) => ({ ...f, strNumber: v }))}
                                placeholder="STR reference"
                                mono
                              />
                            </F>
                          </div>
                        </div>
                      )}

                      {form.vendorType === "NVD" && (
                        <div className="col-span-2 grid grid-cols-2 gap-6 bg-purple-950/10 p-6 rounded-2xl border border-purple-500/15 animate-in fade-in duration-200">
                          <div className="col-span-2 flex items-center gap-2.5 pb-2 border-b border-purple-500/10">
                            <Package className="w-4 h-4 text-purple-400" />
                            <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest">
                              Non-Vendor Details & Criteria
                            </h4>
                          </div>
                          <div className="col-span-2">
                            <F label="Eligibility Criteria">
                              <textarea
                                value={form.eligibilityCriteria}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    eligibilityCriteria: e.target.value,
                                  }))
                                }
                                rows={3}
                                placeholder="Document eligibility criteria..."
                                className={ta}
                              />
                            </F>
                          </div>
                          <div className="col-span-2">
                            <F label="Procurement Conditions">
                              <textarea
                                value={form.procurementConditions}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    procurementConditions: e.target.value,
                                  }))
                                }
                                rows={3}
                                placeholder="Procurement conditions, restrictions..."
                                className={ta}
                              />
                            </F>
                          </div>
                        </div>
                      )}

                      {!form.vendorType && (
                        <div className="col-span-2 p-10 rounded-2xl bg-secondary/10 border border-border/20 text-center space-y-3">
                          <Package className="w-8 h-8 mx-auto text-muted-foreground opacity-60" />
                          <div>
                            <p className="text-sm font-bold text-foreground">
                              No Vendor Type Configured
                            </p>
                            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                              Select a vendor type from the option above to access UVAM Item IDs,
                              STR configurations, eligibility criteria, or procurement restrictions.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ══════ SAFETY ANALYSIS TAB ══════ */}
                  {activeTab === "safety" && (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2 flex items-center justify-between p-5 rounded-2xl bg-rose-950/5 border border-rose-500/10 shadow-[0_2px_8px_rgba(244,63,94,0.02)]">
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Shield className="w-4 h-4 text-rose-500" /> Safety Vital Component
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Identify if this part requires additional security, diagnostics, and
                            testing validation rules.
                          </p>
                        </div>
                        <Switch
                          checked={form.safetyCritical}
                          onCheckedChange={(safetyCritical) =>
                            setForm((f) => ({ ...f, safetyCritical }))
                          }
                          aria-label="Toggle safety vital component"
                        />
                      </div>

                      {form.safetyCritical ? (
                        <div className="col-span-2 grid grid-cols-2 gap-6 bg-rose-950/10 p-6 rounded-2xl border border-rose-500/15 animate-in fade-in duration-200">
                          <div className="col-span-2 sm:col-span-1">
                            <F label="Safety Classification">
                              <Select
                                value={form.safetyClassification}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    safetyClassification: e.target.value,
                                  }))
                                }
                                className="w-full"
                              >
                                <option value="">— None —</option>
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="CRITICAL">Critical</option>
                              </Select>
                            </F>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <F label="Severity of Failure">
                              <FormTextInput
                                value={form.severityOfFailure}
                                onChange={(v) =>
                                  setForm((f) => ({
                                    ...f,
                                    severityOfFailure: v,
                                  }))
                                }
                                placeholder="e.g. Catastrophic"
                              />
                            </F>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <F label="Functionality">
                              <FormTextInput
                                value={form.functionality}
                                onChange={(v) => setForm((f) => ({ ...f, functionality: v }))}
                                placeholder="Primary function description"
                              />
                            </F>
                          </div>
                          <div className="col-span-2">
                            <F label="Consequences of Failure">
                              <textarea
                                value={form.consequences}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    consequences: e.target.value,
                                  }))
                                }
                                rows={3}
                                placeholder="Describe consequences of safety failure..."
                                className={ta}
                              />
                            </F>
                          </div>
                        </div>
                      ) : (
                        <div className="col-span-2 p-10 rounded-2xl bg-secondary/10 border border-border/20 text-center space-y-3">
                          <Shield className="w-8 h-8 mx-auto text-muted-foreground opacity-60" />
                          <div>
                            <p className="text-sm font-bold text-foreground">
                              Standard Non-Safety Component
                            </p>
                            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                              This component is currently designated as non-safety critical. Enable
                              the switch above to configure classification ratings and failure
                              modes.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ══════ ENGINEERING REFS TAB ══════ */}
                  {activeTab === "references" && (
                    <div className="grid grid-cols-2 gap-6 bg-secondary/5 p-6 rounded-2xl border border-border/20">
                      <div className="col-span-2 sm:col-span-1">
                        <F label="Drawing Numbers (comma-separated)">
                          <FormTextInput
                            value={form.drawingNumbers}
                            onChange={(v) => setForm((f) => ({ ...f, drawingNumbers: v }))}
                            placeholder="DWG-001, DWG-002"
                            mono
                          />
                        </F>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <F label="Spec Numbers (comma-separated)">
                          <FormTextInput
                            value={form.specNumbers}
                            onChange={(v) => setForm((f) => ({ ...f, specNumbers: v }))}
                            placeholder="SPEC-101, SPEC-102"
                            mono
                          />
                        </F>
                      </div>

                      <div className="col-span-2 sm:col-span-1">
                        <F label="Mother Part / Parent Assembly">
                          <PLNumberSelect
                            value={form.motherPart}
                            onChange={(motherPart) => setForm((f) => ({ ...f, motherPart }))}
                            plItems={plItems.filter(
                              (item) => item.plNumber !== (isEdit ? pl.plNumber : form.plNumber),
                            )}
                            loading={plItemsLoading}
                            placeholder="Search parent assembly PL..."
                            helperText="Select parent assembly or leave blank."
                          />
                        </F>
                      </div>

                      {(!form.vendorType || form.vendorType !== "VD") && (
                        <div className="col-span-2 sm:col-span-1 grid grid-cols-2 gap-4">
                          <F label="UVAM ID">
                            <FormTextInput
                              value={form.uvamId}
                              onChange={(v) => setForm((f) => ({ ...f, uvamId: v }))}
                              placeholder="UVAM ref"
                              mono
                            />
                          </F>
                          <F label="STR Number">
                            <FormTextInput
                              value={form.strNumber}
                              onChange={(v) => setForm((f) => ({ ...f, strNumber: v }))}
                              placeholder="STR ref"
                              mono
                            />
                          </F>
                        </div>
                      )}

                      <div className="col-span-2">
                        <F label="Used In (PL numbers)">
                          <PLNumberMultiSelect
                            values={form.usedIn
                              .split(",")
                              .map((value) => value.trim())
                              .filter(Boolean)}
                            onChange={(values) =>
                              setForm((f) => ({
                                ...f,
                                usedIn: values.join(", "),
                              }))
                            }
                            plItems={plItems.filter(
                              (item) => item.plNumber !== (isEdit ? pl.plNumber : form.plNumber),
                            )}
                            loading={plItemsLoading}
                            helperText="Parent assemblies where this item is used."
                          />
                        </F>
                      </div>
                    </div>
                  )}

                  {/* ══════ PERSONNEL & ADMIN TAB ══════ */}
                  {activeTab === "admin" && (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2 sm:col-span-1 space-y-4">
                        <h4 className="text-xs font-bold text-teal-400/90 uppercase tracking-widest flex items-center gap-2 mb-2">
                          <User className="w-3.5 h-3.5" /> Engineering Personnel
                        </h4>
                        <div className="space-y-4 bg-secondary/10 p-5 rounded-2xl border border-border/20">
                          <F label="Design Supervisor">
                            <FormTextInput
                              value={form.designSupervisor}
                              onChange={(v) => setForm((f) => ({ ...f, designSupervisor: v }))}
                              placeholder="SSE/Design"
                            />
                          </F>
                          <F label="Concerned Supervisor">
                            <FormTextInput
                              value={form.concernedSupervisor}
                              onChange={(v) =>
                                setForm((f) => ({
                                  ...f,
                                  concernedSupervisor: v,
                                }))
                              }
                              placeholder="JE/QA"
                            />
                          </F>
                        </div>
                      </div>

                      <div className="col-span-2 sm:col-span-1 space-y-4">
                        <h4 className="text-xs font-bold text-teal-400/90 uppercase tracking-widest flex items-center gap-2 mb-2">
                          <Activity className="w-3.5 h-3.5" /> Administrative References
                        </h4>
                        <div className="space-y-4 bg-secondary/10 p-5 rounded-2xl border border-border/20">
                          <F label="E-Office File Reference">
                            <FormTextInput
                              value={form.eOfficeFile}
                              onChange={(v) => setForm((f) => ({ ...f, eOfficeFile: v }))}
                              placeholder="F.No. 100/D-1/2026"
                            />
                          </F>

                          {isEdit && (
                            <div className="bg-secondary/60 rounded-xl p-4 space-y-2.5 text-xs border border-border/20">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground font-medium">
                                  Record Created
                                </span>
                                <span className="font-mono text-foreground">
                                  {pl.createdAt ? new Date(pl.createdAt).toLocaleDateString() : "—"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground font-medium">
                                  Last Updated
                                </span>
                                <span className="font-mono text-foreground">
                                  {pl.updatedAt ? new Date(pl.updatedAt).toLocaleDateString() : "—"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground font-medium">
                                  Primary Group
                                </span>
                                <span className="font-mono text-teal-400">
                                  {pl.category ?? "—"}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {!form.vendorType && (
                        <div className="col-span-2">
                          <F label="Eligibility Criteria">
                            <textarea
                              value={form.eligibilityCriteria}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  eligibilityCriteria: e.target.value,
                                }))
                              }
                              rows={3}
                              placeholder="Eligibility requirements..."
                              className={ta}
                            />
                          </F>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* System info banner */}
                <div className="mt-6 p-3.5 bg-teal-500/5 rounded-xl border border-teal-500/15 flex items-center gap-3">
                  <Info className="w-4 h-4 text-teal-500 shrink-0" />
                  <p className="text-[10px] text-teal-300/80 font-medium uppercase tracking-wider leading-relaxed">
                    {isEdit
                      ? "Changes to this record will be routed through the review pipeline. OCR-linked documents will be re-indexed automatically."
                      : "System will verify PL number uniqueness. OCR background pipeline will be initiated upon linked document ingestion."}
                  </p>
                </div>
              </div>

              {/* ── Bottom action bar ────────────────────────────────────── */}
              <div className="flex items-center gap-3 px-6 py-3.5 bg-secondary/80 backdrop-blur border-t border-border shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleClose}
                  className="min-w-[100px]"
                >
                  Cancel
                </Button>
                <div className="flex-1" />
                {hasUnsavedChanges && (
                  <span className="text-[10px] text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Unsaved changes
                  </span>
                )}
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="min-w-[140px] shadow-xl shadow-teal-900/30"
                >
                  {saving ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />{" "}
                      Saving…
                    </>
                  ) : isEdit ? (
                    <>
                      <Save className="w-4 h-4" /> Save Changes
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> Register PL Record
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Discard warning */}
      {showDiscardWarning && (
        <>
          <div className="fixed inset-0 z-[110] bg-black/50" />
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-sm font-bold text-foreground">Discard changes?</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                You have unsaved changes. Closing will discard all modifications.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDiscardWarning(false)}
                  className="flex-1"
                >
                  Continue Editing
                </Button>
                <Button variant="danger" size="sm" onClick={onClose} className="flex-1">
                  Discard
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ─── Add Engineering Change Form ───────────────────────────────────────────────

interface AddECFormProps {
  onAdd: (ec: Omit<EngineeringChange, "id">) => void;
  onCancel: () => void;
}

function AddECForm({ onAdd, onCancel }: AddECFormProps) {
  const [form, setForm] = useState({
    ecNumber: "",
    description: "",
    status: "OPEN" as EngineeringChange["status"],
    date: new Date().toISOString().slice(0, 10),
    author: "",
  });

  const handleAdd = () => {
    if (!form.ecNumber.trim() || !form.description.trim()) return;
    onAdd({
      ecNumber: form.ecNumber.trim(),
      description: form.description.trim(),
      status: form.status,
      date: form.date,
      author: form.author.trim() || undefined,
    });
  };

  return (
    <div className="p-4 rounded-xl bg-teal-500/5 border border-teal-500/20 space-y-3 mb-4">
      <p className="text-xs font-semibold text-primary uppercase tracking-widest">
        New Engineering Change
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="block text-[10px] font-medium text-muted-foreground mb-1">
            EC Number *
          </span>
          <Input
            value={form.ecNumber}
            onChange={(e) => setForm((f) => ({ ...f, ecNumber: e.target.value }))}
            placeholder="EC-2026-XXXX"
            className="w-full font-mono"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-muted-foreground mb-1">Status</label>
          <Select
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                status: e.target.value as EngineeringChange["status"],
              }))
            }
            className="w-full"
          >
            <option value="OPEN">Open</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="IMPLEMENTED">Implemented</option>
            <option value="RELEASED">Released</option>
          </Select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-muted-foreground mb-1">Date</label>
          <DatePicker value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-muted-foreground mb-1">Author</label>
          <Input
            value={form.author}
            onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
            placeholder="e.g. A. Sharma"
            className="w-full"
          />
        </div>
      </div>
      <div>
        <span className="block text-[10px] font-medium text-muted-foreground mb-1">
          Description *
        </span>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={2}
          placeholder="Describe the engineering change..."
          className="w-full bg-background border border-border text-foreground text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 transition-all placeholder:text-muted-foreground resize-none"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!form.ecNumber.trim() || !form.description.trim()}
        >
          <Plus className="w-3.5 h-3.5" /> Add EC
        </Button>
      </div>
    </div>
  );
}

// ─── PLNumber Detail View ──────────────────────────────────────────────────────

type PLNumberTab = "overview" | "documents" | "changes" | "crossrefs";

function isPLNumberTab(value: string | null): value is PLNumberTab {
  return (
    value === "overview" || value === "documents" || value === "changes" || value === "crossrefs"
  );
}

function PLNumberDetailView({
  pl,
  onUpdate,
  onDirectUpdate,
}: {
  pl: PLNumber;
  onUpdate: (patch: Partial<PLNumber>) => Promise<void>;
  onDirectUpdate: (patch: Partial<PLNumber>) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<PLNumberTab>(() =>
    isPLNumberTab(searchParams.get("tab")) ? (searchParams.get("tab") as PLNumberTab) : "overview",
  );
  const [editOpen, setEditOpen] = useState(false);
  const [showAddEC, setShowAddEC] = useState(false);
  const [expandedCrossrefAlertId, setExpandedCrossrefAlertId] = useState<string | null>(null);
  const { documents, loading: documentsLoading } = usePlLinkableDocuments();
  const {
    alerts: documentAlerts,
    approveAlert,
    bypassAlert,
  } = useDocumentChangeAlerts({ plItem: pl.id });
  const focusedDocumentId = searchParams.get("doc");

  const linkedDocs = useMemo(
    () => documents.filter((d) => (pl.linkedDocumentIds ?? []).includes(d.id)),
    [documents, pl.linkedDocumentIds],
  );
  const documentAlertMap = useMemo(
    () => Object.fromEntries(documentAlerts.map((alert) => [alert.documentId, alert])),
    [documentAlerts],
  );

  const engineeringChanges = pl.engineeringChanges ?? [];

  const handleExport = () => {
    exportPlDetails(`PL-${pl.plNumber}-summary`, [
      ["PL Number", pl.plNumber],
      ["Name", pl.name],
      ["Status", pl.status],
      ["Category", pl.category],
      ["Controlling Agency", pl.controllingAgency ?? "—"],
      ["Application Area", pl.applicationArea ?? "—"],
      ["Design Supervisor", pl.designSupervisor ?? "—"],
      ["Concerned Supervisor", pl.concernedSupervisor ?? "—"],
      ["Linked Documents", linkedDocs.length],
      ["Engineering Changes", engineeringChanges.length],
    ]);
    toast.success("PL summary exported");
  };

  const handleCreateCase = () => {
    navigate(
      `/cases?new=1&pl=${encodeURIComponent(pl.plNumber)}&title=${encodeURIComponent(`Review ${pl.name}`)}&description=${encodeURIComponent(`Create a follow-up case for PL ${pl.plNumber} — ${pl.name}.`)}`,
    );
  };

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    const nextTab = searchParams.get("tab");
    if (isPLNumberTab(nextTab)) {
      setActiveTab(nextTab);
    }
  }, [searchParams]);

  const handleAddEC = async (ec: Omit<EngineeringChange, "id">) => {
    const newEC: EngineeringChange = {
      ...ec,
      id: `EC-${Date.now()}`,
    };
    await onUpdate({ engineeringChanges: [...engineeringChanges, newEC] });
    setShowAddEC(false);
  };

  const handleTabChange = (tab: PLNumberTab) => {
    setActiveTab(tab);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("tab", tab);
        if (tab !== "documents" && tab !== "crossrefs") {
          next.delete("doc");
        }
        return next;
      },
      { replace: true },
    );
  };

  const tabs: { id: PLNumberTab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "documents", label: "Documents", count: linkedDocs.length },
    {
      id: "changes",
      label: "Engineering Changes",
      count: engineeringChanges.length,
    },
    { id: "crossrefs", label: "Cross-References" },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() => navigate("/pl")}
          className="flex items-center gap-2 text-muted-foreground hover:text-primary/90 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to PL Knowledge Hub
        </button>
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              {pl.safetyCritical ? (
                <Shield className="w-6 h-6 text-rose-400" />
              ) : (
                <DatabaseBackup className="w-6 h-6 text-muted-foreground" />
              )}
              <h1 className="text-2xl font-bold text-white">{pl.name}</h1>
              <Badge variant={statusBadgeVariant(pl.status)}>
                {pl.status === "ACTIVE"
                  ? "Active"
                  : pl.status === "UNDER_REVIEW"
                    ? "Under Review"
                    : "Obsolete"}
              </Badge>
              {pl.safetyCritical && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-900/50 border border-rose-500/30 rounded-full text-xs text-rose-300">
                  <Shield className="w-3 h-3" /> Safety Vital
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded border text-xs font-semibold ${CATEGORY_COLORS[pl.category] ?? "bg-muted text-muted-foreground"}`}
              >
                {pl.category}
              </span>
            </div>
            <p className="text-muted-foreground text-sm font-mono pl-9 flex items-center gap-2">
              <Hash className="w-3.5 h-3.5" />
              {pl.plNumber}
              {pl.controllingAgency && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  {pl.controllingAgency}
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Edit3 className="w-4 h-4" /> Edit PL
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4" /> Export
            </Button>
            <Button variant="secondary" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4" /> Print
            </Button>
            <Button size="sm" onClick={handleCreateCase}>
              <AlertCircle className="w-4 h-4" /> Create Case
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex-shrink-0 px-4 py-2.5 text-xs font-medium border-b-2 transition-all -mb-px flex items-center gap-1.5 ${
              activeTab === tab.id
                ? "border-teal-500 text-primary/90"
                : "border-transparent text-muted-foreground hover:text-foreground/90"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${activeTab === tab.id ? "bg-teal-500/20 text-primary/90" : "bg-secondary text-muted-foreground"}`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <GlassCard className="p-3.5 hover:border-primary/20 hover:bg-secondary/30 transition-all duration-200">
              <h2 className="text-sm font-bold text-white mb-3">Technical Description</h2>
              <p className="text-sm text-foreground/90 leading-relaxed">{pl.description || "—"}</p>
            </GlassCard>

            <GlassCard className="p-3.5 hover:border-primary/20 hover:bg-secondary/30 transition-all duration-200">
              <h2 className="text-sm font-bold text-white mb-4">Properties</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <InfoRow label="PL Number" value={pl.plNumber} mono />
                <InfoRow label="Category" value={pl.category} />
                <InfoRow label="Agency" value={pl.controllingAgency} />
                <InfoRow label="Application Area" value={pl.applicationArea} />
                <InfoRow label="Mother Part" value={pl.motherPart} />
                <InfoRow label="Vendor Type" value={pl.vendorType} />
                <InfoRow label="UVAM ID" value={pl.uvamId} />
                <InfoRow label="STR Number" value={pl.strNumber} />
                <InfoRow label="Design Supervisor" value={pl.designSupervisor} />
                <InfoRow label="Concerned Supervisor" value={pl.concernedSupervisor} />
                <InfoRow label="E-Office File" value={pl.eOfficeFile} />
                <InfoRow label="Last Updated" value={pl.updatedAt?.slice(0, 10)} />
              </div>
            </GlassCard>

            {(pl.drawingNumbers?.length > 0 || pl.specNumbers?.length > 0) && (
              <GlassCard className="p-3.5 hover:border-primary/20 hover:bg-secondary/30 transition-all duration-200">
                <h2 className="text-sm font-bold text-white mb-4">Engineering References</h2>
                {pl.drawingNumbers?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
                      Drawing Numbers
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {pl.drawingNumbers.map((d) => (
                        <span
                          key={d}
                          className="px-2.5 py-1 bg-secondary/60 border border-border/40 rounded-lg text-xs font-mono text-foreground/90"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {pl.specNumbers?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
                      Spec Numbers
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {pl.specNumbers.map((s) => (
                        <span
                          key={s}
                          className="px-2.5 py-1 bg-secondary/60 border border-border/40 rounded-lg text-xs font-mono text-foreground/90"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </GlassCard>
            )}

            {(pl.consequences ||
              pl.severityOfFailure ||
              pl.eligibilityCriteria ||
              pl.procurementConditions) && (
              <GlassCard className="p-3.5 hover:border-primary/20 hover:bg-secondary/30 transition-all duration-200">
                <h2 className="text-sm font-bold text-white mb-4">Safety & Eligibility Details</h2>
                <div className="space-y-3">
                  <InfoRow label="Safety Classification" value={pl.safetyClassification} />
                  <InfoRow label="Severity of Failure" value={pl.severityOfFailure} />
                  {pl.consequences && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">
                        Consequences of Failure
                      </p>
                      <p className="text-sm text-foreground/90">{pl.consequences}</p>
                    </div>
                  )}
                  {pl.functionality && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">
                        Functionality
                      </p>
                      <p className="text-sm text-foreground/90">{pl.functionality}</p>
                    </div>
                  )}
                  {pl.eligibilityCriteria && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">
                        Eligibility Criteria
                      </p>
                      <p className="text-sm text-foreground/90">{pl.eligibilityCriteria}</p>
                    </div>
                  )}
                  {pl.procurementConditions && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">
                        Procurement Conditions
                      </p>
                      <p className="text-sm text-foreground/90">{pl.procurementConditions}</p>
                    </div>
                  )}
                </div>
              </GlassCard>
            )}
          </div>

          <div className="space-y-4">
            <GlassCard className="p-3.5 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 transition-all duration-200">
              <h3 className="text-sm font-bold text-white mb-3">Quick Stats</h3>
              <div className="space-y-2">
                {[
                  {
                    label: "Linked Documents",
                    value: (pl.linkedDocumentIds ?? []).length,
                  },
                  {
                    label: "Drawing Numbers",
                    value: (pl.drawingNumbers ?? []).length,
                  },
                  {
                    label: "Spec Numbers",
                    value: (pl.specNumbers ?? []).length,
                  },
                  {
                    label: "Engineering Changes",
                    value: (pl.engineeringChanges ?? []).length,
                  },
                  {
                    label: "Used In (Assemblies)",
                    value: (pl.usedIn ?? []).length,
                  },
                  {
                    label: "Linked Work Records",
                    value: (pl.linkedWorkIds ?? []).length,
                  },
                  {
                    label: "Linked Cases",
                    value: (pl.linkedCaseIds ?? []).length,
                  },
                ].map((s) => (
                  <div key={s.label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="text-primary font-semibold">{s.value}</span>
                  </div>
                ))}
              </div>
            </GlassCard>

            {(pl.usedIn ?? []).length > 0 && (
              <GlassCard className="p-3.5 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 transition-all duration-200">
                <h3 className="text-sm font-bold text-white mb-3">Used In</h3>
                <div className="space-y-1.5">
                  {(pl.usedIn ?? []).map((p) => (
                    <div key={p} className="flex items-center gap-2 text-sm">
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      <span
                        className="font-mono text-primary text-xs cursor-pointer hover:underline"
                        onClick={() => navigate(`/pl/${p}`)}
                      >
                        {p}
                      </span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Recent Activity Feed */}
            {(pl.engineeringChanges ?? []).length > 0 && (
              <GlassCard className="p-3.5 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 transition-all duration-200">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Recent Activity
                </h3>
                <div className="space-y-3">
                  {[...(pl.engineeringChanges ?? [])]
                    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
                    .slice(0, 5)
                    .map((ec) => (
                      <div key={ec.id} className="flex gap-2.5">
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${EC_STATUS_DOT[ec.status] ?? "bg-muted-foreground"}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[10px] text-primary/90">
                              {ec.ecNumber}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold ${EC_STATUS_VARIANT[ec.status] ?? "bg-secondary text-muted-foreground border-border"}`}
                            >
                              {ec.status.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {ec.description}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {ec.date} · {ec.author}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
                {(pl.engineeringChanges ?? []).length > 5 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("changes")}
                    className="mt-3 text-xs text-primary hover:text-primary/90 transition-colors"
                  >
                    +{(pl.engineeringChanges ?? []).length - 5} more changes →
                  </button>
                )}
              </GlassCard>
            )}
          </div>
        </div>
      )}

      {/* Documents Tab — Two-Column Document Linking */}
      {activeTab === "documents" && (
        <DocumentLinkingSection
          pl={pl}
          documents={documents}
          documentsLoading={documentsLoading}
          documentAlerts={documentAlertMap}
          onLinkChange={(nextLinkedIds) => onDirectUpdate({ linkedDocumentIds: nextLinkedIds })}
          onApproveAlert={approveAlert}
          onBypassAlert={bypassAlert}
          focusedDocumentId={focusedDocumentId}
        />
      )}

      {/* Engineering Changes Tab */}
      {activeTab === "changes" && (
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white">Engineering Changes</h2>
            <Button size="sm" onClick={() => setShowAddEC((v) => !v)}>
              {showAddEC ? (
                <>
                  <X className="w-3.5 h-3.5" /> Cancel
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" /> Add EC
                </>
              )}
            </Button>
          </div>

          {showAddEC && <AddECForm onAdd={handleAddEC} onCancel={() => setShowAddEC(false)} />}

          {engineeringChanges.length > 0 ? (
            <div className="space-y-0">
              {[...engineeringChanges].reverse().map((ec, i) => (
                <div key={ec.id} className="flex gap-4">
                  <div className="flex flex-col items-center pt-1">
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${EC_STATUS_DOT[ec.status] ?? "bg-muted-foreground"}`}
                    />
                    {i < engineeringChanges.length - 1 && (
                      <div
                        className="w-px flex-1 bg-muted mt-1 mb-0"
                        style={{ minHeight: "28px" }}
                      />
                    )}
                  </div>
                  <div className="flex-1 pb-5">
                    <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-primary font-semibold">
                          {ec.ecNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${EC_STATUS_VARIANT[ec.status] ?? "bg-secondary text-muted-foreground border-border"}`}
                        >
                          {ec.status.replace("_", " ")}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{ec.date}</span>
                    </div>
                    <p className="text-sm text-foreground leading-snug">{ec.description}</p>
                    {ec.author && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {ec.author}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            !showAddEC && (
              <div className="text-center py-10">
                <GitBranch className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground text-sm">No engineering changes recorded.</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Add the first engineering change using the button above.
                </p>
              </div>
            )
          )}
        </GlassCard>
      )}

      {/* Cross-References Tab */}
      {activeTab === "crossrefs" && (
        <div className="space-y-4">
          {/* Linked Documents summary */}
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold text-white">Documents</h2>
              <span className="px-1.5 py-0.5 bg-teal-500/10 text-primary/90 border border-teal-500/20 rounded-full text-[10px] font-semibold">
                {linkedDocs.length}
              </span>
              {documentAlerts.length > 0 && (
                <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-200 border border-amber-500/25 rounded-full text-[10px] font-semibold">
                  {documentAlerts.length} alert
                  {documentAlerts.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {linkedDocs.length > 0 ? (
              <div className="space-y-1.5">
                {linkedDocs.map((doc) => {
                  const alert = documentAlertMap[doc.id];
                  const isFocused = focusedDocumentId === doc.id;

                  return (
                    <div key={doc.id} className="space-y-2">
                      <div
                        {...getDocumentContextAttributes(doc.id, doc.name)}
                        className={`flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 border cursor-pointer transition-all ${alert ? "border-amber-500/25 hover:border-amber-400/45" : "border-border/40 hover:border-teal-500/30"} ${isFocused ? "ring-2 ring-amber-400/50" : ""}`}
                        onClick={() => navigate(`/documents/${doc.id}`)}
                      >
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-foreground truncate">{doc.name}</span>
                          <span className="font-mono text-[10px] text-muted-foreground ml-2">
                            {doc.id}
                          </span>
                          {alert && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Change alert
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {(doc.ocrStatus === "Completed" || doc.ocrStatus === "COMPLETED") && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-[9px] text-indigo-300">
                              <FileSearch className="w-2.5 h-2.5" /> OCR
                            </span>
                          )}
                          {alert && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setExpandedCrossrefAlertId((current) =>
                                  current === alert.id ? null : alert.id,
                                );
                              }}
                              className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-100 hover:bg-amber-500/14 transition-colors"
                            >
                              {expandedCrossrefAlertId === alert.id ? "Hide review" : "Review"}
                            </button>
                          )}
                          <Badge variant={statusBadgeVariant(doc.status)} className="text-[9px]">
                            {doc.status}
                          </Badge>
                          <DocumentPreviewButton
                            documentId={doc.id}
                            title={doc.name}
                            iconOnly
                            className="h-7 min-h-0 px-2 text-foreground/90 hover:text-teal-200"
                          />
                        </div>
                      </div>
                      {alert && expandedCrossrefAlertId === alert.id && (
                        <DocumentChangeReviewCard
                          alert={alert}
                          defaultOpen
                          className="border-amber-500/15"
                          onOpenPl={() => navigate(`/pl/${pl.id}?tab=crossrefs&doc=${doc.id}`)}
                          onApprove={() =>
                            approveAlert(alert.id, "Approved from PL cross-reference list")
                          }
                          onBypass={() =>
                            bypassAlert(alert.id, {
                              bypassReason: "Bypassed from PL cross-reference list",
                            })
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No documents linked.</p>
            )}
          </GlassCard>

          {/* Linked Work Records */}
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-bold text-white">Work Records</h2>
              <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-full text-[10px] font-semibold">
                {(pl.linkedWorkIds ?? []).length}
              </span>
            </div>
            {(pl.linkedWorkIds ?? []).length > 0 ? (
              <div className="space-y-1.5">
                {(pl.linkedWorkIds ?? []).map((id) => {
                  const isOpen = id.startsWith("WR-OPEN") || id.includes("-OPEN-");
                  const isClosed = id.startsWith("WR-CLOSED") || id.includes("-CLOSED-");
                  const statusVariant = isClosed
                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                    : isOpen
                      ? "bg-muted text-muted-foreground border-border"
                      : "bg-amber-500/10 text-amber-300 border-amber-500/30";
                  const statusLabel = isClosed ? "Closed" : isOpen ? "Open" : "In Progress";
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/40 cursor-pointer hover:border-blue-500/30 transition-all"
                      onClick={() => navigate(`/ledger?id=${id}`)}
                    >
                      <Briefcase className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="font-mono text-xs text-blue-300 flex-1">{id}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold shrink-0 ${statusVariant}`}
                      >
                        {statusLabel}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No work records linked to this PL.</p>
            )}
          </GlassCard>

          {/* Linked Cases */}
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">Cases</h2>
              <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-full text-[10px] font-semibold">
                {(pl.linkedCaseIds ?? []).length}
              </span>
            </div>
            {(pl.linkedCaseIds ?? []).length > 0 ? (
              <div className="space-y-1.5">
                {(pl.linkedCaseIds ?? []).map((id) => {
                  const isClosed = id.includes("-CLOSED") || id.includes("RESOLVED");
                  const isOpen = id.includes("-OPEN") || id.includes("ACTIVE");
                  const caseStatus = isClosed ? "Resolved" : isOpen ? "Active" : "Open";
                  const caseVariant = isClosed
                    ? "bg-muted text-muted-foreground border-border"
                    : "bg-amber-500/10 text-amber-300 border-amber-500/30";
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/40 cursor-pointer hover:border-amber-500/30 transition-all"
                      onClick={() => navigate(`/cases?id=${id}`)}
                    >
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-mono text-xs text-amber-300 flex-1">{id}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold shrink-0 ${caseVariant}`}
                      >
                        {caseStatus}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No cases linked to this PL.</p>
            )}
          </GlassCard>
        </div>
      )}

      {/* Edit Modal */}
      {editOpen && (
        <PLFormModal mode="edit" pl={pl} onClose={() => setEditOpen(false)} onSave={onUpdate} />
      )}
    </div>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────

export default function PLDetail({ plId: plIdProp }: { plId?: string } = {}) {
  const params = useParams();
  const id = plIdProp ?? params.id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: plItem, loading: plItemLoading, refetch: refetchPL } = usePLItem(id);

  const plRecord = id ? getPLRecord(id) : undefined;
  const legacyPL = !plRecord
    ? MOCK_PL_RECORDS.find((r) => r.id === `PL-${id}` || r.id === id)
    : undefined;

  const [activeTab, setActiveTab] = useState<
    "overview" | "documents" | "drawings" | "whereUsed" | "changes" | "effectivity"
  >("overview");

  const handleUpdatePL = async (patch: Partial<PLNumber>) => {
    if (!plItem) return;
    const basePayload = PLPreviewService.toPreviewPayload(plItem);
    const preview = PLPreviewService.createDraft({
      mode: "edit",
      baseline: plItem,
      draft: {
        ...basePayload,
        ...patch,
      },
      actor: user ?? undefined,
      originPath: `/pl/${plItem.plNumber}`,
    });
    toast.success("PL change review opened", {
      description: `PL-${plItem.plNumber}`,
    });
    navigate(`/pl/preview/${preview.draftId}`);
  };

  const handleDirectUpdatePL = async (patch: Partial<PLNumber>) => {
    if (!plItem) return;
    try {
      await PLService.update(plItem.id, patch);
      toast.success("PL updated", { description: `PL-${plItem.plNumber}` });
      refetchPL();
    } catch (err) {
      toast.error("Update failed", {
        description: err instanceof Error ? err.message : "An unexpected error occurred",
      });
    }
  };

  if (plItemLoading && !plRecord && !legacyPL) {
    return <LoadingState message="Loading PL record..." />;
  }

  if (plItem) {
    return (
      <PLNumberDetailView
        pl={plItem}
        onUpdate={handleUpdatePL}
        onDirectUpdate={handleDirectUpdatePL}
      />
    );
  }

  if (plRecord) {
    const handleLegacyExport = () => {
      exportPlDetails(`PL-${plRecord.plNumber}-summary`, [
        ["PL Number", plRecord.plNumber],
        ["Name", plRecord.name],
        ["Revision", plRecord.revision],
        ["Lifecycle State", plRecord.lifecycleState],
        ["Type", plRecord.type],
        ["Owner", plRecord.owner],
        ["Department", plRecord.department],
        ["Linked Documents", plRecord.linkedDocuments.length],
        ["Linked Drawings", plRecord.linkedDrawings.length],
        ["Where Used", plRecord.whereUsed.length],
      ]);
      toast.success("PL summary exported");
    };

    const handleLegacyCreateCase = () => {
      navigate(
        `/cases?new=1&pl=${encodeURIComponent(plRecord.plNumber)}&title=${encodeURIComponent(`Review ${plRecord.name}`)}&description=${encodeURIComponent(`Create a follow-up case for PL ${plRecord.plNumber} — ${plRecord.name}.`)}`,
      );
    };

    const tabs = [
      { id: "overview", label: "Overview" },
      {
        id: "documents",
        label: `Linked Documents (${plRecord.linkedDocuments.length})`,
      },
      { id: "drawings", label: `Drawings (${plRecord.linkedDrawings.length})` },
      { id: "whereUsed", label: "Where Used" },
      { id: "changes", label: "Change History" },
      { id: "effectivity", label: "Effectivity" },
    ] as const;

    return (
      <div className="space-y-6 max-w-[1400px] mx-auto">
        <div>
          <button
            type="button"
            onClick={() => navigate("/pl")}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary/90 text-sm mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to PL Knowledge Hub
          </button>
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <NodeIcon type={plRecord.type} className="w-6 h-6" />
                <h1 className="text-2xl font-bold text-white">{plRecord.name}</h1>
                <Badge variant={statusBadgeVariant(plRecord.lifecycleState)}>
                  {plRecord.lifecycleState}
                </Badge>
                {plRecord.safetyVital && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-900/50 border border-rose-500/30 rounded-full text-xs text-rose-300">
                    <Shield className="w-3 h-3" /> Safety Vital
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-sm font-mono pl-9 flex items-center gap-2">
                <Hash className="w-3.5 h-3.5" />
                PL {plRecord.plNumber} · Rev {plRecord.revision} · {plRecord.type}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleLegacyExport}>
                <Download className="w-4 h-4" /> Export
              </Button>
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer className="w-4 h-4" /> Print
              </Button>
              <Button onClick={handleLegacyCreateCase}>
                <AlertCircle className="w-4 h-4" /> Create Case
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-shrink-0 px-4 py-2.5 text-xs font-medium border-b-2 transition-all -mb-px ${
                activeTab === tab.id
                  ? "border-teal-500 text-primary/90"
                  : "border-transparent text-muted-foreground hover:text-foreground/90"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <GlassCard className="p-3.5 hover:border-primary/20 hover:bg-secondary/30 transition-all duration-200">
                <h2 className="text-base font-bold text-white mb-3">Description</h2>
                <p className="text-sm text-foreground/90 leading-relaxed">{plRecord.description}</p>
              </GlassCard>
              <GlassCard className="p-3.5 hover:border-primary/20 hover:bg-secondary/30 transition-all duration-200">
                <h2 className="text-base font-bold text-white mb-4">Properties</h2>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    {
                      icon: Hash,
                      label: "PL Number",
                      value: plRecord.plNumber,
                      mono: true,
                    },
                    { icon: Activity, label: "Type", value: plRecord.type },
                    { icon: User, label: "Owner", value: plRecord.owner },
                    {
                      icon: Building2,
                      label: "Department",
                      value: plRecord.department,
                    },
                    { icon: Package, label: "Source", value: plRecord.source },
                    {
                      icon: Weight,
                      label: "Weight",
                      value: plRecord.weight ?? "—",
                    },
                    {
                      icon: Calendar,
                      label: "Created",
                      value: plRecord.createdDate,
                    },
                    {
                      icon: Calendar,
                      label: "Last Modified",
                      value: plRecord.lastModified,
                    },
                  ].map((f) => (
                    <div key={f.label} className="flex items-start gap-3">
                      <f.icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">{f.label}</p>
                        <p
                          className={`text-sm font-medium text-foreground ${f.mono ? "font-mono" : ""}`}
                        >
                          {f.value}
                        </p>
                      </div>
                    </div>
                  ))}
                  {plRecord.supplier && (
                    <div className="flex items-start gap-3">
                      <Building2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Supplier</p>
                        <p className="text-sm font-medium text-foreground">{plRecord.supplier}</p>
                        {plRecord.supplierPartNo && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {plRecord.supplierPartNo}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </GlassCard>
            </div>

            <div className="space-y-4">
              <GlassCard className="p-3.5 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 transition-all duration-200">
                <h3 className="text-sm font-bold text-white mb-3">Tags & Classification</h3>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {plRecord.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`px-2 py-0.5 border text-xs rounded-full ${tagColor(tag)}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mb-1">Classification</div>
                <p className="text-xs text-foreground/90">{plRecord.classification}</p>
              </GlassCard>
              <GlassCard className="p-3.5 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 transition-all duration-200">
                <h3 className="text-sm font-bold text-white mb-3">Quick Stats</h3>
                <div className="space-y-2">
                  {[
                    {
                      label: "Documents",
                      value: plRecord.linkedDocuments.length,
                    },
                    {
                      label: "Drawings",
                      value: plRecord.linkedDrawings.length,
                    },
                    { label: "Where Used", value: plRecord.whereUsed.length },
                    { label: "Changes", value: plRecord.changeHistory.length },
                    { label: "Alternates", value: plRecord.alternates.length },
                  ].map((s) => (
                    <div key={s.label} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="text-primary font-semibold">{s.value}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          </div>
        )}

        {activeTab === "documents" && (
          <GlassCard className="p-3.5 hover:border-primary/20 transition-all duration-200">
            <h2 className="text-base font-bold text-white mb-4">Linked Documents</h2>
            <div className="space-y-3">
              {plRecord.linkedDocuments.map((doc) => (
                <div
                  key={doc.docId}
                  {...getDocumentContextAttributes(doc.docId, doc.title)}
                  className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30 border border-border hover:border-teal-500/30 cursor-pointer transition-all"
                  onClick={() => navigate(`/documents/${doc.docId}`)}
                >
                  <FileText className="w-9 h-9 p-2 rounded-lg bg-teal-500/10 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{doc.title}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="font-mono text-primary">{doc.docId}</span>
                      <span>{doc.type}</span>
                      <span>Rev {doc.revision}</span>
                      <span>{doc.size}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={statusBadgeVariant(doc.status)}>{doc.status}</Badge>
                    <DocumentPreviewButton
                      documentId={doc.docId}
                      title={doc.title}
                      iconOnly
                      className="h-8 min-h-0 px-2 text-foreground/90 hover:text-teal-200"
                    />
                    <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
                  </div>
                </div>
              ))}
              {plRecord.linkedDocuments.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No documents linked to this PL record.
                </p>
              )}
            </div>
          </GlassCard>
        )}

        {activeTab === "drawings" && (
          <GlassCard className="p-3.5 hover:border-primary/20 transition-all duration-200">
            <h2 className="text-base font-bold text-white mb-4">Linked Drawings</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-3 text-left font-semibold pl-4">Drawing ID</th>
                    <th className="pb-3 text-left font-semibold">Title</th>
                    <th className="pb-3 text-left font-semibold">Sheet</th>
                    <th className="pb-3 text-left font-semibold">Rev</th>
                    <th className="pb-3 text-left font-semibold">Format</th>
                    <th className="pb-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30">
                  {plRecord.linkedDrawings.map((d) => (
                    <tr key={d.drawingId} className="hover:bg-secondary/30 transition-colors">
                      <td className="py-3 pl-4 font-mono text-xs text-primary">{d.drawingId}</td>
                      <td className="py-3 text-foreground text-sm">{d.title}</td>
                      <td className="py-3 text-muted-foreground text-xs">{d.sheetNo}</td>
                      <td className="py-3 font-mono text-xs text-foreground/90">{d.revision}</td>
                      <td className="py-3 text-muted-foreground text-xs">{d.format}</td>
                      <td className="py-3">
                        <Badge variant={statusBadgeVariant(d.status)}>{d.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {plRecord.linkedDrawings.length === 0 && (
                <p className="text-muted-foreground text-sm mt-4">
                  No drawings linked to this PL record.
                </p>
              )}
            </div>
          </GlassCard>
        )}

        {activeTab === "whereUsed" && (
          <GlassCard className="p-3.5 hover:border-primary/20 transition-all duration-200">
            <h2 className="text-base font-bold text-white mb-4">Where Used</h2>
            {plRecord.whereUsed.length > 0 ? (
              <div className="space-y-3">
                {plRecord.whereUsed.map((u, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30 border border-border cursor-pointer hover:border-teal-500/30 transition-all"
                    onClick={() => navigate(`/pl/${u.parentPL}`)}
                  >
                    <Box className="w-8 h-8 p-1.5 rounded-lg bg-blue-500/10 text-blue-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{u.parentName}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {u.parentPL} · Find No. {u.findNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Quantity</p>
                      <p className="text-lg font-bold text-primary">{u.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                This is a top-level assembly and is not used in any parent assemblies.
              </p>
            )}
          </GlassCard>
        )}

        {activeTab === "changes" && (
          <GlassCard className="p-3.5 hover:border-primary/20 transition-all duration-200">
            <h2 className="text-base font-bold text-white mb-4">Change History</h2>
            {plRecord.changeHistory.length > 0 ? (
              <div className="space-y-4">
                {plRecord.changeHistory.map((c, i) => (
                  <div key={c.changeId} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${c.status === "Implemented" ? "bg-teal-500/10 border-teal-500/30 text-primary/90" : "bg-amber-500/10 border-amber-500/30 text-amber-300"}`}
                      >
                        {c.type.slice(0, 1)}
                      </div>
                      {i < plRecord.changeHistory.length - 1 && (
                        <div className="w-px flex-1 bg-muted mt-2" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-primary">{c.changeId}</span>
                        <span className="text-xs px-1.5 py-0.5 bg-secondary rounded text-muted-foreground">
                          {c.type}
                        </span>
                        <Badge variant={statusBadgeVariant(c.status)}>{c.status}</Badge>
                      </div>
                      <p className="text-sm font-medium text-foreground">{c.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {c.author} · {c.date}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No change history recorded for this PL record.
              </p>
            )}
          </GlassCard>
        )}

        {activeTab === "effectivity" && (
          <GlassCard className="p-3.5 hover:border-primary/20 transition-all duration-200">
            <h2 className="text-base font-bold text-white mb-4">Effectivity</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(plRecord.effectivity)
                .filter(([, v]) => v)
                .map(([key, value]) => (
                  <div key={key} className="bg-secondary/30 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1 capitalize">
                      {key.replace(/([A-Z])/g, " $1")}
                    </p>
                    <p className="text-sm font-medium text-foreground">{String(value)}</p>
                  </div>
                ))}
            </div>
          </GlassCard>
        )}
      </div>
    );
  }

  if (legacyPL) {
    return (
      <div className="space-y-6 max-w-[1200px] mx-auto">
        <button
          type="button"
          onClick={() => navigate("/pl")}
          className="flex items-center gap-2 text-muted-foreground hover:text-primary/90 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to PL Knowledge Hub
        </button>
        <div className="flex items-center gap-3 mb-2">
          <DatabaseBackup className="w-6 h-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-white">{legacyPL.title}</h1>
          <Badge
            variant={
              legacyPL.status === "Active"
                ? "success"
                : legacyPL.status === "Obsolete"
                  ? "danger"
                  : "warning"
            }
          >
            {legacyPL.status}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm font-mono">
          {legacyPL.id} · {legacyPL.lifecycle}
        </p>
        <GlassCard className="p-3.5 hover:border-primary/20 transition-all duration-200">
          <p className="text-foreground/90">{legacyPL.description}</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Owner</p>
              <p className="text-sm text-foreground">{legacyPL.owner}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Updated</p>
              <p className="text-sm text-foreground">{legacyPL.lastUpdated}</p>
            </div>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-[60vh]">
      <GlassCard className="p-6 text-center max-w-md hover:border-primary/20 transition-all duration-200">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">PL Record Not Found</h2>
        <p className="text-muted-foreground text-sm mb-4">
          No PL record with ID <span className="font-mono text-primary">{id}</span> exists.
        </p>
        <Button onClick={() => navigate("/pl")}>
          <ArrowLeft className="w-4 h-4" /> Back to PL Knowledge Hub
        </Button>
      </GlassCard>
    </div>
  );
}
