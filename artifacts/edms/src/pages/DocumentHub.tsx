import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCheck,
  CheckSquare,
  ChevronRight,
  Columns3,
  Download,
  File,
  FileImage,
  FileText,
  FolderOpen,
  Grid,
  Link as LinkIcon,
  List,
  Minus,
  Plus,
  ScanText,
  Search,
  Send,
  Square,
  ToggleLeft,
  ToggleRight,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  DocumentPreviewButton,
  getDocumentContextAttributes,
} from "../components/documents/DocumentPreviewActions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { EmptyState } from "../components/ui/EmptyState";
import { Badge, Button, GlassCard, PageHeader } from "../components/ui/Shared";
import { TableSkeleton } from "../components/ui/TableSkeleton";
import { MOCK_DOCUMENTS } from "../lib/mock";
import { ExportImportService } from "../services/ExportImportService";

const statusVariant = (s: string) => {
  if (s === "Approved") return "success" as const;
  if (s === "In Review") return "warning" as const;
  if (s === "Obsolete") return "danger" as const;
  if (s === "Draft") return "warning" as const;
  return "default" as const;
};

const ocrVariant = (s: string) => {
  if (s === "Completed") return "success" as const;
  if (s === "Processing") return "processing" as const;
  if (s === "Failed") return "danger" as const;
  return "default" as const;
};

const FileIcon = ({ type }: { type: string }) => {
  if (type === "PNG" || type === "JPG") return <FileImage className="w-5 h-5 text-purple-400" />;
  if (type === "XLSX") return <File className="w-5 h-5 text-green-400" />;
  if (type === "DOCX") return <File className="w-5 h-5 text-blue-400" />;
  return <FileText className="w-5 h-5 text-primary" />;
};

type SortField = "date" | "name" | "type" | "status" | "revision" | "category";
type SortDir = "asc" | "desc";

const STATUS_FILTERS = ["All", "Approved", "In Review", "Draft", "Obsolete"];
const OCR_FILTERS = ["All", "Completed", "Processing", "Failed", "Not Required"];
const TYPE_FILTERS = ["All", "PDF", "DOCX", "XLSX", "PNG", "JPG"];
const _CATEGORY_FILTERS = [
  "All",
  "Electrical Schema",
  "Specification",
  "CAD Output",
  "Calibration Log",
  "Test Report",
  "Certificate",
];

type DocumentRecord = (typeof MOCK_DOCUMENTS)[number];

const DOCUMENT_EXPORT_HEADERS = [
  "ID",
  "Name",
  "Category",
  "Type",
  "Revision",
  "Status",
  "OCR Status",
  "Linked PL",
  "Author",
  "Date",
];

function documentExportRows(documents: DocumentRecord[]) {
  return documents.map((document) => [
    document.id,
    document.name,
    document.category,
    document.type,
    document.revision,
    document.status,
    document.ocrStatus,
    document.linkedPL ?? "",
    document.author ?? "",
    document.date,
  ]);
}

function downloadDocumentsCsv(documents: DocumentRecord[], filenamePrefix: string) {
  const csv = [
    DOCUMENT_EXPORT_HEADERS.join(","),
    ...documentExportRows(documents).map((row) =>
      row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","),
    ),
  ].join("\n");
  const date = new Date().toISOString().split("T")[0];
  ExportImportService.downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    `${filenamePrefix}-${date}.csv`,
  );
}

function exportDocumentsExcel(documents: DocumentRecord[], filenamePrefix: string) {
  ExportImportService.exportGenericTableExcel(
    "Documents",
    DOCUMENT_EXPORT_HEADERS,
    documentExportRows(documents),
    filenamePrefix,
  );
}

function currentIsoDate() {
  return new Date().toISOString().split("T")[0];
}

function mergeTags(existing: string[] | undefined, next: string[]) {
  return Array.from(new Set([...(existing ?? []), ...next]));
}

function Toast({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-card/95 backdrop-blur-xl border border-teal-500/30 shadow-2xl shadow-black/60 text-sm text-foreground animate-slide-in-right">
      <CheckCheck className="w-4 h-4 text-primary shrink-0" />
      <span>{msg}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-2 text-muted-foreground hover:text-foreground/90 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function DocumentHub() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const [documents, setDocuments] = useState<DocumentRecord[]>(() =>
    MOCK_DOCUMENTS.map((document) => ({
      ...document,
      tags: [...(document.tags ?? [])],
    })),
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [ocrFilter, setOcrFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [_showFilters, _setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showObsolete, setShowObsolete] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [docPage, setDocPage] = useState(1);
  const DOC_PAGE_SIZE = 15;
  const [showColMenu, setShowColMenu] = useState(false);
  const ALL_COLS = [
    "id",
    "name",
    "category",
    "type",
    "revision",
    "status",
    "ocr",
    "linkedPL",
    "date",
  ] as const;
  type ColKey = (typeof ALL_COLS)[number];
  const COL_LABELS: Record<ColKey, string> = {
    id: "Doc ID",
    name: "Name",
    category: "Category",
    type: "Type",
    revision: "Rev",
    status: "Status",
    ocr: "OCR",
    linkedPL: "Linked PL",
    date: "Updated",
  };
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(new Set(ALL_COLS));
  const toggleCol = (c: ColKey) =>
    setVisibleCols((v) => {
      const n = new Set(v);
      if (n.has(c)) {
        if (n.size > 2) n.delete(c);
      } else n.add(c);
      return n;
    });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-2.5 h-2.5 text-muted-foreground" />;
    return sortDir === "asc" ? (
      <ArrowUp className="w-2.5 h-2.5 text-primary" />
    ) : (
      <ArrowDown className="w-2.5 h-2.5 text-primary" />
    );
  };

  const filtered = useMemo(() => {
    let docs = documents.filter((d) => {
      if (!showObsolete && d.status === "Obsolete") return false;
      const matchSearch =
        !search ||
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.id.toLowerCase().includes(search.toLowerCase()) ||
        d.linkedPL?.toLowerCase().includes(search.toLowerCase()) ||
        d.author?.toLowerCase().includes(search.toLowerCase()) ||
        d.tags?.some((t: string) => t.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = statusFilter === "All" || d.status === statusFilter;
      const matchOcr = ocrFilter === "All" || d.ocrStatus === ocrFilter;
      const matchType = typeFilter === "All" || d.type === typeFilter;
      const matchCategory = categoryFilter === "All" || d.category === categoryFilter;
      return matchSearch && matchStatus && matchOcr && matchType && matchCategory;
    });

    docs = [...docs].sort((a, b) => {
      let va: string, vb: string;
      switch (sortField) {
        case "name":
          va = a.name;
          vb = b.name;
          break;
        case "type":
          va = a.type;
          vb = b.type;
          break;
        case "status":
          va = a.status;
          vb = b.status;
          break;
        case "revision":
          va = a.revision;
          vb = b.revision;
          break;
        case "category":
          va = a.category;
          vb = b.category;
          break;
        default:
          va = a.date;
          vb = b.date;
      }
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    return docs;
  }, [
    documents,
    search,
    statusFilter,
    ocrFilter,
    typeFilter,
    categoryFilter,
    sortField,
    sortDir,
    showObsolete,
  ]);

  useEffect(() => {
    setDocPage(1);
    setSelectedIds(new Set());
  }, [filtered]);

  const totalDocPages = Math.max(1, Math.ceil(filtered.length / DOC_PAGE_SIZE));
  const paginated = filtered.slice((docPage - 1) * DOC_PAGE_SIZE, docPage * DOC_PAGE_SIZE);

  const categoryOptions = useMemo(
    () => ["All", ...Array.from(new Set(documents.map((document) => document.category))).sort()],
    [documents],
  );

  const stats = {
    total: documents.length,
    approved: documents.filter((d) => d.status === "Approved").length,
    inReview: documents.filter((d) => d.status === "In Review").length,
    ocrPending: documents.filter((d) => d.ocrStatus === "Processing").length,
    ocrFailed: documents.filter((d) => d.ocrStatus === "Failed").length,
    unlinked: documents.filter((d) => !d.linkedPL || d.linkedPL === "N/A").length,
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: documents.length };
    STATUS_FILTERS.slice(1).forEach((sf) => {
      counts[sf] = documents.filter((d) => d.status === sf).length;
    });
    return counts;
  }, [documents]);

  const ocrCounts = useMemo(() => {
    const counts: Record<string, number> = { All: documents.length };
    OCR_FILTERS.slice(1).forEach((of) => {
      counts[of] = documents.filter((d) => d.ocrStatus === of).length;
    });
    return counts;
  }, [documents]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { All: documents.length };
    TYPE_FILTERS.slice(1).forEach((tf) => {
      counts[tf] = documents.filter((d) => d.type === tf).length;
    });
    return counts;
  }, [documents]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: documents.length };
    categoryOptions.slice(1).forEach((cf) => {
      counts[cf] = documents.filter((d) => d.category === cf).length;
    });
    return counts;
  }, [documents, categoryOptions]);

  const activeFilters = [statusFilter, ocrFilter, typeFilter, categoryFilter].filter(
    (f) => f !== "All",
  ).length;

  const allSelected = filtered.length > 0 && filtered.every((d) => selectedIds.has(d.id));
  const someSelected = filtered.some((d) => selectedIds.has(d.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((d) => d.id)));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectionCount = selectedIds.size;
  const clearSelection = () => setSelectedIds(new Set());
  const exportDataset = search || activeFilters > 0 || !showObsolete ? filtered : documents;

  // Bulk upload
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const handleBulkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const count = e.target.files?.length ?? 0;
    e.target.value = "";
    if (count > 0) {
      showToast(`${count} file${count > 1 ? "s" : ""} queued — opening ingest…`);
      setTimeout(() => navigate("/documents/ingest"), 900);
    }
  };

  // Download selected as CSV
  const handleDownloadSelected = () => {
    const docs = documents.filter((d) => selectedIds.has(d.id));
    downloadDocumentsCsv(docs, "selected-documents");
    showToast(`Downloaded ${docs.length} document${docs.length > 1 ? "s" : ""} as CSV.`);
  };

  // Request approval — navigate to approvals page with selected IDs
  const handleRequestApproval = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setDocuments((current) =>
      current.map((document) =>
        selectedIds.has(document.id)
          ? {
              ...document,
              status: "In Review",
              date: currentIsoDate(),
              tags: mergeTags(document.tags, ["Approval Queue"]),
            }
          : document,
      ),
    );
    showToast(`${ids.length} document${ids.length > 1 ? "s" : ""} sent to approval queue.`);
    clearSelection();
    navigate(`/approvals?docs=${encodeURIComponent(ids.join(","))}`);
  };

  // Folder picker
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const FOLDERS = [
    "Electrical Schema",
    "Specification",
    "CAD Output",
    "Calibration Log",
    "Test Report",
    "Certificate",
    "Archive",
  ] as const;

  const moveSelectedDocuments = (folder: (typeof FOLDERS)[number]) => {
    const movedCount = selectionCount;
    setDocuments((current) =>
      current.map((document) => {
        if (!selectedIds.has(document.id)) {
          return document;
        }

        if (folder === "Archive") {
          return {
            ...document,
            status: "Obsolete",
            lifecycle: "Archived",
            date: currentIsoDate(),
            tags: mergeTags(document.tags, ["Archive"]),
          };
        }

        return {
          ...document,
          category: folder,
          lifecycle: document.lifecycle === "Archived" ? "Draft" : document.lifecycle,
          status: document.status === "Obsolete" ? "Draft" : document.status,
          date: currentIsoDate(),
          tags: mergeTags(document.tags, [folder, "Relocated"]),
        };
      }),
    );
    setFolderPickerOpen(false);
    showToast(`${movedCount} document${movedCount > 1 ? "s" : ""} moved to "${folder}".`);
    clearSelection();
  };

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto">
      {toast && <Toast msg={toast} onDismiss={() => setToast(null)} />}

      {/* Hidden bulk upload file input */}
      <input
        ref={bulkInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
        className="hidden"
        onChange={handleBulkFileSelect}
      />

      {/* Folder picker dialog */}
      <Dialog open={folderPickerOpen} onOpenChange={setFolderPickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move to Folder</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">
            Select destination folder for{" "}
            <span className="text-foreground font-medium">
              {selectionCount} document{selectionCount > 1 ? "s" : ""}
            </span>
            .
          </p>
          <div className="grid gap-1">
            {FOLDERS.map((folder) => (
              <button
                type="button"
                key={folder}
                onClick={() => moveSelectedDocuments(folder)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-secondary/60 text-sm text-left border border-transparent hover:border-border transition-colors"
              >
                <FolderOpen className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="text-foreground/90">{folder}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <PageHeader
        title="Document Hub"
        subtitle="Manage, search, and track all engineering documents linked to PL records"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadDocumentsCsv(exportDataset, "documents-view")}
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => exportDocumentsExcel(exportDataset, "documents-view")}
            >
              <Download className="w-3.5 h-3.5" /> Excel
            </Button>
            <Button variant="secondary" size="sm" onClick={() => bulkInputRef.current?.click()}>
              <Upload className="w-3.5 h-3.5" /> Bulk Upload
            </Button>
            <Button size="sm" onClick={() => navigate("/documents/ingest")}>
              <Plus className="w-3.5 h-3.5" /> Ingest Document
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Documents",
            value: stats.total,
            hint: "All engineering records",
            icon: <FileText className="w-4 h-4 text-primary" />,
            onClick: () => {
              setStatusFilter("All");
              setOcrFilter("All");
              setTypeFilter("All");
              setCategoryFilter("All");
            },
          },
          {
            label: "Approved Documents",
            value: stats.approved,
            hint: "Approved and ready to build",
            icon: <CheckCheck className="w-4 h-4 text-emerald-400" />,
            onClick: () => setStatusFilter("Approved"),
          },
          {
            label: "Pending Review",
            value: stats.inReview,
            hint: "Awaiting approval sign-offs",
            icon: <Send className="w-4 h-4 text-amber-500" />,
            onClick: () => setStatusFilter("In Review"),
          },
          {
            label: "OCR Processing",
            value: stats.ocrPending + stats.ocrFailed,
            hint: "Pending and failed OCR jobs",
            icon: <ScanText className="w-4 h-4 text-blue-500" />,
            onClick: () => setOcrFilter("Processing"),
          },
        ].map((metric) => (
          <button
            key={metric.label}
            type="button"
            onClick={metric.onClick}
            className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-md px-4 py-3 text-left shadow-sm transition-all hover:border-primary/40 hover:bg-secondary/30 hover:-translate-y-0.5 active:translate-y-0 duration-200"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {metric.label}
                </p>
                <p className="mt-1.5 font-mono text-2xl font-semibold text-foreground">
                  {metric.value}
                </p>
              </div>
              <div className="flex w-8 h-8 items-center justify-center rounded-lg border border-border/50 bg-background/50">
                {metric.icon}
              </div>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">{metric.hint}</p>
          </button>
        ))}
      </div>

      <GlassCard className="p-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="teal-outline" onClick={() => setStatusFilter("In Review")}>
            <Send className="w-3.5 h-3.5" />
            Focus Review Queue
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setOcrFilter("Processing")}>
            <ScanText className="w-3.5 h-3.5" />
            OCR Processing
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setSearch("PL-")}>
            <LinkIcon className="w-3.5 h-3.5" />
            Find Linked PL Records
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate("/templates")}>
            <FileText className="w-3.5 h-3.5" />
            Templates
          </Button>
        </div>
      </GlassCard>

      <div className="space-y-4">
        {/* Inline filter bar — dropdown style */}
        <GlassCard className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search name, ID, PL, author, tags..."
                className="w-full pl-9 pr-3 h-9 text-xs bg-background/60 border border-border/60 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Status dropdown */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`h-9 pl-3 pr-8 text-xs rounded-lg border transition-colors appearance-none cursor-pointer focus:outline-none focus:border-primary/50 bg-background/60 ${
                  statusFilter !== "All"
                    ? "border-teal-500/50 text-primary bg-teal-500/8"
                    : "border-border/60 text-muted-foreground hover:border-border"
                }`}
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s} value={s}>
                    {s === "All" ? "Status: All" : s}{" "}
                    {statusCounts[s] !== undefined ? `(${statusCounts[s]})` : ""}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                <svg
                  className="w-3 h-3 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            {/* OCR Status dropdown */}
            <div className="relative">
              <select
                value={ocrFilter}
                onChange={(e) => setOcrFilter(e.target.value)}
                className={`h-9 pl-3 pr-8 text-xs rounded-lg border transition-colors appearance-none cursor-pointer focus:outline-none focus:border-primary/50 bg-background/60 ${
                  ocrFilter !== "All"
                    ? "border-teal-500/50 text-primary bg-teal-500/8"
                    : "border-border/60 text-muted-foreground hover:border-border"
                }`}
              >
                {OCR_FILTERS.map((o) => (
                  <option key={o} value={o}>
                    {o === "All" ? "OCR: All" : o}{" "}
                    {ocrCounts[o] !== undefined ? `(${ocrCounts[o]})` : ""}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                <svg
                  className="w-3 h-3 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            {/* File Type dropdown */}
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={`h-9 pl-3 pr-8 text-xs rounded-lg border transition-colors appearance-none cursor-pointer focus:outline-none focus:border-primary/50 bg-background/60 ${
                  typeFilter !== "All"
                    ? "border-teal-500/50 text-primary bg-teal-500/8"
                    : "border-border/60 text-muted-foreground hover:border-border"
                }`}
              >
                {TYPE_FILTERS.map((t) => (
                  <option key={t} value={t}>
                    {t === "All" ? "Type: All" : t}{" "}
                    {typeCounts[t] !== undefined ? `(${typeCounts[t]})` : ""}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                <svg
                  className="w-3 h-3 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            {/* Category dropdown */}
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={`h-9 pl-3 pr-8 text-xs rounded-lg border transition-colors appearance-none cursor-pointer focus:outline-none focus:border-primary/50 bg-background/60 ${
                  categoryFilter !== "All"
                    ? "border-teal-500/50 text-primary bg-teal-500/8"
                    : "border-border/60 text-muted-foreground hover:border-border"
                }`}
              >
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c === "All" ? "Category: All" : c}{" "}
                    {categoryCounts[c] !== undefined ? `(${categoryCounts[c]})` : ""}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                <svg
                  className="w-3 h-3 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            {/* Obsolete toggle */}
            <button
              type="button"
              onClick={() => setShowObsolete((v) => !v)}
              className={`flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-medium border transition-colors ${
                showObsolete
                  ? "bg-background/60 border-border/60 text-muted-foreground hover:border-border"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
              title={showObsolete ? "Showing obsolete versions" : "Hiding obsolete versions"}
            >
              {showObsolete ? (
                <ToggleRight className="w-4 h-4" />
              ) : (
                <ToggleLeft className="w-4 h-4 text-rose-400" />
              )}
              {showObsolete ? "Incl. Obsolete" : "Excl. Obsolete"}
            </button>

            {/* Clear all filters */}
            {(activeFilters > 0 || search) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("All");
                  setOcrFilter("All");
                  setTypeFilter("All");
                  setCategoryFilter("All");
                  setSearch("");
                }}
                className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-medium border border-rose-500/20 bg-rose-500/8 text-rose-400 hover:bg-rose-500/15 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        </GlassCard>

        {/* Full-width documents table */}
        <div className="space-y-4">
          <GlassCard className="p-4">
            {/* Sorting and Toolbar */}
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Column visibility toggle */}
                {viewMode === "table" && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowColMenu((v) => !v)}
                      className={`flex items-center gap-1.5 px-3 h-9 rounded-md text-xs font-medium border transition-colors ${showColMenu ? "bg-teal-500/15 border-teal-500/40 text-primary/90" : "bg-secondary/60 border-border text-muted-foreground hover:text-foreground"}`}
                    >
                      <Columns3 className="w-3.5 h-3.5" /> Columns
                    </button>
                    {showColMenu && (
                      <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-card/95 backdrop-blur-xl border border-white/8 rounded-md shadow-2xl shadow-black/60 p-2">
                        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          Visible Columns
                        </p>
                        {ALL_COLS.map((c) => (
                          <button
                            type="button"
                            key={c}
                            onClick={() => toggleCol(c)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-left transition-colors"
                          >
                            <div
                              className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${visibleCols.has(c) ? "bg-teal-500/30 border-teal-500/60" : "border-border"}`}
                            >
                              {visibleCols.has(c) && (
                                <CheckCheck className="w-2.5 h-2.5 text-primary" />
                              )}
                            </div>
                            <span className="text-xs text-foreground/90">{COL_LABELS[c]}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex border border-border/60 rounded-md overflow-hidden h-9">
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`px-3 flex items-center justify-center transition-colors ${viewMode === "table" ? "bg-teal-500/20 text-primary/90" : "text-muted-foreground hover:text-foreground/90"}`}
                    title="Table view"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`px-3 flex items-center justify-center transition-colors ${viewMode === "grid" ? "bg-teal-500/20 text-primary/90" : "text-muted-foreground hover:text-foreground/90"}`}
                    title="Grid view"
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Dedicated unified sorting bar supporting date sorting, visible in table and grid */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-border/30">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                    Sort By:
                  </span>
                  <div className="flex border border-border/50 rounded-xl overflow-hidden bg-secondary/30">
                    {(
                      ["date", "name", "category", "type", "revision", "status"] as SortField[]
                    ).map((field) => (
                      <button
                        type="button"
                        key={field}
                        onClick={() => handleSort(field)}
                        className={`px-2.5 py-1 text-xs transition-colors border-r border-border/30 last:border-r-0 flex items-center gap-1 ${
                          sortField === field
                            ? "bg-teal-500/25 text-primary font-semibold"
                            : "text-muted-foreground hover:text-foreground/90 hover:bg-secondary/40"
                        }`}
                      >
                        <span className="capitalize">{field === "date" ? "Date" : field}</span>
                        {sortField === field &&
                          (sortDir === "asc" ? (
                            <ArrowUp className="w-2.5 h-2.5 text-primary" />
                          ) : (
                            <ArrowDown className="w-2.5 h-2.5 text-primary" />
                          ))}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                  <span>
                    Showing{" "}
                    <span className="text-primary font-semibold">
                      {Math.min((docPage - 1) * DOC_PAGE_SIZE + 1, filtered.length)}–
                      {Math.min(docPage * DOC_PAGE_SIZE, filtered.length)}
                    </span>{" "}
                    of{" "}
                    <span className="text-muted-foreground font-semibold">{filtered.length}</span>{" "}
                    documents
                  </span>
                  {!showObsolete && <span className="text-rose-400/70">· obsolete hidden</span>}
                </div>
              </div>
            </div>

            {/* Bulk action toolbar */}
            {someSelected && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2.5 bg-teal-500/8 border border-teal-500/25 rounded-xl">
                <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-semibold text-primary/90">
                  {selectionCount} selected
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={handleDownloadSelected}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/60 hover:bg-secondary/60 text-foreground/90 text-xs border border-border/40 hover:border-teal-500/30 transition-all"
                  >
                    <Download className="w-3.5 h-3.5 text-primary" /> Download Selected
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestApproval}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/60 hover:bg-secondary/60 text-foreground/90 text-xs border border-border/40 hover:border-amber-500/30 transition-all"
                  >
                    <Send className="w-3.5 h-3.5 text-amber-400" /> Request Approval
                  </button>
                  <button
                    type="button"
                    onClick={() => setFolderPickerOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/60 hover:bg-secondary/60 text-foreground/90 text-xs border border-border/40 hover:border-indigo-500/30 transition-all"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-indigo-400" /> Move to Folder
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                    title="Clear selection"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Table view */}
            {loading ? (
              <TableSkeleton columns={visibleCols.size + 1} rows={8} className="my-2" />
            ) : viewMode === "table" ? (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="pb-3 pl-3 w-8">
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          className="flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                          title={allSelected ? "Deselect all" : "Select all"}
                        >
                          {allSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : someSelected ? (
                            <Minus className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      {visibleCols.has("id") && (
                        <th className="pb-3 pl-1 font-semibold text-[11px] uppercase tracking-wide">
                          Document ID
                        </th>
                      )}
                      {visibleCols.has("name") && (
                        <th className="pb-3 pr-4 font-semibold text-[11px] uppercase tracking-wide">
                          <button
                            type="button"
                            onClick={() => handleSort("name")}
                            className="flex items-center gap-1 hover:text-foreground/90 transition-colors"
                          >
                            Name <SortIcon field="name" />
                          </button>
                        </th>
                      )}
                      {visibleCols.has("category") && (
                        <th className="pb-3 font-semibold text-[11px] uppercase tracking-wide">
                          <button
                            type="button"
                            onClick={() => handleSort("category")}
                            className="flex items-center gap-1 hover:text-foreground/90 transition-colors"
                          >
                            Category <SortIcon field="category" />
                          </button>
                        </th>
                      )}
                      {visibleCols.has("type") && (
                        <th className="pb-3 font-semibold text-[11px] uppercase tracking-wide">
                          <button
                            type="button"
                            onClick={() => handleSort("type")}
                            className="flex items-center gap-1 hover:text-foreground/90 transition-colors"
                          >
                            Type <SortIcon field="type" />
                          </button>
                        </th>
                      )}
                      {visibleCols.has("revision") && (
                        <th className="pb-3 font-semibold text-[11px] uppercase tracking-wide">
                          <button
                            type="button"
                            onClick={() => handleSort("revision")}
                            className="flex items-center gap-1 hover:text-foreground/90 transition-colors"
                          >
                            Rev <SortIcon field="revision" />
                          </button>
                        </th>
                      )}
                      {visibleCols.has("status") && (
                        <th className="pb-3 font-semibold text-[11px] uppercase tracking-wide">
                          <button
                            type="button"
                            onClick={() => handleSort("status")}
                            className="flex items-center gap-1 hover:text-foreground/90 transition-colors"
                          >
                            Status <SortIcon field="status" />
                          </button>
                        </th>
                      )}
                      {visibleCols.has("ocr") && (
                        <th className="pb-3 font-semibold text-[11px] uppercase tracking-wide">
                          OCR
                        </th>
                      )}
                      {visibleCols.has("linkedPL") && (
                        <th className="pb-3 font-semibold text-[11px] uppercase tracking-wide">
                          Linked PL
                        </th>
                      )}
                      {visibleCols.has("date") && (
                        <th className="pb-3 font-semibold text-[11px] uppercase tracking-wide">
                          <button
                            type="button"
                            onClick={() => handleSort("date")}
                            className="flex items-center gap-1 hover:text-foreground/90 transition-colors"
                          >
                            Updated <SortIcon field="date" />
                          </button>
                        </th>
                      )}
                      <th className="pb-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {paginated.map((doc) => {
                      const isSelected = selectedIds.has(doc.id);
                      return (
                        <tr
                          key={doc.id}
                          {...getDocumentContextAttributes(doc.id, doc.name)}
                          className={`hover:bg-secondary/40 cursor-pointer transition-colors group ${isSelected ? "bg-teal-500/5" : ""}`}
                          onClick={() =>
                            navigate(
                              `/documents/${doc.id}${search ? `?q=${encodeURIComponent(search)}` : ""}`,
                            )
                          }
                        >
                          <td className="py-3 pl-3" onClick={(e) => toggleSelect(doc.id, e)}>
                            <button
                              type="button"
                              className="flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-primary" />
                              ) : (
                                <Square className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                            </button>
                          </td>
                          {visibleCols.has("id") && (
                            <td className="py-3 pl-1">
                              <div className="flex items-center gap-2">
                                <FileIcon type={doc.type} />
                                <span className="font-mono text-primary text-xs">{doc.id}</span>
                              </div>
                            </td>
                          )}
                          {visibleCols.has("name") && (
                            <td className="py-3 pr-4">
                              <span className="text-foreground font-medium">{doc.name}</span>
                              <div className="text-[11px] text-muted-foreground">
                                {doc.author} · {doc.size}
                              </div>
                            </td>
                          )}
                          {visibleCols.has("category") && (
                            <td className="py-3">
                              <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 rounded-md text-xs border border-indigo-500/20">
                                {doc.category}
                              </span>
                            </td>
                          )}
                          {visibleCols.has("type") && (
                            <td className="py-3">
                              <span className="px-2 py-0.5 bg-secondary/80 text-muted-foreground rounded-md text-xs border border-border/40">
                                {doc.type}
                              </span>
                            </td>
                          )}
                          {visibleCols.has("revision") && (
                            <td className="py-3 text-muted-foreground font-mono text-xs">
                              {doc.revision}
                            </td>
                          )}
                          {visibleCols.has("status") && (
                            <td className="py-3">
                              <Badge variant={statusVariant(doc.status)}>{doc.status}</Badge>
                            </td>
                          )}
                          {visibleCols.has("ocr") && (
                            <td className="py-3">
                              <Badge variant={ocrVariant(doc.ocrStatus)}>{doc.ocrStatus}</Badge>
                            </td>
                          )}
                          {visibleCols.has("linkedPL") && (
                            <td className="py-3 font-mono text-xs">
                              {doc.linkedPL && doc.linkedPL !== "N/A" ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    navigate(`/pl/${doc.linkedPL}`);
                                  }}
                                  className="flex items-center gap-1 text-primary transition-colors hover:text-teal-200"
                                >
                                  <LinkIcon className="w-3 h-3" />
                                  {doc.linkedPL}
                                </button>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          )}
                          {visibleCols.has("date") && (
                            <td className="py-3 text-muted-foreground text-xs">{doc.date}</td>
                          )}
                          <td className="py-3 pr-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <DocumentPreviewButton
                                documentId={doc.id}
                                title={doc.name}
                                iconOnly
                                className="h-8 min-h-0 px-2 text-foreground/90 hover:text-teal-200"
                              />
                              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <EmptyState
                    icon={FileText}
                    title="No documents found"
                    description="Try adjusting your search or filter criteria"
                    action={
                      <>
                        {activeFilters > 0 && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setStatusFilter("All");
                              setOcrFilter("All");
                              setTypeFilter("All");
                              setCategoryFilter("All");
                            }}
                          >
                            Clear Filters
                          </Button>
                        )}
                        <Button size="sm" onClick={() => navigate("/documents/ingest")}>
                          <Plus className="w-3.5 h-3.5" /> Ingest First Document
                        </Button>
                      </>
                    }
                  />
                )}
              </div>
            ) : (
              /* Grid view */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginated.map((doc) => {
                  const isSelected = selectedIds.has(doc.id);
                  return (
                    <div
                      key={doc.id}
                      {...getDocumentContextAttributes(doc.id, doc.name)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          navigate(
                            `/documents/${doc.id}${search ? `?q=${encodeURIComponent(search)}` : ""}`,
                          );
                        }
                      }}
                      onClick={() =>
                        navigate(
                          `/documents/${doc.id}${search ? `?q=${encodeURIComponent(search)}` : ""}`,
                        )
                      }
                      className={`p-3 rounded-xl border border-border/50 bg-card/40 backdrop-blur-md cursor-pointer transition-all duration-200 group ${
                        isSelected
                          ? "bg-teal-500/8 border-teal-500/35 hover:border-teal-400/50"
                          : "hover:border-primary/30 hover:bg-secondary/40 hover:-translate-y-0.5"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => toggleSelect(doc.id, e)}
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-primary" />
                            ) : (
                              <Square className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </button>
                          <div className="w-8 h-8 rounded-xl bg-secondary/60 border border-border flex items-center justify-center">
                            <FileIcon type={doc.type} />
                          </div>
                        </div>
                        <Badge variant={statusVariant(doc.status)}>{doc.status}</Badge>
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1 line-clamp-2 group-hover:text-white transition-colors">
                        {doc.name}
                      </p>
                      <p className="font-mono text-[11px] text-primary mb-2">{doc.id}</p>

                      {/* Category badge */}
                      <div className="mb-2">
                        <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300/80 rounded-md text-[10px] border border-indigo-500/15">
                          {doc.category}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {doc.type} · {doc.size}
                        </span>
                        <span className="font-mono">Rev {doc.revision}</span>
                      </div>

                      {/* Linked PL */}
                      {doc.linkedPL && doc.linkedPL !== "N/A" && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/pl/${doc.linkedPL}`);
                          }}
                          className="mt-2 flex items-center gap-1 text-[11px] text-primary/80 transition-colors hover:text-teal-200"
                        >
                          <LinkIcon className="w-3 h-3" /> {doc.linkedPL}
                        </button>
                      )}

                      <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
                        <Badge variant={ocrVariant(doc.ocrStatus)} className="text-[10px]">
                          {doc.ocrStatus}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{doc.date}</span>
                          <DocumentPreviewButton
                            documentId={doc.id}
                            title={doc.name}
                            iconOnly
                            className="h-7 min-h-0 px-2 text-foreground/90 hover:text-teal-200"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <EmptyState
                    className="col-span-full"
                    icon={FileText}
                    title="No documents found"
                    description="Try adjusting your search or filter criteria"
                    action={
                      <Button size="sm" onClick={() => navigate("/documents/ingest")}>
                        <Plus className="w-3.5 h-3.5" /> Ingest First Document
                      </Button>
                    }
                  />
                )}
              </div>
            )}

            {/* Pagination Controls */}
            {totalDocPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  Page <span className="text-muted-foreground font-semibold">{docPage}</span> of{" "}
                  {totalDocPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDocPage(1)}
                    disabled={docPage === 1}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-primary/90 hover:bg-secondary/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    «
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocPage((p) => Math.max(1, p - 1))}
                    disabled={docPage === 1}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-primary/90 hover:bg-secondary/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    ‹ Prev
                  </button>
                  {Array.from({ length: Math.min(5, totalDocPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(docPage - 2, totalDocPages - 4));
                    const pg = start + i;
                    return (
                      <button
                        type="button"
                        key={pg}
                        onClick={() => setDocPage(pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${pg === docPage ? "bg-teal-500/20 text-primary/90 border border-teal-500/40" : "text-muted-foreground hover:text-foreground/90 hover:bg-secondary/60"}`}
                      >
                        {pg}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setDocPage((p) => Math.min(totalDocPages, p + 1))}
                    disabled={docPage === totalDocPages}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-primary/90 hover:bg-secondary/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Next ›
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocPage(totalDocPages)}
                    disabled={docPage === totalDocPages}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-primary/90 hover:bg-secondary/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
