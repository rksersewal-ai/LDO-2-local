import {
  ArrowLeft,
  Boxes,
  BrainCircuit,
  Check,
  Download,
  ExternalLink,
  FileCode2,
  FileImage,
  FileText,
  Fingerprint,
  Loader2,
  Minimize2,
  MoreHorizontal,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Tag,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Badge, Button, GlassCard } from "../components/ui/Shared";
import { MOCK_DOCUMENTS } from "../lib/mock";
import type { DocumentMetadataAssertion, DocumentOcrEntity } from "../lib/types";
import apiClient from "../services/ApiClient";
import { DocumentPreviewService } from "../services/DocumentPreviewService";
import { NavigationHistoryService } from "../services/NavigationHistoryService";

interface PreviewDocumentRecord {
  id: string;
  title: string;
  status: string;
  revision: string;
  fileType: string;
  size: string;
  linkedPl: string;
  description: string;
  updatedAt: string;
  fileUrl?: string;
  tags: string[];
  ocrStatus?: string;
  ocrConfidence?: number | null;
  duplicateStatus?: string;
  duplicateGroupKey?: string;
  sourceSystem?: string;
  hashIndexedAt?: string;
  searchIndexedAt?: string;
  fingerprintPresent?: boolean;
}

function formatBytes(size?: number | string | null) {
  const bytes = typeof size === "number" ? size : Number(size || 0);
  if (!bytes || Number.isNaN(bytes)) {
    return "Unknown size";
  }
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function resolveFileUrl(value?: string | null) {
  if (!value) {
    return "";
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  if (value.startsWith("/media/")) {
    const apiBase = import.meta.env.VITE_API_BASE_URL || "/api";
    if (/^https?:\/\//i.test(apiBase)) {
      return new URL(value, apiBase).toString();
    }
    return `http://127.0.0.1:8420${value}`;
  }
  return value;
}

function mapBackendDocument(raw: any): PreviewDocumentRecord {
  return {
    id: raw.id,
    title: raw.title || raw.name || raw.id,
    status: raw.status || "Unknown",
    revision: String(raw.revision_label || (raw.revision ?? "1")),
    fileType: raw.file_type || raw.type || "Unknown",
    size: formatBytes(raw.size),
    linkedPl: raw.linked_pl || "Unlinked",
    description: raw.description || "No description available.",
    updatedAt: raw.updated_at || raw.created_at || "",
    fileUrl: resolveFileUrl(typeof raw.file === "string" ? raw.file : ""),
    tags: Array.isArray(raw.tags) ? raw.tags.map((value: unknown) => String(value)) : [],
    ocrStatus: raw.ocr_status || undefined,
    ocrConfidence: typeof raw.ocr_confidence === "number" ? raw.ocr_confidence : null,
    duplicateStatus: raw.duplicate_status || undefined,
    duplicateGroupKey: raw.duplicate_group_key || undefined,
    sourceSystem: raw.source_system || undefined,
    hashIndexedAt: raw.hash_indexed_at || undefined,
    searchIndexedAt: raw.search_indexed_at || undefined,
    fingerprintPresent: Boolean(raw.fingerprint_3x64k),
  };
}

function mapMockDocument(raw: any): PreviewDocumentRecord {
  return {
    id: raw.id,
    title: raw.title || raw.name || raw.id,
    status: raw.status || "Unknown",
    revision: String(raw.revision ?? "1"),
    fileType: raw.fileType || raw.type || "Unknown",
    size: raw.fileSize || raw.size || "Unknown size",
    linkedPl: raw.linkedPL || raw.linkedPl || "Unlinked",
    description: raw.description || "No description available.",
    updatedAt: raw.updatedAt || raw.updated_at || raw.date || "",
    fileUrl: resolveFileUrl(raw.filePath || raw.file || ""),
    tags: Array.isArray(raw.tags) ? raw.tags.map((value: unknown) => String(value)) : [],
    ocrStatus: raw.ocrStatus || undefined,
    ocrConfidence: typeof raw.ocrConfidence === "number" ? raw.ocrConfidence : null,
    duplicateStatus: raw.duplicateStatus || undefined,
    duplicateGroupKey: raw.duplicateGroupKey || undefined,
    sourceSystem: raw.sourceSystem || undefined,
    hashIndexedAt: raw.hashIndexedAt || undefined,
    searchIndexedAt: raw.searchIndexedAt || undefined,
    fingerprintPresent: Boolean(raw.sha256 || raw.fingerprint_3x64k),
  };
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function normalizeValue(value?: string | null) {
  return String(value ?? "").trim();
}

function humanizeToken(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function groupAssertions(assertions: DocumentMetadataAssertion[]) {
  return assertions
    .filter((assertion) => assertion.status === "APPROVED")
    .reduce<Record<string, string[]>>((accumulator, assertion) => {
      const key = normalizeValue(assertion.field_key);
      const value = normalizeValue(assertion.normalized_value || assertion.value);
      if (!key || !value) return accumulator;
      accumulator[key] = Array.from(new Set([...(accumulator[key] ?? []), value])).sort(
        (left, right) => left.localeCompare(right),
      );
      return accumulator;
    }, {});
}

function groupEntities(entities: DocumentOcrEntity[]) {
  return entities
    .filter((entity) => entity.review_status !== "REJECTED")
    .reduce<Record<string, DocumentOcrEntity[]>>((accumulator, entity) => {
      const key = normalizeValue(entity.entity_type);
      if (!key) return accumulator;
      accumulator[key] = [...(accumulator[key] ?? []), entity];
      return accumulator;
    }, {});
}

const PROMOTABLE_FIELD_KEYS = [
  "document_number",
  "drawing_number",
  "pl_number",
  "part_number",
  "invoice_number",
  "loco_number",
  "vendor_reference",
  "tender_reference",
];

function documentVisual(fileType: string) {
  const normalized = fileType.toUpperCase();
  if (["PNG", "JPG", "JPEG", "SVG", "TIFF", "IMAGE"].includes(normalized)) {
    return FileImage;
  }
  if (normalized === "PDF") {
    return FileText;
  }
  return FileCode2;
}

function statusBadgeVariant(status: string) {
  const normalized = status.toUpperCase();
  if (normalized.includes("APPROVED") || normalized.includes("ACTIVE")) {
    return "success" as const;
  }
  if (
    normalized.includes("REVIEW") ||
    normalized.includes("DRAFT") ||
    normalized.includes("PENDING")
  ) {
    return "warning" as const;
  }
  if (normalized.includes("OBSOLETE") || normalized.includes("REJECT")) {
    return "danger" as const;
  }
  return "default" as const;
}

export default function DocumentPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [documentRecord, setDocumentRecord] = useState<PreviewDocumentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [evidenceLoading, setEvidenceLoading] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [approvedAssertions, setApprovedAssertions] = useState<DocumentMetadataAssertion[]>([]);
  const [extractedEntities, setExtractedEntities] = useState<DocumentOcrEntity[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [promotionTarget, setPromotionTarget] = useState<DocumentOcrEntity | null>(null);

  const currentPath = `${location.pathname}${location.search}`;
  const previousPath = useMemo(
    () =>
      NavigationHistoryService.getPreviousPath(currentPath) ||
      (id ? `/documents/${id}` : "/documents"),
    [currentPath, id],
  );

  const loadEvidence = async (documentId: string) => {
    setEvidenceLoading(true);
    try {
      const [assertionResponse, entityResponse] = await Promise.allSettled([
        apiClient.getDocumentAssertions(documentId),
        apiClient.getDocumentEntities(documentId),
      ]);
      setApprovedAssertions(
        assertionResponse.status === "fulfilled" ? assertionResponse.value : [],
      );
      setExtractedEntities(entityResponse.status === "fulfilled" ? entityResponse.value : []);
    } finally {
      setEvidenceLoading(false);
    }
  };

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setEvidenceLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setEvidenceLoading(true);

    const loadDocument = async () => {
      try {
        const response = await apiClient.getDocument(id);
        if (!active) {
          return;
        }
        const mapped = mapBackendDocument(response);
        setDocumentRecord(mapped);
        DocumentPreviewService.setRecentPreview({
          documentId: mapped.id,
          title: mapped.title,
          openedAt: new Date().toISOString(),
        });
      } catch (_error) {
        const fallback = MOCK_DOCUMENTS.find((doc) => doc.id === id);
        if (active) {
          if (fallback) {
            const mapped = mapMockDocument(fallback);
            setDocumentRecord(mapped);
            DocumentPreviewService.setRecentPreview({
              documentId: mapped.id,
              title: mapped.title,
              openedAt: new Date().toISOString(),
            });
          } else {
            setDocumentRecord(null);
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadDocument();
    void loadEvidence(id).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        navigate(previousPath);
        return;
      }
      if (event.key.toLowerCase() === "m") {
        setMinimized(true);
        return;
      }
      if (event.key.toLowerCase() === "o") {
        if (id) {
          navigate(`/documents/${id}`);
        }
        return;
      }
      if (event.key.toLowerCase() === "n") {
        window.open(window.location.href, "_blank", "noopener,noreferrer");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [id, navigate, previousPath]);

  const closePreview = () => {
    navigate(previousPath);
  };

  const openInAnotherTab = () => {
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  };

  const openFullDocument = () => {
    if (id) {
      navigate(`/documents/${id}`);
    }
  };

  const downloadDocument = () => {
    if (documentRecord?.fileUrl) {
      window.open(documentRecord.fileUrl, "_blank", "noopener,noreferrer");
      return;
    }
    openFullDocument();
  };

  const PreviewIcon = documentVisual(documentRecord?.fileType || "Unknown");
  const assertionGroups = useMemo(
    () => Object.entries(groupAssertions(approvedAssertions)),
    [approvedAssertions],
  );
  const entityGroups = useMemo(
    () => Object.entries(groupEntities(extractedEntities)),
    [extractedEntities],
  );
  const pendingAssertions = useMemo(
    () => approvedAssertions.filter((assertion) => assertion.status !== "APPROVED"),
    [approvedAssertions],
  );
  const pendingEntities = useMemo(
    () => extractedEntities.filter((entity) => entity.review_status === "PENDING"),
    [extractedEntities],
  );
  const canEmbedPreview = Boolean(
    documentRecord?.fileUrl &&
      ["PDF", "PNG", "JPG", "JPEG", "SVG", "TIFF", "IMAGE"].includes(
        documentRecord.fileType.toUpperCase(),
      ),
  );
  const isImage =
    Boolean(documentRecord?.fileUrl) &&
    ["PNG", "JPG", "JPEG", "SVG", "TIFF", "IMAGE"].includes(
      (documentRecord?.fileType || "").toUpperCase(),
    );

  const runDocumentAction = async (
    key: string,
    action: () => Promise<void>,
    successMessage: string,
  ) => {
    if (!id) {
      return;
    }
    setBusyKey(key);
    try {
      await action();
      await loadEvidence(id);
      toast.success(successMessage);
    } catch (error) {
      console.error("[DocumentPreviewPage] Failed metadata action", error);
      toast.error("Could not complete the metadata action.");
    } finally {
      setBusyKey(null);
    }
  };

  const handleReindexMetadata = async () => {
    if (!id) {
      return;
    }
    setBusyKey("reindex");
    try {
      const updatedDocument = await apiClient.reindexDocumentMetadata(id);
      const mapped = mapBackendDocument(updatedDocument);
      setDocumentRecord(mapped);
      await loadEvidence(id);
      toast.success("Metadata reindexed for this document.");
    } catch (error) {
      console.error("[DocumentPreviewPage] Failed to reindex metadata", error);
      toast.error("Could not reindex metadata for this document.");
    } finally {
      setBusyKey(null);
    }
  };

  if (minimized && documentRecord) {
    return (
      <div className="fixed bottom-6 right-6 z-[120]">
        <GlassCard className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm hover:border-primary/20 transition-all duration-200">
          <PreviewIcon className="h-4 w-4 text-primary/90" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{documentRecord.title}</p>
            <p className="text-[11px] text-muted-foreground">Preview minimized</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setMinimized(false)}>
            Restore
          </Button>
          <Button size="sm" onClick={openFullDocument}>
            Open
          </Button>
          <button
            type="button"
            aria-label="Close preview"
            onClick={closePreview}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[110] bg-background/80 backdrop-blur-sm">
      <div className="flex h-full items-center justify-center p-4">
        <div className="flex h-[calc(100vh-2rem)] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400/90" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
                </div>
                <Badge variant="processing">Floating preview</Badge>
                {documentRecord && <Badge variant="default">{documentRecord.fileType}</Badge>}
                {documentRecord && (
                  <Badge variant={statusBadgeVariant(documentRecord.status)}>
                    {documentRecord.status}
                  </Badge>
                )}
                {documentRecord?.duplicateStatus && documentRecord.duplicateStatus !== "UNIQUE" && (
                  <Badge
                    variant={documentRecord.duplicateStatus === "MASTER" ? "success" : "warning"}
                  >
                    {documentRecord.duplicateStatus}
                  </Badge>
                )}
              </div>
              <h1 className="truncate text-xl font-semibold text-foreground">
                {documentRecord?.title || "Document preview"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Review the document before taking a workflow decision. This window can stay separate
                from the decision page.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-md border bg-background px-2 py-1">Esc close</span>
                <span className="rounded-md border bg-background px-2 py-1">M minimize</span>
                <span className="rounded-md border bg-background px-2 py-1">O full document</span>
                <span className="rounded-md border bg-background px-2 py-1">N new tab</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => navigate(previousPath)}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void handleReindexMetadata()}
                disabled={busyKey === "reindex" || !id}
              >
                {busyKey === "reindex" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Reindex metadata
              </Button>
              <Button size="sm" variant="secondary" onClick={openFullDocument}>
                Open full document
              </Button>
              <Button size="sm" variant="secondary" onClick={openInAnotherTab}>
                <ExternalLink className="h-3.5 w-3.5" />
                New tab
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setMinimized(true)}>
                <Minimize2 className="h-3.5 w-3.5" />
                Minimize
              </Button>
              <button
                type="button"
                aria-label="Close preview"
                onClick={closePreview}
                className="rounded-md border border-border bg-background p-2 text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-h-0 overflow-hidden rounded-lg border border-border bg-background">
              {loading ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary/90" />
                  Loading preview...
                </div>
              ) : documentRecord ? (
                canEmbedPreview ? (
                  isImage ? (
                    <div className="flex h-full items-center justify-center overflow-auto bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.10),transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-6">
                      <img
                        src={documentRecord.fileUrl}
                        alt={documentRecord.title}
                        className="max-h-full max-w-full rounded-2xl border border-border bg-white/95 object-contain shadow-2xl"
                      />
                    </div>
                  ) : (
                    <iframe
                      title={`${documentRecord.title} preview`}
                      src={documentRecord.fileUrl}
                      className="h-full w-full"
                    />
                  )
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
                    <PreviewIcon className="h-16 w-16 text-cyan-300/70" />
                    <div>
                      <p className="text-lg font-semibold text-foreground">
                        {documentRecord.title}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Inline rendering is not available for this file type. Use the full document
                        page or open the file directly.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button size="sm" onClick={openFullDocument}>
                        Open full document
                      </Button>
                      <Button size="sm" variant="secondary" onClick={downloadDocument}>
                        <Download className="h-3.5 w-3.5" />
                        Open file
                      </Button>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Document preview is unavailable.
                </div>
              )}
            </div>

            <GlassCard className="min-h-0 space-y-4 overflow-auto rounded-xl p-3.5 hover:border-primary/20 transition-all duration-200">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Document summary
                </p>
                <div className="space-y-3 rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">Document ID</span>
                    <span className="font-mono text-xs text-primary/90">
                      {documentRecord?.id || id}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <Badge variant={statusBadgeVariant(documentRecord?.status || "Unknown")}>
                      {documentRecord?.status || "Unknown"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">Revision</span>
                    <span className="font-mono text-xs text-foreground">
                      {documentRecord?.revision || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">Linked PL</span>
                    <span className="font-mono text-xs text-foreground">
                      {documentRecord?.linkedPl || "Unlinked"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">File</span>
                    <span className="text-xs text-foreground">
                      {documentRecord?.fileType || "Unknown"} · {documentRecord?.size || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">Updated</span>
                    <span className="text-xs text-foreground">
                      {formatDateTime(documentRecord?.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Intelligence status
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center gap-2 text-foreground">
                      <BrainCircuit className="h-4 w-4 text-cyan-300" />
                      <span className="text-sm font-semibold">OCR & extraction</span>
                    </div>
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">OCR status</span>
                        <Badge variant={statusBadgeVariant(documentRecord?.ocrStatus || "Unknown")}>
                          {documentRecord?.ocrStatus || "Unknown"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Confidence</span>
                        <span className="text-foreground">
                          {typeof documentRecord?.ocrConfidence === "number"
                            ? `${documentRecord.ocrConfidence}%`
                            : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Approved fields</span>
                        <span className="text-foreground">{assertionGroups.length}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Entity groups</span>
                        <span className="text-foreground">{entityGroups.length}</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center gap-2 text-foreground">
                      <Fingerprint className="h-4 w-4 text-amber-300" />
                      <span className="text-sm font-semibold">Search & dedup</span>
                    </div>
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Duplicate state</span>
                        <Badge
                          variant={
                            documentRecord?.duplicateStatus === "MASTER"
                              ? "success"
                              : documentRecord?.duplicateStatus === "DUPLICATE"
                                ? "warning"
                                : "default"
                          }
                        >
                          {documentRecord?.duplicateStatus || "UNIQUE"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Sparse fingerprint</span>
                        <span className="text-foreground">
                          {documentRecord?.fingerprintPresent ? "Present" : "Missing"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Search indexed</span>
                        <span className="text-foreground">
                          {formatDateTime(documentRecord?.searchIndexedAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Hash indexed</span>
                        <span className="text-foreground">
                          {formatDateTime(documentRecord?.hashIndexedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {documentRecord?.linkedPl && documentRecord.linkedPl !== "Unlinked" && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Linked configuration
                  </p>
                  <div className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center gap-2 text-foreground">
                      <Boxes className="h-4 w-4" />
                      <span className="font-mono text-sm">{documentRecord.linkedPl}</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      Open the PL workspace if this decision depends on linked revisions, baselines,
                      or released document relationships.
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-3"
                      onClick={() => navigate(`/pl/${documentRecord.linkedPl}`)}
                    >
                      Open linked PL
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Governed metadata
                  </p>
                  {evidenceLoading && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading
                    </span>
                  )}
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  {assertionGroups.length > 0 ? (
                    <div className="space-y-3">
                      {assertionGroups.map(([fieldKey, values]) => (
                        <div key={fieldKey}>
                          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-foreground">
                            <ShieldCheck className="h-3.5 w-3.5 text-primary/90" />
                            {humanizeToken(fieldKey)}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {values.map((value) => (
                              <Badge key={`${fieldKey}:${value}`} variant="success" size="sm">
                                {value}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No approved assertions are available for this document yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Metadata review queue
                </p>
                <div className="space-y-3 rounded-lg border border-border bg-background p-3">
                  {pendingAssertions.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <ShieldCheck className="h-3.5 w-3.5 text-amber-300" />
                        Pending assertions
                      </div>
                      {pendingAssertions.map((assertion) => {
                        const actionKey = `assertion:${assertion.id}`;
                        return (
                          <div
                            key={assertion.id}
                            className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground">
                                {humanizeToken(assertion.field_key)}: {assertion.value}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Source {assertion.source || "manual"} · updated{" "}
                                {formatDateTime(assertion.updated_at)}
                              </p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={busyKey === actionKey}
                                >
                                  {busyKey === actionKey ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  )}
                                  Review
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-44 border border-border bg-popover text-popover-foreground"
                              >
                                <DropdownMenuItem
                                  onSelect={() =>
                                    void runDocumentAction(
                                      actionKey,
                                      async () => {
                                        await apiClient.approveDocumentAssertion(id!, assertion.id);
                                      },
                                      `${humanizeToken(assertion.field_key)} approved.`,
                                    )
                                  }
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-secondary" />
                                <DropdownMenuItem
                                  className="text-rose-200 focus:text-rose-100"
                                  onSelect={() =>
                                    void runDocumentAction(
                                      actionKey,
                                      async () => {
                                        await apiClient.rejectDocumentAssertion(id!, assertion.id);
                                      },
                                      `${humanizeToken(assertion.field_key)} rejected.`,
                                    )
                                  }
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Reject
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {pendingEntities.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <ScanSearch className="h-3.5 w-3.5 text-indigo-300" />
                        Pending extracted entities
                      </div>
                      {pendingEntities.slice(0, 8).map((entity) => {
                        const actionKey = `entity:${entity.id}`;
                        return (
                          <div
                            key={entity.id}
                            className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground">
                                {humanizeToken(entity.entity_type)}:{" "}
                                {entity.normalized_value || entity.entity_value}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {typeof entity.confidence === "number"
                                  ? `${Math.round(entity.confidence)}% confidence`
                                  : "No confidence"}{" "}
                                · {entity.source_engine || entity.method || "local extractor"}
                              </p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={busyKey === actionKey}
                                >
                                  {busyKey === actionKey ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  )}
                                  Review
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-52 border border-border bg-popover text-popover-foreground"
                              >
                                <DropdownMenuItem
                                  onSelect={() =>
                                    void runDocumentAction(
                                      actionKey,
                                      async () => {
                                        await apiClient.approveDocumentEntity(id!, entity.id);
                                      },
                                      `${humanizeToken(entity.entity_type)} approved.`,
                                    )
                                  }
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Approve entity
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setPromotionTarget(entity)}>
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                  Promote to assertion
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-secondary" />
                                <DropdownMenuItem
                                  className="text-rose-200 focus:text-rose-100"
                                  onSelect={() =>
                                    void runDocumentAction(
                                      actionKey,
                                      async () => {
                                        await apiClient.rejectDocumentEntity(id!, entity.id);
                                      },
                                      `${humanizeToken(entity.entity_type)} rejected.`,
                                    )
                                  }
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Reject entity
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {!pendingAssertions.length && !pendingEntities.length && (
                    <p className="text-sm text-muted-foreground">
                      No pending metadata review items are waiting on this document.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Extracted entities
                </p>
                <div className="rounded-lg border border-border bg-background p-3">
                  {entityGroups.length > 0 ? (
                    <div className="space-y-3">
                      {entityGroups.map(([entityType, values]) => (
                        <div key={entityType}>
                          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-foreground">
                            <ScanSearch className="h-3.5 w-3.5 text-indigo-300" />
                            {humanizeToken(entityType)}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {values.slice(0, 6).map((entity) => (
                              <Badge
                                key={entity.id}
                                variant={entity.review_status === "APPROVED" ? "success" : "info"}
                                size="sm"
                              >
                                {entity.normalized_value || entity.entity_value}
                                {typeof entity.confidence === "number"
                                  ? ` · ${Math.round(entity.confidence)}%`
                                  : ""}
                              </Badge>
                            ))}
                            {values.length > 6 && (
                              <Badge variant="default" size="sm">
                                +{values.length - 6} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No extracted entities are available for this document yet.
                    </p>
                  )}
                </div>
              </div>

              {(documentRecord?.tags?.length ||
                documentRecord?.sourceSystem ||
                documentRecord?.duplicateGroupKey) && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Indexing context
                  </p>
                  <div className="space-y-3 rounded-lg border border-border bg-background p-3">
                    {documentRecord?.tags?.length ? (
                      <div>
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
                          <Tag className="h-3.5 w-3.5 text-cyan-300" />
                          Tags
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {documentRecord.tags.map((tag) => (
                            <Badge key={tag} variant="default" size="sm">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="grid gap-2 text-xs md:grid-cols-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Source system</span>
                        <span className="text-foreground">
                          {documentRecord?.sourceSystem || "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Duplicate group</span>
                        <span className="max-w-[148px] truncate text-foreground">
                          {documentRecord?.duplicateGroupKey || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Why this matters
                </p>
                <p className="text-sm leading-relaxed text-foreground/90">
                  Open this preview before approving, rejecting, releasing, or ignoring a workflow
                  item. The decision page remains separate so you can verify the latest document
                  without losing context.
                </p>
              </div>

              {documentRecord?.description && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Description
                  </p>
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {documentRecord.description}
                  </p>
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      </div>
      <CommandDialog
        open={Boolean(promotionTarget)}
        onOpenChange={(open) => !open && setPromotionTarget(null)}
      >
        <div className="border-b border-border/80 px-4 py-4">
          <p className="text-sm font-semibold text-foreground">Promote extracted entity</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {promotionTarget
              ? `Choose the governed field for "${promotionTarget.normalized_value || promotionTarget.entity_value}".`
              : "Choose the governed field for this extracted entity."}
          </p>
        </div>
        <CommandInput placeholder="Search a target field…" />
        <CommandList>
          <CommandEmpty>No target field found.</CommandEmpty>
          <CommandGroup heading="Governed fields">
            {PROMOTABLE_FIELD_KEYS.map((fieldKey) => (
              <CommandItem
                key={fieldKey}
                onSelect={() => {
                  if (!id || !promotionTarget) {
                    return;
                  }
                  const actionKey = `promote:${promotionTarget.id}`;
                  void runDocumentAction(
                    actionKey,
                    async () => {
                      await apiClient.promoteDocumentEntityToAssertion(id, promotionTarget.id, {
                        field_key: fieldKey,
                      });
                      setPromotionTarget(null);
                    },
                    `${humanizeToken(fieldKey)} assertion created.`,
                  );
                }}
              >
                <ShieldCheck className="h-4 w-4 text-primary/90" />
                <div className="flex min-w-0 flex-col">
                  <span>{humanizeToken(fieldKey)}</span>
                  <span className="text-xs text-muted-foreground">{fieldKey}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
