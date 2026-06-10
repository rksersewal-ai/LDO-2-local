import {
  ArrowRight,
  Building2,
  CheckCircle,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Clock,
  DatabaseBackup,
  ExternalLink,
  FilePlus,
  FileText,
  Hash,
  Link as LinkIcon,
  Plus,
  Search,
  Shield,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Badge, Button, GlassCard, Input } from "../components/ui/Shared";
import { TableSkeleton } from "../components/ui/TableSkeleton";
import { usePLItems } from "../hooks/usePLItems";
import { type PlLinkableDocument, usePlLinkableDocuments } from "../hooks/usePlLinkableDocuments";
import { useAuth } from "../lib/auth";
import { resolveDocumentPreviewPath } from "../lib/documentPreview";
import type { PLNumber } from "../lib/types";
import { type PLPreviewPayload, PLPreviewService } from "../services/PLPreviewService";
import { PLFormModal } from "./PLDetail";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  UNDER_REVIEW: "Under Review",
  OBSOLETE: "Obsolete",
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "default"> = {
  ACTIVE: "success",
  UNDER_REVIEW: "warning",
  OBSOLETE: "danger",
};

const CATEGORY_COLORS: Record<string, string> = {
  "CAT-A": "bg-rose-500/10 text-rose-300 border-rose-500/30",
  "CAT-B": "bg-amber-500/10 text-amber-300 border-amber-500/30",
  "CAT-C": "bg-blue-500/10 text-blue-300 border-blue-500/30",
  "CAT-D": "bg-slate-700/50 text-muted-foreground border-slate-600/40",
};

type SortKey =
  | "plNumber"
  | "name"
  | "category"
  | "controllingAgency"
  | "status"
  | "docs"
  | "ecs"
  | "works";

const DOC_STATUS_VARIANT: Record<string, "success" | "warning" | "default" | "danger"> = {
  Approved: "success",
  "In Review": "warning",
  Draft: "default",
  Obsolete: "danger",
};

function SortIcon({
  col,
  sortKey,
  sortDir,
}: {
  col: SortKey;
  sortKey: SortKey | null;
  sortDir: "asc" | "desc";
}) {
  if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 text-slate-600 ml-0.5 shrink-0" />;
  return sortDir === "asc" ? (
    <ChevronUp className="w-3 h-3 text-primary ml-0.5 shrink-0" />
  ) : (
    <ChevronDown className="w-3 h-3 text-primary ml-0.5 shrink-0" />
  );
}

function LinkDocumentsModal({
  pl,
  onClose,
  onUpdate,
  documents,
  documentsLoading,
}: {
  pl: PLNumber;
  onClose: () => void;
  onUpdate: (linkedIds: string[]) => void;
  documents: PlLinkableDocument[];
  documentsLoading: boolean;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [linked, setLinked] = useState<string[]>(pl.linkedDocumentIds ?? []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return documents.filter(
      (d) =>
        !q ||
        d.id.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q),
    );
  }, [documents, search]);

  const toggle = (id: string) => {
    setLinked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = () => {
    onUpdate(linked);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <GlassCard className="w-full max-w-2xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Link Documents</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-mono text-primary">{pl.plNumber}</span> — {pl.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground/90 hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {linked.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {linked.map((id) => {
              const doc = documents.find((d) => d.id === id);
              return doc ? (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-500/10 border border-teal-500/30 rounded-full text-xs text-primary/90"
                >
                  <FileText className="w-3 h-3" />
                  {doc.id}
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className="ml-0.5 text-muted-foreground hover:text-rose-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ) : null;
            })}
          </div>
        )}

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search documents by ID, name or category..."
            className="pl-10 w-full h-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0 pr-0.5 custom-scrollbar">
          {documentsLoading && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Loading documents...
            </div>
          )}
          {filtered.map((doc) => {
            const isLinked = linked.includes(doc.id);
            return (
              <div
                key={doc.id}
                data-document-id={doc.id}
                data-document-title={doc.name}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${isLinked ? "bg-teal-900/20 border-teal-500/30" : "bg-secondary/30 border-border/40 hover:border-slate-600/60"}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && (() => toggle(doc.id))}
                onClick={() => toggle(doc.id)}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isLinked ? "bg-teal-500/20" : "bg-slate-700/40"}`}
                >
                  <FileText
                    className={`w-4 h-4 ${isLinked ? "text-primary" : "text-muted-foreground"}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{doc.id}</span>
                    <Badge
                      variant={DOC_STATUS_VARIANT[doc.status] ?? "default"}
                      className="text-[9px]"
                    >
                      {doc.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground truncate">{doc.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {doc.category} · Rev {doc.revision} · {doc.size}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isLinked ? (
                    <span className="flex items-center gap-1 text-[10px] text-primary font-medium">
                      <LinkIcon className="w-3 h-3" /> Linked
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <FilePlus className="w-3 h-3" /> Link
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(resolveDocumentPreviewPath(doc.id));
                    }}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-slate-700/50 transition-colors"
                    title="Open preview"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No documents match your search
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-4 pt-4 border-t border-border shrink-0">
          <div className="flex-1 text-xs text-muted-foreground self-center">
            {linked.length} document{linked.length !== 1 ? "s" : ""} linked
          </div>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <LinkIcon className="w-4 h-4" /> Save Links
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}

export default function PLKnowledgeHub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: plItems, loading, error, refetch, update } = usePLItems();
  const { documents, loading: documentsLoading } = usePlLinkableDocuments();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [safetyFilter, setSafetyFilter] = useState("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [linkingPL, setLinkingPL] = useState<PLNumber | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let items = plItems.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        p.plNumber.includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.drawingNumbers.some((d) => d.toLowerCase().includes(q));
      const matchStatus = statusFilter === "ALL" || p.status === statusFilter;
      const matchCat = categoryFilter === "ALL" || p.category === categoryFilter;
      const matchSafety =
        safetyFilter === "ALL" ||
        (safetyFilter === "SAFETY" && p.safetyCritical) ||
        (safetyFilter === "NON_SAFETY" && !p.safetyCritical);
      return matchSearch && matchStatus && matchCat && matchSafety;
    });

    if (sortKey) {
      items = [...items].sort((a, b) => {
        let av: string | number = "";
        let bv: string | number = "";
        if (sortKey === "plNumber") {
          av = a.plNumber;
          bv = b.plNumber;
        } else if (sortKey === "name") {
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
        } else if (sortKey === "category") {
          av = a.category;
          bv = b.category;
        } else if (sortKey === "controllingAgency") {
          av = a.controllingAgency;
          bv = b.controllingAgency;
        } else if (sortKey === "status") {
          av = a.status;
          bv = b.status;
        } else if (sortKey === "docs") {
          av = a.linkedDocumentIds.length;
          bv = b.linkedDocumentIds.length;
        } else if (sortKey === "ecs") {
          av = (a.engineeringChanges ?? []).length;
          bv = (b.engineeringChanges ?? []).length;
        } else if (sortKey === "works") {
          av = (a.linkedWorkIds ?? []).length;
          bv = (b.linkedWorkIds ?? []).length;
        }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    return items;
  }, [plItems, search, statusFilter, categoryFilter, safetyFilter, sortKey, sortDir]);

  const stats = useMemo(
    () => ({
      total: plItems.length,
      active: plItems.filter((p) => p.status === "ACTIVE").length,
      safetyVital: plItems.filter((p) => p.safetyCritical).length,
      underReview: plItems.filter((p) => p.status === "UNDER_REVIEW").length,
    }),
    [plItems],
  );

  const activeFilters = [statusFilter, categoryFilter, safetyFilter].filter(
    (f) => f !== "ALL",
  ).length;

  const handleLinkUpdate = (plId: string, linkedIds: string[]) => {
    update(plId, { linkedDocumentIds: linkedIds });
  };

  const handleCreate = async (data: Partial<PLNumber>) => {
    const draft: PLPreviewPayload = {
      plNumber: data.plNumber ?? "",
      name: data.name ?? "",
      description: data.description ?? "",
      category: data.category ?? "CAT-C",
      controllingAgency: data.controllingAgency ?? "CLW",
      status: (data.status as "ACTIVE" | "UNDER_REVIEW" | "OBSOLETE") ?? "ACTIVE",
      safetyCritical: data.safetyCritical ?? false,
      safetyClassification: data.safetyClassification || undefined,
      severityOfFailure: data.severityOfFailure || undefined,
      consequences: data.consequences || undefined,
      functionality: data.functionality || undefined,
      designSupervisor: data.designSupervisor || undefined,
      concernedSupervisor: data.concernedSupervisor || undefined,
      applicationArea: data.applicationArea || undefined,
      eligibilityCriteria: data.eligibilityCriteria || undefined,
      procurementConditions: data.procurementConditions || undefined,
      drawingNumbers: data.drawingNumbers ?? [],
      specNumbers: data.specNumbers ?? [],
      motherPart: data.motherPart || undefined,
      uvamId: data.uvamId || undefined,
      strNumber: data.strNumber || undefined,
      eOfficeFile: data.eOfficeFile || undefined,
      vendorType: (data.vendorType as "VD" | "NVD") || undefined,
      usedIn: data.usedIn ?? [],
      engineeringChanges: [],
      linkedDocumentIds: [],
      linkedWorkIds: [],
      linkedCaseIds: [],
    };

    const preview = PLPreviewService.createDraft({
      mode: "create",
      baseline: null,
      draft,
      actor: user ?? undefined,
      originPath: "/pl",
    });
    toast.success(`PL review draft ready`, {
      description: `PL-${data.plNumber ?? ""}`,
    });
    navigate(`/pl/preview/${preview.draftId}`);
  };

  if (error)
    return <ErrorState variant="server" message="Failed to load PL records" onRetry={refetch} />;

  const ThCol = ({
    col,
    label,
    className = "",
  }: {
    col: SortKey;
    label: string;
    className?: string;
  }) => (
    <th
      className={`pb-3 text-left font-semibold text-muted-foreground text-xs cursor-pointer select-none group ${className}`}
      onClick={() => handleSort(col)}
    >
      <span className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors">
        {label}
        <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
      </span>
    </th>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">PL Knowledge Hub</h1>
          <p className="text-muted-foreground text-sm">
            Central repository for all parts and components — identified by 8-digit PL numbers.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" /> Create PL Record
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total PL Items",
            value: stats.total,
            icon: <DatabaseBackup className="w-4 h-4 text-primary" />,
          },
          {
            label: "Active",
            value: stats.active,
            icon: <CheckCircle className="w-4 h-4 text-emerald-400" />,
          },
          {
            label: "Safety Vital",
            value: stats.safetyVital,
            icon: <Shield className="w-4 h-4 text-rose-400" />,
          },
          {
            label: "Under Review",
            value: stats.underReview,
            icon: <Clock className="w-4 h-4 text-amber-400" />,
          },
        ].map((s) => (
          <GlassCard
            key={s.label}
            className="p-3 px-4 flex items-center gap-3 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 transition-all duration-200"
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

      <GlassCard className="p-4">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search PL records by number, name, or drawing..."
            className="pl-11 w-full h-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter pills — always visible */}
        <div className="space-y-2 mb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground w-16 shrink-0">
              Status
            </span>
            {["ALL", "ACTIVE", "UNDER_REVIEW", "OBSOLETE"].map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`pill-filter ${statusFilter === s ? "pill-filter-active" : "pill-filter-inactive"}`}
              >
                {s === "ALL" ? "All" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground w-16 shrink-0">
              Category
            </span>
            {["ALL", "CAT-A", "CAT-B", "CAT-C", "CAT-D"].map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`pill-filter ${categoryFilter === c ? "pill-filter-active" : "pill-filter-inactive"}`}
              >
                {c === "ALL" ? "All" : c}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground w-16 shrink-0">
              Safety
            </span>
            {[
              ["ALL", "All"],
              ["SAFETY", "Safety Vital"],
              ["NON_SAFETY", "Standard"],
            ].map(([v, l]) => (
              <button
                type="button"
                key={v}
                onClick={() => setSafetyFilter(v)}
                className={`pill-filter ${safetyFilter === v ? "pill-filter-active" : "pill-filter-inactive"}`}
              >
                {l}
              </button>
            ))}
            {activeFilters > 0 && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("ALL");
                  setCategoryFilter("ALL");
                  setSafetyFilter("ALL");
                }}
                className="text-xs text-muted-foreground hover:text-primary underline transition-colors ml-1"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground mb-4 font-medium">
          Showing <span className="text-primary font-semibold">{filtered.length}</span> of{" "}
          {plItems.length} PL records
          {search && (
            <span className="text-muted-foreground">
              {" "}
              matching "<span className="text-foreground/90">{search}</span>"
            </span>
          )}
        </div>

        {/* Sortable Table */}
        <div className="overflow-x-auto -mx-1 px-1">
          {loading ? (
            <TableSkeleton columns={10} rows={8} className="my-2" />
          ) : (
            <>
              <table className="w-full min-w-[720px] border-separate border-spacing-y-1">
                <thead>
                  <tr>
                    <ThCol col="plNumber" label="PL Number" className="pl-3 w-36" />
                    <ThCol col="name" label="Name" />
                    <ThCol col="category" label="CAT" className="w-20" />
                    <th className="pb-3 text-left font-semibold text-muted-foreground text-xs w-10">
                      <Shield className="w-3.5 h-3.5" />
                    </th>
                    <ThCol col="controllingAgency" label="Agency" className="w-24" />
                    <ThCol col="status" label="Status" className="w-28" />
                    <ThCol col="docs" label="Docs" className="w-14 text-center" />
                    <ThCol col="works" label="Works" className="w-14 text-center" />
                    <ThCol col="ecs" label="ECs" className="w-14 text-center" />
                    <th className="pb-3 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((pl) => (
                    <tr
                      key={pl.id}
                      className="group cursor-pointer"
                      onClick={() => navigate(`/pl/${pl.plNumber}`)}
                    >
                      <td className="py-2.5 pl-3 pr-2 rounded-l-xl bg-secondary/30 group-hover:bg-secondary/50 border-y border-l border-border/30 group-hover:border-teal-500/20 transition-all">
                        <span className="font-mono text-xs text-primary flex items-center gap-1">
                          <Hash className="w-3 h-3 shrink-0" />
                          {pl.plNumber}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 bg-secondary/30 group-hover:bg-secondary/50 border-y border-border/30 group-hover:border-teal-500/20 transition-all max-w-[220px]">
                        <p className="text-sm font-medium text-foreground group-hover:text-teal-200 transition-colors truncate">
                          {pl.name}
                        </p>
                        {pl.description && (
                          <p className="text-[10px] text-slate-600 truncate">{pl.description}</p>
                        )}
                      </td>
                      <td className="py-2.5 px-2 bg-secondary/30 group-hover:bg-secondary/50 border-y border-border/30 group-hover:border-teal-500/20 transition-all">
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${CATEGORY_COLORS[pl.category] ?? "bg-slate-700/50 text-muted-foreground border-slate-600"}`}
                        >
                          {pl.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 bg-secondary/30 group-hover:bg-secondary/50 border-y border-border/30 group-hover:border-teal-500/20 transition-all">
                        {pl.safetyCritical && (
                          <span title="Safety Vital">
                            <Shield className="w-3.5 h-3.5 text-rose-400" />
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 bg-secondary/30 group-hover:bg-secondary/50 border-y border-border/30 group-hover:border-teal-500/20 transition-all">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-600 shrink-0" />
                          {pl.controllingAgency || "—"}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 bg-secondary/30 group-hover:bg-secondary/50 border-y border-border/30 group-hover:border-teal-500/20 transition-all">
                        <Badge variant={STATUS_VARIANT[pl.status] ?? "default"}>
                          {STATUS_LABEL[pl.status] ?? pl.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 bg-secondary/30 group-hover:bg-secondary/50 border-y border-border/30 group-hover:border-teal-500/20 transition-all text-center">
                        <span
                          className={`text-xs font-semibold ${pl.linkedDocumentIds.length > 0 ? "text-primary" : "text-slate-600"}`}
                        >
                          {pl.linkedDocumentIds.length}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 bg-secondary/30 group-hover:bg-secondary/50 border-y border-border/30 group-hover:border-teal-500/20 transition-all text-center">
                        <span
                          className={`text-xs font-semibold ${(pl.linkedWorkIds?.length ?? 0) > 0 ? "text-blue-400" : "text-slate-600"}`}
                        >
                          {pl.linkedWorkIds?.length ?? 0}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 bg-secondary/30 group-hover:bg-secondary/50 border-y border-border/30 group-hover:border-teal-500/20 transition-all text-center">
                        <span
                          className={`text-xs font-semibold ${(pl.engineeringChanges?.length ?? 0) > 0 ? "text-amber-400" : "text-slate-600"}`}
                        >
                          {pl.engineeringChanges?.length ?? 0}
                        </span>
                      </td>
                      <td className="py-2.5 pl-2 pr-3 rounded-r-xl bg-secondary/30 group-hover:bg-secondary/50 border-y border-r border-border/30 group-hover:border-teal-500/20 transition-all">
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLinkingPL(pl);
                            }}
                            title="Link / Unlink Documents"
                            className={`w-6 h-6 flex items-center justify-center rounded-lg border transition-all ${
                              pl.linkedDocumentIds.length > 0
                                ? "bg-teal-500/10 border-teal-500/30 text-primary hover:bg-teal-500/20"
                                : "bg-secondary/50 border-border/40 text-slate-600 hover:text-foreground/90 hover:border-slate-600"
                            }`}
                          >
                            <LinkIcon className="w-3 h-3" />
                          </button>
                          <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-primary transition-colors" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filtered.length === 0 && (
                <EmptyState
                  icon={DatabaseBackup}
                  title="No PL records match"
                  description="Try adjusting your search or filters"
                  action={
                    <>
                      {activeFilters > 0 && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setStatusFilter("ALL");
                            setCategoryFilter("ALL");
                            setSafetyFilter("ALL");
                          }}
                        >
                          Clear Filters
                        </Button>
                      )}
                      <Button size="sm" onClick={() => setShowCreateModal(true)}>
                        <Plus className="w-3.5 h-3.5" /> Create PL Record
                      </Button>
                    </>
                  }
                />
              )}
            </>
          )}
        </div>
      </GlassCard>

      {showCreateModal && (
        <PLFormModal
          mode="create"
          onClose={() => setShowCreateModal(false)}
          onSave={async (patch) => {
            await handleCreate(patch);
          }}
          plItems={plItems}
        />
      )}

      {linkingPL && (
        <LinkDocumentsModal
          pl={linkingPL}
          onClose={() => setLinkingPL(null)}
          onUpdate={(linkedIds) => {
            handleLinkUpdate(linkingPL.id, linkedIds);
          }}
          documents={documents}
          documentsLoading={documentsLoading}
        />
      )}
    </div>
  );
}
