import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Briefcase,
  Check,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightIcon,
  Clock,
  Copy,
  Download,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Hash,
  Layers,
  Lock,
  Plus,
  Shield,
  TrendingUp,
  Unlock,
  Upload,
  User as UserIcon,
  X,
  ZapOff,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  DocumentPreviewButton,
  getDocumentContextAttributes,
} from "../components/documents/DocumentPreviewActions";
import { DatePicker } from "../components/ui/DatePicker";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { PLNumberSelect } from "../components/ui/PLNumberSelect";
import { Badge, Button, GlassCard, Input, Select } from "../components/ui/Shared";
import { TableSkeleton } from "../components/ui/TableSkeleton";
import { usePLItems } from "../hooks/usePLItems";
import { useWorkRecords } from "../hooks/useWorkRecords";
import { useAuth } from "../lib/auth";
import { CONCERNED_OFFICERS, SECTION_TYPES, WORK_TYPE_DEFINITIONS } from "../lib/constants";
import type { PLNumber, WorkCategory, WorkRecord } from "../lib/types";
import { ExportImportService } from "../services/ExportImportService";
import {
  checkDuplicates,
  getKPIStatus,
  getTargetDays,
  WorkLedgerService,
} from "../services/WorkLedgerService";

const STATUS_VARIANT: Record<
  WorkRecord["status"],
  "success" | "warning" | "danger" | "processing" | "default"
> = {
  OPEN: "default",
  SUBMITTED: "processing",
  VERIFIED: "success",
  CLOSED: "warning",
};

const STATUS_LABEL: Record<WorkRecord["status"], string> = {
  OPEN: "Open",
  SUBMITTED: "Pending Verification",
  VERIFIED: "Verified",
  CLOSED: "Closed",
};

const CATEGORY_LABEL: Record<WorkCategory, string> = {
  GENERAL: "General",
  DRAWING: "Drawing",
  SPECIFICATION: "Specification",
  TENDER: "Tender",
  SHOP: "Shop",
  IC: "IC",
  AMENDMENT: "Amendment",
  VENDOR: "Vendor",
  EXTERNAL: "External",
  FAILURE: "Failure",
  INSPECTION: "Inspection",
};

const WORK_CATEGORIES: WorkCategory[] = [
  "GENERAL",
  "DRAWING",
  "SPECIFICATION",
  "TENDER",
  "SHOP",
  "IC",
  "AMENDMENT",
  "VENDOR",
  "EXTERNAL",
  "FAILURE",
  "INSPECTION",
];

function KPIChip({ record }: { record: WorkRecord }) {
  const kpi = getKPIStatus(record);
  return <span className={`text-[10px] font-medium ${kpi.color}`}>{kpi.label}</span>;
}

function AnalyticsPanel({ records }: { records: WorkRecord[] }) {
  const [analytics, setAnalytics] = useState<Awaited<
    ReturnType<typeof WorkLedgerService.getAnalytics>
  > | null>(null);

  useEffect(() => {
    WorkLedgerService.getAnalytics().then(setAnalytics);
  }, [records.length]);

  if (!analytics) return null;

  const maxCategoryCount = Math.max(...analytics.byCategory.map((c) => c.count), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          By Category
        </h3>
        <div className="space-y-2">
          {analytics.byCategory
            .sort((a, b) => b.count - a.count)
            .map((c) => (
              <div key={c.category} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-28 text-right shrink-0">
                  {CATEGORY_LABEL[c.category as WorkCategory] ?? c.category}
                </span>
                <div className="flex-1 h-2 bg-secondary/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-400"
                    style={{ width: `${(c.count / maxCategoryCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-primary/90 font-mono w-4">{c.count}</span>
              </div>
            ))}
        </div>
      </div>
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Average Completion (days)
        </h3>
        <div className="space-y-2">
          {analytics.avgDaysByType.slice(0, 5).map((t) => (
            <div key={t.workType} className="flex items-center gap-3">
              <span
                className="text-xs text-muted-foreground w-36 truncate shrink-0"
                title={t.workType}
              >
                {t.workType}
              </span>
              <div className="flex-1 h-2 bg-secondary/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${t.avgDays <= t.targetDays ? "bg-emerald-500" : "bg-rose-500"}`}
                  style={{
                    width: `${Math.min(100, (t.avgDays / (t.targetDays * 1.5)) * 100)}%`,
                  }}
                />
              </div>
              <span
                className={`text-xs font-mono w-12 ${t.avgDays <= t.targetDays ? "text-emerald-400" : "text-rose-400"}`}
              >
                {t.avgDays}d / {t.targetDays}d
              </span>
            </div>
          ))}
          {analytics.avgDaysByType.length === 0 && (
            <p className="text-xs text-muted-foreground">No completed records yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface CreateFormData {
  workCategory: WorkCategory;
  workType: string;
  description: string;
  remarks: string;
  plNumber: string;
  tenderNumber: string;
  eOfficeNumber: string;
  sectionType: string;
  concernedOfficer: string;
  consentGiven: string;
  date: string;
  closingDate: string;
}

const EMPTY_FORM: CreateFormData = {
  workCategory: "GENERAL",
  workType: "",
  description: "",
  remarks: "",
  plNumber: "",
  tenderNumber: "",
  eOfficeNumber: "",
  sectionType: "General",
  concernedOfficer: "",
  consentGiven: "N/A",
  date: new Date().toISOString().split("T")[0],
  closingDate: "",
};

function calcDaysBetween(start: string, end: string): number | undefined {
  if (!start || !end) return undefined;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return undefined;
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
}

function PlLookupField({
  plItems,
  loading,
  value,
  onSelect,
}: {
  plItems: PLNumber[];
  loading: boolean;
  value: string;
  onSelect: (plNumber: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">Linked PL Number</label>
      <PLNumberSelect
        value={value}
        onChange={onSelect}
        plItems={plItems}
        loading={loading}
        placeholder="Search PL number or component name..."
        helperText="Search the current PL catalog and attach the work item to the correct PL record."
      />
    </div>
  );
}

function CreateWorkModal({
  onClose,
  onSave,
  existing,
  plItems,
  plItemsLoading,
  currentUser,
}: {
  onClose: () => void;
  onSave: (data: Omit<WorkRecord, "id" | "createdAt">) => Promise<WorkRecord>;
  existing: WorkRecord[];
  plItems: PLNumber[];
  plItemsLoading: boolean;
  currentUser: { id: string; name: string } | null;
}) {
  const [form, setForm] = useState<CreateFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<WorkRecord[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [allUsers, setAllUsers] = useState<
    { id: string; name: string; designation?: string; role?: string }[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load users for supervisor dropdown
  useEffect(() => {
    import("../services/UserService").then(({ UserService }) => {
      UserService.getAll().then((users) => {
        setAllUsers(
          users
            .filter((u) => u.isActive)
            .map((u) => ({
              id: u.id,
              name: u.name,
              designation: u.designation,
              role: u.role,
            })),
        );
      });
    });
  }, []);

  const typesForCategory = WORK_TYPE_DEFINITIONS.filter(
    (t) => t.category === form.workCategory && t.isActive,
  );
  const selectedTypeDef = WORK_TYPE_DEFINITIONS.find((t) => t.label === form.workType);
  const targetDays = selectedTypeDef?.disposalDays ?? 7;

  useEffect(() => {
    if (form.workType && form.eOfficeNumber) {
      const dupes = checkDuplicates(
        { workType: form.workType, eOfficeNumber: form.eOfficeNumber },
        existing,
      );
      setDuplicates(dupes);
    } else {
      setDuplicates([]);
    }
  }, [form.workType, form.eOfficeNumber, existing]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.workType) errs.workType = "Work Type is required";
    if (!form.description.trim()) errs.description = "Description is required";
    if (!form.eOfficeNumber.trim()) errs.eOfficeNumber = "e-Office Case No. is required";
    if (!form.date) errs.date = "Start date is required";
    if (!form.closingDate) errs.closingDate = "Closing date is required";
    if (form.date && form.closingDate && form.closingDate < form.date) {
      errs.closingDate = "Closing date cannot be before the start date";
    }
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    const autodays = calcDaysBetween(form.date, form.closingDate);
    try {
      const saved = await onSave({
        userId: currentUser?.id ?? "UNKNOWN",
        userName: currentUser?.name ?? "Unknown User",
        date: form.date,
        completionDate: form.closingDate,
        workCategory: form.workCategory,
        workType: form.workType,
        description: form.description,
        remarks: form.remarks || undefined,
        plNumber: form.plNumber || undefined,
        tenderNumber: form.tenderNumber || undefined,
        eOfficeNumber: form.eOfficeNumber || undefined,
        sectionType: form.sectionType,
        concernedOfficer: form.concernedOfficer || undefined,
        consentGiven: form.consentGiven,
        targetDays,
        status: "SUBMITTED",
        isLocked: false,
        closingDate: form.closingDate,
        daysTaken: autodays,
      } as Omit<WorkRecord, "id" | "createdAt">);
      toast.success("Work record logged", {
        description: `${saved.id} — ${form.workType}`,
      });
      onClose();
    } catch (err) {
      console.error("[WorkLedger] Failed to create record", err);
      toast.error("Failed to save work record");
    } finally {
      setSaving(false);
    }
  };

  const consentApplicable = selectedTypeDef?.consentApplicable ?? false;

  // Drag-and-drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    setAttachedFiles((prev) => [...prev, ...dropped]);
  };
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    setAttachedFiles((prev) => [...prev, ...picked]);
    e.target.value = "";
  };
  const removeFile = (idx: number) => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));

  const supervisorUsers = allUsers.filter((u) => u.role === "supervisor" || u.role === "admin");

  return createPortal(
    /* Floating overlay */
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal panel */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col bg-popover/95 border border-border/70 rounded-2xl shadow-2xl shadow-black/70 backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center">
              <Plus className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">Log Work Activity</h2>
              <p className="text-[11px] text-muted-foreground">
                Record a new work item with full audit trail
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 custom-scrollbar">
          {/* Duplicate warning */}
          {duplicates.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowDuplicates((v) => !v)}
                className="w-full flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs hover:bg-amber-500/15 transition-colors"
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">
                  Potential duplicate: {duplicates.length} similar record(s) found in last 30 days
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${showDuplicates ? "rotate-180" : ""}`}
                />
              </button>
              {showDuplicates &&
                duplicates.map((d) => (
                  <div
                    key={d.id}
                    className="mt-1 px-3 py-2 rounded-lg bg-secondary/40 border border-amber-500/20 text-xs"
                  >
                    <span className="font-mono text-primary">{d.id}</span> —{" "}
                    {d.description.substring(0, 80)}
                  </div>
                ))}
            </div>
          )}

          {/* Row 1: Work Category + Work Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Work Category *
              </label>
              <Select
                value={form.workCategory}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    workCategory: e.target.value as WorkCategory,
                    workType: "",
                  }))
                }
                className="w-full h-9 text-xs"
              >
                {WORK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Work Type *
              </label>
              <Select
                value={form.workType}
                onChange={(e) => setForm((f) => ({ ...f, workType: e.target.value }))}
                className={`w-full h-9 text-xs ${errors.workType ? "border-rose-500/50" : ""}`}
              >
                <option value="">— Select Type —</option>
                {typesForCategory.map((t) => (
                  <option key={t.code} value={t.label}>
                    {t.label}
                  </option>
                ))}
              </Select>
              {errors.workType && (
                <p className="text-[10px] text-rose-400 mt-1">{errors.workType}</p>
              )}
            </div>
          </div>

          {/* Target days banner */}
          {form.workType && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-500/8 border border-teal-500/20">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-primary/90">
                Target disposal: <strong>{targetDays} days</strong>
              </span>
              {selectedTypeDef?.priority && (
                <span
                  className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    selectedTypeDef.priority === "CRITICAL"
                      ? "bg-rose-500/20 text-rose-300"
                      : selectedTypeDef.priority === "HIGH"
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {selectedTypeDef.priority}
                </span>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Description / Work Details *
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe the work, item, and any relevant technical context..."
              rows={3}
              className={`w-full bg-background/80 text-foreground text-sm rounded-xl px-4 py-2.5 border focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 transition-all placeholder:text-muted-foreground resize-none ${errors.description ? "border-rose-500/50" : "border-border"}`}
            />
            {errors.description && (
              <p className="text-[10px] text-rose-400 mt-1">{errors.description}</p>
            )}
          </div>

          {/* Row 2: Tender + eOffice */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Tender Number
              </label>
              <Input
                value={form.tenderNumber}
                onChange={(e) => setForm((f) => ({ ...f, tenderNumber: e.target.value }))}
                placeholder="e.g. CLW/TENDER/2026/001"
                className="w-full h-9 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                e-Office Case No. <span className="text-rose-400">*</span>
              </label>
              <Input
                value={form.eOfficeNumber}
                onChange={(e) => setForm((f) => ({ ...f, eOfficeNumber: e.target.value }))}
                placeholder="e.g. CLW/DESIGN/2026/0001"
                className={`w-full h-9 font-mono text-xs ${errors.eOfficeNumber ? "border-rose-500/50" : ""}`}
              />
              {errors.eOfficeNumber && (
                <p className="text-[10px] text-rose-400 mt-1">{errors.eOfficeNumber}</p>
              )}
            </div>
          </div>

          {/* PL Number */}
          <PlLookupField
            plItems={plItems}
            loading={plItemsLoading}
            value={form.plNumber}
            onSelect={(plNumber) => setForm((f) => ({ ...f, plNumber }))}
          />

          {/* Row 3: Section + Supervisor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Section
              </label>
              <Select
                value={form.sectionType}
                onChange={(e) => setForm((f) => ({ ...f, sectionType: e.target.value }))}
                className="w-full h-9 text-xs"
              >
                {SECTION_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Concerned Supervisor
                <span className="ml-1 text-[9px] normal-case tracking-normal text-muted-foreground">
                  (from user list)
                </span>
              </label>
              <Select
                value={
                  form.remarks.startsWith("SUPERVISOR:")
                    ? (form.remarks.split("SUPERVISOR:")[1]?.split("|")[0] ?? "")
                    : ""
                }
                onChange={(e) => {
                  const sv = e.target.value;
                  setForm((f) => ({
                    ...f,
                    remarks: sv
                      ? `SUPERVISOR:${sv}|${f.remarks.replace(/^SUPERVISOR:[^|]*\|?/, "")}`
                      : f.remarks.replace(/^SUPERVISOR:[^|]*\|?/, ""),
                  }));
                }}
                className="w-full h-9 text-xs"
              >
                <option value="">— Select Supervisor —</option>
                {supervisorUsers.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name}
                    {u.designation ? ` — ${u.designation}` : ""}
                  </option>
                ))}
                {/* Fallback if no supervisor/admin users exist yet */}
                {supervisorUsers.length === 0 &&
                  allUsers.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name}
                      {u.designation ? ` — ${u.designation}` : ""}
                    </option>
                  ))}
              </Select>
            </div>
          </div>

          {/* Row 4: Concerned Officer + Consent */}
          <div className={`grid gap-3 ${consentApplicable ? "grid-cols-2" : "grid-cols-1"}`}>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Concerned Officer
                <span className="ml-1 text-[9px] normal-case tracking-normal text-muted-foreground">
                  (reference only)
                </span>
              </label>
              <Select
                value={form.concernedOfficer}
                onChange={(e) => setForm((f) => ({ ...f, concernedOfficer: e.target.value }))}
                className="w-full h-9 text-xs"
              >
                <option value="">— Select Officer —</option>
                {CONCERNED_OFFICERS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </div>
            {consentApplicable && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                  Consent Given
                </label>
                <Select
                  value={form.consentGiven}
                  onChange={(e) => setForm((f) => ({ ...f, consentGiven: e.target.value }))}
                  className="w-full h-9 text-xs"
                >
                  <option value="N/A">N/A</option>
                  <option value="Y">Yes</option>
                  <option value="N">No</option>
                </Select>
              </div>
            )}
          </div>

          {/* Row 5: Dates */}
          <div className="grid grid-cols-2 gap-3">
            <DatePicker
              label="Date Received / Started *"
              value={form.date}
              onChange={(v) => setForm((f) => ({ ...f, date: v }))}
              required
            />
            <DatePicker
              label="Closing / Completion Date *"
              value={form.closingDate}
              onChange={(v) => setForm((f) => ({ ...f, closingDate: v }))}
              minDate={form.date}
              required
            />
          </div>
          {(errors.date || errors.closingDate) && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 px-3 py-2 text-[11px] text-rose-300">
              {errors.date || errors.closingDate}
            </div>
          )}

          {/* Remarks */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Remarks / Additional Notes
            </label>
            <textarea
              value={form.remarks.replace(/^SUPERVISOR:[^|]*\|?/, "")}
              onChange={(e) => {
                const base = e.target.value;
                const svPrefix = form.remarks.match(/^SUPERVISOR:[^|]*\|/)?.[0] ?? "";
                setForm((f) => ({ ...f, remarks: svPrefix + base }));
              }}
              placeholder="Any additional remarks, observations, or context..."
              rows={2}
              className="w-full bg-background/80 border border-border text-foreground text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 transition-all placeholder:text-muted-foreground resize-none"
            />
          </div>

          {/* Document Attachment */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Related Documents
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-6 px-4 cursor-pointer transition-all ${
                isDragging
                  ? "border-teal-400/60 bg-teal-500/10 text-primary"
                  : "border-border/50 hover:border-teal-500/40 hover:bg-teal-500/5 text-muted-foreground"
              }`}
            >
              <Upload className="w-6 h-6 opacity-60" />
              <p className="text-xs font-medium">Drag & drop files here, or click to browse</p>
              <p className="text-[10px] opacity-60">PDF, DOCX, XLSX, images supported</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.tiff"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
            {attachedFiles.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {attachedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/40 border border-border/40"
                  >
                    <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="flex-1 text-xs text-foreground/90 truncate">{file.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(idx);
                      }}
                      className="text-muted-foreground hover:text-rose-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* end scrollable body */}

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-border/50 shrink-0 bg-background">
          {attachedFiles.length > 0 && (
            <span className="text-[11px] text-muted-foreground mr-auto">
              {attachedFiles.length} file{attachedFiles.length !== 1 ? "s" : ""} attached
            </span>
          )}
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="flex-1">
            {saving ? (
              "Saving..."
            ) : (
              <>
                <Plus className="w-4 h-4" /> Log Activity
              </>
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function RecordDetail({
  record,
  onVerify,
  onClose,
  canVerify,
}: {
  record: WorkRecord;
  onVerify: () => void;
  onClose: () => void;
  canVerify: boolean;
}) {
  const navigate = useNavigate();
  const kpi = getKPIStatus(record);

  return createPortal(
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal panel */}
      <div className="relative z-10 w-full max-w-xl max-h-[85vh] flex flex-col bg-popover/95 border border-border/70 rounded-2xl shadow-2xl shadow-black/70 backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center">
              {record.isLocked ? (
                <Lock className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Briefcase className="w-4 h-4 text-primary" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white leading-tight">Work Record Details</h2>
                <Badge variant={STATUS_VARIANT[record.status]}>{STATUS_LABEL[record.status]}</Badge>
              </div>
              <p className="text-[10px] font-mono text-primary mt-0.5">{record.id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 custom-scrollbar">
          {/* Description */}
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Description / Work Details
            </span>
            <p className="text-sm text-foreground font-medium bg-secondary/20 p-3.5 border border-border/30 rounded-xl leading-relaxed">
              {record.description}
            </p>
          </div>

          {/* Grid fields */}
          <div className="grid grid-cols-2 gap-4">
            {((): { label: string; value: string; icon?: React.ReactNode }[] => [
              {
                label: "Category",
                value: CATEGORY_LABEL[record.workCategory] ?? record.workCategory,
              },
              { label: "Type", value: record.workType },
              { label: "Assignee", value: record.userName },
              {
                label: "Section",
                value: record.userSection ?? record.sectionType ?? "—",
              },
              { label: "Date Started", value: record.date },
              {
                label: "Closing Date",
                value: record.closingDate ?? record.completionDate ?? "Pending",
                icon: <CheckSquare className="w-3 h-3 text-emerald-400" />,
              },
              {
                label: "Target Days",
                value: record.targetDays ? `${record.targetDays}d` : "—",
              },
              {
                label: "Days Taken",
                value:
                  record.daysTaken != null
                    ? `${record.daysTaken}d`
                    : record.closingDate
                      ? `${calcDaysBetween(record.date, record.closingDate) ?? "—"}d`
                      : "—",
              },
            ])().map((f) => (
              <div key={f.label} className="bg-secondary/10 border border-border/35 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
                  {f.icon}
                  {f.label}
                </p>
                <p className="text-xs text-foreground font-semibold truncate">{f.value}</p>
              </div>
            ))}
          </div>

          {/* KPI status */}
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl ${
              kpi.isOnTime
                ? "bg-emerald-500/8 border border-emerald-500/20"
                : "bg-rose-500/8 border border-rose-500/20"
            }`}
          >
            {kpi.isOnTime ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <ZapOff className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <div>
              <p className="text-[10px] text-muted-foreground leading-none mb-0.5">
                KPI SLA Status
              </p>
              <span className={`text-xs font-semibold ${kpi.color}`}>{kpi.label}</span>
            </div>
          </div>

          {/* References */}
          <div className="space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Reference Links
            </span>
            <div className="flex flex-wrap gap-2">
              {record.eOfficeNumber && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/50 border border-border/40 rounded-xl text-xs text-muted-foreground font-mono">
                  <Hash className="w-3.5 h-3.5 text-primary" /> {record.eOfficeNumber}
                </span>
              )}
              {record.plNumber && (
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/pl/${record.plNumber}`);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-xs text-indigo-300 hover:bg-indigo-500/15 transition-colors font-mono"
                >
                  <Layers className="w-3.5 h-3.5" /> {record.plNumber}
                </button>
              )}
              {record.documentRef && (
                <div
                  {...getDocumentContextAttributes(record.documentRef, record.documentRef)}
                  className="flex items-center gap-1.5 rounded-xl border border-teal-500/30 bg-teal-500/10 px-2 py-1"
                >
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/documents/${record.documentRef}`);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 text-xs text-primary/90 hover:bg-teal-500/15 transition-colors rounded-lg font-mono px-1 py-0.5"
                  >
                    <FileText className="w-3.5 h-3.5" /> {record.documentRef}
                  </button>
                  <DocumentPreviewButton
                    documentId={record.documentRef}
                    title={record.documentRef}
                    iconOnly
                    className="h-7 min-h-0 px-2 text-foreground hover:text-white"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Verification info */}
          {record.verifiedBy && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground leading-none mb-0.5">
                  Verification Log
                </p>
                <p className="text-xs text-emerald-300">
                  Verified by <strong>{record.verifiedBy}</strong> on {record.verificationDate}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-border/50 shrink-0 bg-background">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Close
          </Button>
          {!record.isLocked &&
            (record.status === "OPEN" || record.status === "SUBMITTED") &&
            canVerify && (
              <Button
                onClick={() => {
                  onVerify();
                  onClose();
                }}
                className="flex-1"
              >
                <CheckCircle className="w-4 h-4" /> Mark as Verified
              </Button>
            )}
        </div>
      </div>
    </div>
  );
}

export default function WorkLedger() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: records, loading, error, refetch, add, verify } = useWorkRecords();
  const { data: plItems, loading: plItemsLoading } = usePLItems();
  const { user, hasPermission } = useAuth();
  const canCreate = hasPermission(["admin", "supervisor", "engineer"]);
  const canVerify = hasPermission(["admin", "supervisor"]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<WorkRecord["status"] | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<WorkCategory | "ALL">("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showMine, setShowMine] = useState(false);
  const [showOverdue, setShowOverdue] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const copyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const filtered = useMemo(() => {
    return records.filter((w) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        w.id.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        (w.userName ?? "").toLowerCase().includes(q) ||
        (w.plNumber ?? "").toLowerCase().includes(q) ||
        (w.workType ?? "").toLowerCase().includes(q) ||
        (w.eOfficeNumber ?? "").toLowerCase().includes(q) ||
        (w.tenderNumber ?? "").toLowerCase().includes(q) ||
        (w.concernedOfficer ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "ALL" || w.status === statusFilter;
      const matchCategory = categoryFilter === "ALL" || w.workCategory === categoryFilter;
      const matchDateFrom = !dateFrom || w.date >= dateFrom;
      const matchDateTo = !dateTo || w.date <= dateTo;
      const matchMine = !showMine || w.userId === user?.id || w.userName === user?.name;
      const matchOverdue =
        !showOverdue ||
        (() => {
          if (w.status === "VERIFIED" || w.status === "CLOSED") return false;
          const kpi = getKPIStatus(w);
          return !kpi.isOnTime;
        })();
      return (
        matchSearch &&
        matchStatus &&
        matchCategory &&
        matchDateFrom &&
        matchDateTo &&
        matchMine &&
        matchOverdue
      );
    });
  }, [
    records,
    search,
    statusFilter,
    categoryFilter,
    dateFrom,
    dateTo,
    showMine,
    showOverdue,
    user,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, categoryFilter, dateFrom, dateTo, showMine, showOverdue]);

  const stats = useMemo(() => {
    const _today = new Date().toISOString().split("T")[0];
    const overdueCount = records.filter((w) => {
      if (w.status === "VERIFIED" || w.status === "CLOSED") return false;
      const kpi = getKPIStatus(w);
      return !kpi.isOnTime;
    }).length;
    const completed = records.filter((w) => w.status === "VERIFIED" || w.status === "CLOSED");
    const onTime = completed.filter(
      (w) => (w.daysTaken ?? 0) <= (w.targetDays ?? getTargetDays(w.workType)),
    );
    const onTimeRate =
      completed.length > 0 ? Math.round((onTime.length / completed.length) * 100) : 0;
    return {
      total: records.length,
      open: records.filter((w) => w.status === "OPEN").length,
      overdue: overdueCount,
      onTimeRate,
    };
  }, [records]);

  const selectedRecord = records.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    const requestedId = searchParams.get("id");
    if (!requestedId) {
      return;
    }
    const match = records.find((record) => record.id === requestedId) ?? null;
    if (match) {
      setSelectedId(match.id);
    }
  }, [records, searchParams]);

  const openRecord = (recordId: string | null) => {
    setSelectedId(recordId);
    const next = new URLSearchParams(searchParams);
    if (recordId) {
      next.set("id", recordId);
    } else {
      next.delete("id");
    }
    setSearchParams(next, { replace: true });
  };

  const handleVerify = async (id: string) => {
    try {
      await verify(id, user?.name ?? "Admin");
      toast.success("Record verified and locked");
    } catch (err) {
      console.error("[WorkLedger] Verification failed", err);
      toast.error("Failed to verify record");
    }
  };

  const handleCreate = async (data: Omit<WorkRecord, "id" | "createdAt">) => {
    return await add(data);
  };

  if (error)
    return <ErrorState variant="server" message="Failed to load work records" onRetry={refetch} />;

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">Work Ledger</h1>
          <p className="text-muted-foreground text-sm">
            Track and manage engineering work records with immutable audit history.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={() => setShowAnalytics((v) => !v)}>
            <BarChart3 className="w-4 h-4" /> {showAnalytics ? "Hide" : "Analytics"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => ExportImportService.downloadWorkRecordsCSV(filtered)}
            title="Export CSV"
          >
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => ExportImportService.exportWorkRecordsExcel(filtered)}
            title="Export Excel"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </Button>
          {canCreate && (
            <Button variant="secondary" size="sm" onClick={() => setShowImportModal(true)}>
              <Upload className="w-4 h-4" /> Import
            </Button>
          )}
          {canCreate && (
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              <Plus className="w-4 h-4" /> {showForm ? "Cancel" : "Log Work Activity"}
            </Button>
          )}
        </div>
      </div>

      {/* Inline Log Form */}
      {showForm && canCreate && (
        <CreateWorkModal
          onClose={() => setShowForm(false)}
          onSave={handleCreate}
          existing={records}
          plItems={plItems}
          plItemsLoading={plItemsLoading}
          currentUser={user ? { id: user.id, name: user.name } : null}
        />
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total Records",
            value: stats.total,
            icon: <Briefcase className="w-4 h-4 text-primary" />,
            color: "",
          },
          {
            label: "Open Items",
            value: stats.open,
            icon: <Clock className="w-4 h-4 text-blue-400" />,
            color: "",
          },
          {
            label: "Overdue",
            value: stats.overdue,
            icon: <AlertCircle className="w-4 h-4 text-rose-400" />,
            color: stats.overdue > 0 ? "border-rose-500/20" : "",
          },
          {
            label: "On-time Rate",
            value: `${stats.onTimeRate}%`,
            icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
            color: "",
          },
        ].map((s) => (
          <GlassCard
            key={s.label}
            className={`px-4 py-3 flex items-center gap-3 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 transition-all duration-200 ${s.color}`}
          >
            <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
              {s.icon}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {s.label}
              </p>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Analytics Panel */}
      {showAnalytics && (
        <GlassCard className="p-3.5 hover:border-primary/20 transition-all duration-200">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Work Ledger Analytics
          </h2>
          <AnalyticsPanel records={records} />
        </GlassCard>
      )}

      {/* Main Table Card */}
      <GlassCard className="p-3.5 hover:border-primary/20 transition-all duration-200">
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <FileSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search ID, description, type, PL, eOffice, tender, officer..."
              className="pl-9 w-full h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(["ALL", "OPEN", "SUBMITTED", "VERIFIED", "CLOSED"] as const).map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 h-9 rounded-md text-xs font-medium border transition-colors ${statusFilter === s ? "bg-teal-500/20 border-teal-500/40 text-primary/90" : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"}`}
              >
                {s === "ALL" ? "All" : STATUS_LABEL[s as WorkRecord["status"]]}
              </button>
            ))}
          </div>
        </div>
        {/* Date range filter */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
            Date:
          </span>
          <div className="flex items-center gap-1.5">
            <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="From date" />
            <span className="text-muted-foreground text-xs">—</span>
            <DatePicker value={dateTo} onChange={setDateTo} placeholder="To date" />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                className="text-[10px] text-muted-foreground hover:text-primary transition-colors px-1.5"
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {/* Category filter row */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            type="button"
            onClick={() => setCategoryFilter("ALL")}
            className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${categoryFilter === "ALL" ? "bg-teal-500/20 border-teal-500/40 text-primary/90" : "bg-secondary/40 border-border/40 text-muted-foreground hover:text-foreground/90"}`}
          >
            All Categories
          </button>
          {WORK_CATEGORIES.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${categoryFilter === c ? "bg-teal-500/20 border-teal-500/40 text-primary/90" : "bg-secondary/40 border-border/40 text-muted-foreground hover:text-foreground/90"}`}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
            Quick:
          </span>
          <button
            type="button"
            onClick={() => setShowMine((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${showMine ? "bg-teal-500/20 border-teal-500/40 text-primary/90" : "bg-secondary/40 border-border/40 text-muted-foreground hover:text-foreground/90"}`}
          >
            <UserIcon className="w-3 h-3" /> My Records
          </button>
          <button
            type="button"
            onClick={() => setShowOverdue((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${showOverdue ? "bg-rose-500/20 border-rose-500/40 text-rose-300" : "bg-secondary/40 border-border/40 text-muted-foreground hover:text-foreground/90"}`}
          >
            <AlertCircle className="w-3 h-3" /> Overdue
          </button>
          {(showMine || showOverdue) && (
            <button
              type="button"
              onClick={() => {
                setShowMine(false);
                setShowOverdue(false);
              }}
              className="text-[11px] text-muted-foreground hover:text-muted-foreground transition-colors"
            >
              ✕ Clear
            </button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            Showing <span className="text-primary font-semibold">{filtered.length}</span> of{" "}
            {records.length} records
            {totalPages > 1 && (
              <>
                {" "}
                · Page{" "}
                <span className="text-primary font-semibold tabular-nums">
                  {page}/{totalPages}
                </span>
              </>
            )}
          </span>
        </div>

        {loading ? (
          <TableSkeleton columns={10} rows={8} className="my-2" />
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-3 pl-3 font-semibold text-[11px] uppercase tracking-wide">
                    Work ID
                  </th>
                  <th className="pb-3 font-semibold text-[11px] uppercase tracking-wide">
                    Description
                  </th>
                  <th className="pb-3 font-semibold text-[11px] uppercase tracking-wide">
                    Category / Type
                  </th>
                  <th className="pb-3 font-semibold text-[11px] uppercase tracking-wide">
                    PL / eOffice
                  </th>
                  <th className="pb-3 font-semibold text-[11px] uppercase tracking-wide">Status</th>
                  <th className="pb-3 font-semibold text-[11px] uppercase tracking-wide">KPI</th>
                  <th className="pb-3 font-semibold text-[11px] uppercase tracking-wide">
                    Days / Target
                  </th>
                  <th className="pb-3 font-semibold text-[11px] uppercase tracking-wide">
                    Officer
                  </th>
                  <th className="pb-3 font-semibold text-[11px] uppercase tracking-wide">Date</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {paginated.map((w) => (
                  <tr
                    key={w.id}
                    className={`cursor-pointer transition-colors group ${selectedId === w.id ? "bg-teal-500/5 border-l-2 border-teal-500/30" : "hover:bg-secondary/30"}`}
                    onClick={() => openRecord(selectedId === w.id ? null : w.id)}
                  >
                    <td className="py-3 pl-3">
                      <div className="flex items-center gap-1.5">
                        {w.isLocked ? (
                          <Lock className="w-3 h-3 text-muted-foreground" />
                        ) : (
                          <Unlock className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span className="font-mono text-primary text-xs">{w.id}</span>
                        <button
                          type="button"
                          onClick={(e) => copyId(w.id, e)}
                          title="Copy ID"
                          className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 text-muted-foreground hover:text-primary"
                        >
                          {copiedId === w.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 max-w-[240px]">
                      <p className="text-foreground font-medium text-sm truncate">
                        {w.description}
                      </p>
                    </td>
                    <td className="py-3">
                      <p className="text-xs text-muted-foreground">
                        {CATEGORY_LABEL[w.workCategory]}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{w.workType}</p>
                    </td>
                    <td className="py-3">
                      {w.plNumber && (
                        <p className="font-mono text-[11px] text-primary/80 leading-tight">
                          {w.plNumber}
                        </p>
                      )}
                      {w.eOfficeNumber && (
                        <p className="font-mono text-[10px] text-muted-foreground leading-tight">
                          {w.eOfficeNumber}
                        </p>
                      )}
                      {!w.plNumber && !w.eOfficeNumber && (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      <Badge variant={STATUS_VARIANT[w.status]}>{STATUS_LABEL[w.status]}</Badge>
                    </td>
                    <td className="py-3">
                      <KPIChip record={w} />
                    </td>
                    <td className="py-3 text-xs font-mono">
                      {w.daysTaken != null ? (
                        <span
                          className={
                            w.targetDays && w.daysTaken > w.targetDays
                              ? "text-rose-400"
                              : "text-emerald-400"
                          }
                        >
                          {w.daysTaken}d
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {w.targetDays != null && (
                        <span className="text-muted-foreground"> / {w.targetDays}d</span>
                      )}
                    </td>
                    <td className="py-3 text-muted-foreground text-xs truncate max-w-[100px]">
                      {w.concernedOfficer || w.userName || "—"}
                    </td>
                    <td className="py-3 text-muted-foreground text-xs">{w.date}</td>
                    <td className="py-3 pr-3">
                      <ChevronRight
                        className={`w-4 h-4 transition-all ${selectedId === w.id ? "rotate-90 text-primary" : "text-muted-foreground group-hover:text-primary"}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <EmptyState
                icon={Briefcase}
                title="No work records found"
                description="Try adjusting the search or category filter"
                action={
                  canCreate && (
                    <Button size="sm" onClick={() => setShowForm(true)}>
                      <Plus className="w-3.5 h-3.5" /> Create First Record
                    </Button>
                  )
                }
              />
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of{" "}
              {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-7 h-7 rounded-lg bg-secondary/50 border border-border text-muted-foreground hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const p =
                  totalPages <= 7 ? i + 1 : i + Math.max(1, Math.min(page - 3, totalPages - 6));
                return (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${p === page ? "bg-teal-500/20 border border-teal-500/40 text-primary/90" : "bg-secondary/50 border border-border text-muted-foreground hover:text-white"}`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-7 h-7 rounded-lg bg-secondary/50 border border-border text-muted-foreground hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <GlassCard className="w-full max-w-2xl p-4 relative hover:border-primary/20 transition-all duration-200">
            <button
              type="button"
              onClick={() => {
                setShowImportModal(false);
                setImportFile(null);
                setImportPreview([]);
              }}
              className="absolute top-4 right-4"
            >
              <X className="w-4 h-4 text-muted-foreground hover:text-white" />
            </button>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center">
                <Upload className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Import Work Records</h3>
                <p className="text-xs text-muted-foreground">
                  Upload a CSV or Excel file with work records
                </p>
              </div>
            </div>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setImportFile(file);
                try {
                  const rows = await ExportImportService.parseCSVFile(file);
                  setImportPreview(rows.slice(0, 5));
                } catch {
                  toast.error("Could not parse file");
                }
              }}
            />
            {!importFile ? (
              <div
                onClick={() => importInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-teal-500/40 transition-colors"
              >
                <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-1">
                  Click to upload CSV or Excel file
                </p>
                <p className="text-xs text-muted-foreground">Supported: .csv, .xlsx, .xls</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-foreground/90">{importFile.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setImportFile(null);
                      setImportPreview([]);
                    }}
                    className="text-xs text-muted-foreground hover:text-rose-400"
                  >
                    Remove
                  </button>
                </div>
                {importPreview.length > 0 && (
                  <div className="overflow-x-auto mb-4">
                    <p className="text-xs text-muted-foreground mb-2">
                      Preview (first {importPreview.length} rows):
                    </p>
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr>
                          {Object.keys(importPreview[0])
                            .slice(0, 6)
                            .map((h) => (
                              <th
                                key={h}
                                className="py-1 pr-4 text-muted-foreground font-medium uppercase text-[10px]"
                              >
                                {h}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((row, i) => (
                          <tr key={i} className="border-t border-border">
                            {Object.values(row)
                              .slice(0, 6)
                              .map((v, j) => (
                                <td
                                  key={j}
                                  className="py-1.5 pr-4 text-muted-foreground truncate max-w-[120px]"
                                >
                                  {String(v)}
                                </td>
                              ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-3 mt-5">
              <Button
                size="sm"
                disabled={!importFile || importing}
                onClick={async () => {
                  if (!importFile) return;
                  setImporting(true);
                  try {
                    const rows = await ExportImportService.parseCSVFile(importFile);
                    let count = 0;
                    for (const row of rows) {
                      const data = ExportImportService.mapRowToWorkRecord(
                        row,
                        user?.id ?? "",
                        user?.name ?? "",
                      );
                      if (data.description) {
                        await add(data as Omit<WorkRecord, "id" | "createdAt">);
                        count++;
                      }
                    }
                    toast.success(`Imported ${count} work records`);
                    setShowImportModal(false);
                    setImportFile(null);
                    setImportPreview([]);
                  } catch {
                    toast.error("Import failed");
                  } finally {
                    setImporting(false);
                  }
                }}
              >
                {importing
                  ? "Importing..."
                  : `Import${importPreview.length ? ` (~${importPreview.length}+ rows)` : ""}`}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  ExportImportService.downloadBlob(
                    ExportImportService.getImportTemplate(),
                    "work-records-template.xlsx",
                  );
                }}
              >
                <Download className="w-3.5 h-3.5" /> Download Template
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportPreview([]);
                }}
              >
                Cancel
              </Button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Record Detail */}
      {selectedRecord && (
        <RecordDetail
          record={selectedRecord}
          onVerify={() => handleVerify(selectedRecord.id)}
          onClose={() => openRecord(null)}
          canVerify={canVerify}
        />
      )}
    </div>
  );
}
