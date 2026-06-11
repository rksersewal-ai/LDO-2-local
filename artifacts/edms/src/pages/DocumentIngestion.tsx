import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  File,
  FileImage,
  FileText,
  GitBranch,
  Hash,
  Loader2,
  Scan,
  ToggleRight,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { PLNumberSelect } from "../components/ui/PLNumberSelect";
import { Button, GlassCard, Input, PageHeader, Select } from "../components/ui/Shared";
import { Switch } from "../components/ui/switch";
import { usePLItems } from "../hooks/usePLItems";
import apiClient from "../services/ApiClient";

const DOC_TYPES = [
  "Drawing",
  "Specification",
  "Test Report",
  "Certificate",
  "Procedure",
  "CAD Model",
  "Datasheet",
] as const;
const CATEGORIES = [
  "Electrical Schema",
  "Specification",
  "CAD Output",
  "Test Report",
  "Certificate",
  "Calibration Log",
  "Procedure",
  "Maintenance Manual",
  "Financial / Yield",
] as const;

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

interface TemplateDraftState {
  templateId: string;
  templateName: string;
  templateCategory: string;
  templateDescription: string;
  docTypeHint: string;
  categoryHint: string;
  tags: string[];
  formValues: Record<string, string>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIconColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["pdf"].includes(ext || "")) return "text-rose-400";
  if (["png", "jpg", "jpeg", "svg"].includes(ext || "")) return "text-purple-400";
  if (["xlsx", "xls", "csv"].includes(ext || "")) return "text-green-400";
  if (["docx", "doc"].includes(ext || "")) return "text-blue-400";
  if (["dwg", "dxf"].includes(ext || "")) return "text-amber-400";
  return "text-primary";
}

function FileIcon({ name, className = "w-5 h-5" }: { name: string; className?: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "svg"].includes(ext || "")) return <FileImage className={className} />;
  if (["xlsx", "xls", "csv", "docx", "doc"].includes(ext || ""))
    return <File className={className} />;
  return <FileText className={className} />;
}

export default function DocumentIngestion() {
  const navigate = useNavigate();
  const location = useLocation();
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: plItems, loading: plItemsLoading } = usePLItems();

  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [templateDraft, setTemplateDraft] = useState<TemplateDraftState | null>(() => {
    const state = location.state as {
      templateDraft?: TemplateDraftState;
    } | null;
    return state?.templateDraft ?? null;
  });

  // Form state
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState<string>("");
  const [revision, setRevision] = useState("");
  const [category, setCategory] = useState<string>("");
  const [plNumber, setPlNumber] = useState("");
  const [ocrEnabled, setOcrEnabled] = useState(true);

  useEffect(() => {
    if (!templateDraft) {
      return;
    }

    setDocName((current) => current || templateDraft.templateName);
    setCategory((current) => current || templateDraft.categoryHint || "");
    setDocType((current) => current || templateDraft.docTypeHint || "");
    setRevision((current) => current || "A.0");
  }, [templateDraft]);

  const handleFileDrop = useCallback(
    (file: File) => {
      if (file.size > 50 * 1024 * 1024) {
        toast.error("File too large. Maximum 50 MB allowed.");
        return;
      }
      setSelectedFile(file);
      setUploadedFile({
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
      });
      if (!docName) {
        setDocName(file.name.replace(/\.[^.]+$/, ""));
      }
      const ext = file.name.split(".").pop()?.toUpperCase() ?? "";
      if (!docType) {
        if (["PDF", "DOCX"].includes(ext)) setDocType("Specification");
        if (["PNG", "JPG", "SVG", "DWG"].includes(ext)) setDocType("Drawing");
        if (["XLSX", "CSV"].includes(ext)) setDocType("Datasheet");
      }
    },
    [docName, docType],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDraggingOver(false), []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileDrop(file);
    },
    [handleFileDrop],
  );

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileDrop(file);
    },
    [handleFileDrop],
  );

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!selectedFile || !uploadedFile) errs.file = "Please select a file to upload";
    if (!docName.trim()) errs.docName = "Document name is required";
    if (!docType) errs.docType = "Please select a document type";
    if (!revision.trim()) errs.revision = "Revision is required (e.g. A.0)";
    if (!category) errs.category = "Please select a category";
    if (plNumber && !/^\d{8}$/.test(plNumber.trim())) {
      errs.plNumber = "PL number must be exactly 8 digits";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    if (!selectedFile) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("name", docName.trim());
      formData.append("category", category);
      formData.append("doc_type", docType);
      formData.append("revision_label", revision.trim());
      formData.append("ocr_requested", String(ocrEnabled));
      formData.append("source_system", "UPLOAD");
      if (plNumber) {
        formData.append("linked_pl", plNumber);
      }
      const description = templateDraft?.templateDescription?.trim();
      if (description) {
        formData.append("description", description);
      }
      const tags = Array.from(
        new Set([docType, category, ...(templateDraft?.tags ?? [])].filter(Boolean)),
      );
      formData.append("tags", JSON.stringify(tags));
      if (templateDraft?.templateId) {
        formData.append("template_id", templateDraft.templateId);
      }
      if (templateDraft?.formValues) {
        formData.append("template_fields", JSON.stringify(templateDraft.formValues));
      }

      const result = await apiClient.ingestDocument(formData);
      const createdDocument = (result as Record<string, unknown>)?.document as
        | { id?: string }
        | undefined;
      toast.success(`Document "${docName}" ingested successfully`, {
        description: ocrEnabled
          ? "Indexing started and OCR processing was queued."
          : "Indexing started successfully.",
      });
      if (createdDocument?.id) {
        navigate(`/documents/${createdDocument.id}/preview`);
        return;
      }
      navigate("/documents");
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        "Document ingest failed. Please review the form and try again.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const ext = uploadedFile ? (uploadedFile.name.split(".").pop()?.toUpperCase() ?? "") : "";

  return (
    <div className="space-y-5 max-w-[1200px] mx-auto">
      <PageHeader
        title="Ingest Document"
        subtitle="Upload a document, set metadata, link to a PL record, and optionally trigger OCR"
        breadcrumb={
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => navigate("/documents")}
              className="hover:text-primary transition-colors flex items-center gap-1"
            >
              <FileText className="w-3 h-3" /> Document Hub
            </button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground/90">Ingest Document</span>
          </nav>
        }
        actions={
          <Button variant="secondary" size="sm" onClick={() => navigate("/documents")}>
            <ArrowLeft className="w-3.5 h-3.5" /> Cancel
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5">
        {/* Left: File upload zone */}
        <div className="space-y-4">
          {templateDraft && (
            <GlassCard className="p-4 border-teal-500/20 bg-teal-500/10 backdrop-blur-md shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary/90 mb-1">
                    Template Context
                  </p>
                  <h3 className="text-sm font-semibold text-foreground">
                    {templateDraft.templateName}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {templateDraft.templateCategory} template values will stay attached while you
                    complete ingestion.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground max-w-2xl">
                    {templateDraft.templateDescription}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setTemplateDraft(null)}>
                  <X className="w-3.5 h-3.5" /> Clear
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {Object.entries(templateDraft.formValues).map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-border/50 bg-background/40 backdrop-blur-sm px-3 py-2"
                  >
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {label}
                    </p>
                    <p className="text-xs text-foreground mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {templateDraft.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-teal-500/20 bg-teal-500/10 px-2 py-0.5 text-[10px] font-medium text-teal-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </GlassCard>
          )}

          <GlassCard className="p-4 bg-card/40 border-border/50 backdrop-blur-md rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40">
            <h2 className="text-sm font-semibold text-foreground/90 mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" /> File Upload
            </h2>

            {/* Drop zone */}
            <div
              ref={dropRef}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => !uploadedFile && fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl transition-all duration-200 ${
                isDraggingOver
                  ? "border-teal-400/70 bg-teal-500/10"
                  : uploadedFile
                    ? "border-teal-500/30 bg-teal-500/5"
                    : "border-border/50 hover:border-teal-500/40 hover:bg-teal-500/5 cursor-pointer"
              }`}
            >
              <input ref={fileInputRef} type="file" className="hidden" onChange={onFileInput} />

              <AnimatePresence mode="wait">
                {!uploadedFile ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-14 flex flex-col items-center text-center px-6"
                  >
                    <div
                      className={`w-14 h-14 rounded-2xl border flex items-center justify-center mb-4 transition-all ${isDraggingOver ? "bg-teal-500/20 border-teal-400/50" : "bg-background/40 border-border/50"}`}
                    >
                      <Upload
                        className={`w-6 h-6 ${isDraggingOver ? "text-primary" : "text-muted-foreground"}`}
                      />
                    </div>
                    <p className="text-sm font-medium text-foreground/90 mb-1">
                      {isDraggingOver ? "Drop to upload" : "Drag & drop your file here"}
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      or click to browse your computer
                    </p>
                    <div className="flex flex-wrap gap-1.5 justify-center mb-3">
                      {["PDF", "DOCX", "PNG", "JPG", "XLSX", "DWG", "DXF"].map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 bg-background/40 border border-border/50 rounded-md text-[10px] font-mono text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">Maximum file size: 50 MB</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="file"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-4 flex items-center gap-4"
                  >
                    <div
                      className={`w-12 h-12 rounded-xl bg-card border border-border flex flex-col items-center justify-center gap-0.5 shrink-0 ${getFileIconColor(uploadedFile.name)}`}
                    >
                      <FileIcon name={uploadedFile.name} className="w-5 h-5" />
                      <span className="text-[8px] font-mono font-bold">{ext}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {uploadedFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(uploadedFile.size)} · {ext} file
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <CheckCircle2 className="w-3 h-3 text-primary" />
                        <span className="text-xs text-primary">Ready to ingest</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadedFile(null);
                        setSelectedFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      className="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {errors.file && (
              <p className="flex items-center gap-1.5 text-xs text-rose-400 mt-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.file}
              </p>
            )}

            {/* Supported formats info */}
            <div className="mt-4 p-3 bg-background/40 rounded-xl border border-border/50">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Supported Document Types
              </p>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                {[
                  ["Engineering Drawings", "PDF, DWG, DXF"],
                  ["Specifications", "PDF, DOCX"],
                  ["Test Reports", "PDF"],
                  ["CAD Models", "STP, IGES"],
                  ["Images & Renders", "PNG, JPG, SVG"],
                  ["Data / Reports", "XLSX, CSV"],
                ].map(([type, fmts]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{type}</span>
                    <span className="font-mono text-muted-foreground">{fmts}</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Right: Metadata form */}
        <GlassCard className="p-4 bg-card/40 border-border/50 backdrop-blur-md rounded-xl">
          <h2 className="text-sm font-semibold text-foreground/90 mb-5 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-primary" /> Document Metadata
          </h2>

          <div className="space-y-4">
            {/* Document Name */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Document Name <span className="text-rose-400">*</span>
              </label>
              <Input
                placeholder="e.g. Bogie Frame Stress Analysis Report"
                value={docName}
                onChange={(e) => {
                  setDocName(e.target.value);
                  setErrors((p) => ({ ...p, docName: "" }));
                }}
                className="w-full h-9"
              />
              {errors.docName && (
                <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.docName}
                </p>
              )}
            </div>

            {/* Type + Revision row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Document Type <span className="text-rose-400">*</span>
                </label>
                <Select
                  value={docType}
                  onChange={(e) => {
                    setDocType(e.target.value);
                    setErrors((p) => ({ ...p, docType: "" }));
                  }}
                  className="w-full h-9"
                >
                  <option value="">Select type...</option>
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
                {errors.docType && (
                  <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.docType}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Revision <span className="text-rose-400">*</span>
                </label>
                <Input
                  placeholder="A.0"
                  value={revision}
                  onChange={(e) => {
                    setRevision(e.target.value);
                    setErrors((p) => ({ ...p, revision: "" }));
                  }}
                  className="w-full h-9 font-mono"
                />
                {errors.revision && (
                  <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.revision}
                  </p>
                )}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Category <span className="text-rose-400">*</span>
              </label>
              <Select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setErrors((p) => ({ ...p, category: "" }));
                }}
                className="w-full h-9"
              >
                <option value="">Select category...</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              {errors.category && (
                <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.category}
                </p>
              )}
            </div>

            {/* PL Number */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Hash className="w-3 h-3 text-primary" /> Link to PL Number
                </span>
              </label>
              <PLNumberSelect
                value={plNumber}
                onChange={(next) => {
                  setPlNumber(next);
                  setErrors((p) => ({ ...p, plNumber: "" }));
                }}
                plItems={plItems}
                loading={plItemsLoading}
                placeholder="Search and select a linked PL..."
                helperText="Link the uploaded document to an existing PL record when the file belongs to a controlled component or assembly."
              />
              {errors.plNumber && (
                <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.plNumber}
                </p>
              )}
            </div>

            {/* OCR toggle */}
            <div className="p-3 bg-background/40 rounded-xl border border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scan className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-xs font-semibold text-foreground/90">
                      Initiate OCR Processing
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Extract text and metadata from document
                    </p>
                  </div>
                </div>
                <Switch
                  checked={ocrEnabled}
                  onCheckedChange={setOcrEnabled}
                  aria-label="Toggle OCR processing"
                />
              </div>
              {ocrEnabled && (
                <div className="mt-2.5 pt-2.5 border-t border-border/50 flex items-center gap-1.5 text-[11px] text-primary">
                  <ToggleRight className="w-3 h-3" />
                  OCR will begin immediately after upload
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="pt-2 space-y-2">
              <Button
                className="w-full py-2.5 h-9 flex items-center justify-center"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Ingesting Document...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" /> Ingest Document
                  </>
                )}
              </Button>
              <p className="text-[10px] text-center text-muted-foreground">
                Document will be set to <span className="text-amber-400">In Review</span> status
                after ingestion
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Status indicators */}
      <GlassCard className="p-3.5 bg-card/40 border-border/50 backdrop-blur-md rounded-xl">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Ingestion Checklist
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "File Selected", done: !!uploadedFile },
            { label: "Name & Type Set", done: !!(docName && docType) },
            { label: "Revision Specified", done: !!revision },
            { label: "Category Chosen", done: !!category },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              {item.done ? (
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-muted shrink-0" />
              )}
              <span
                className={`text-xs ${item.done ? "text-primary/90" : "text-muted-foreground"}`}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
