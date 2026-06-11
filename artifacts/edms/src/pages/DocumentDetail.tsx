import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  DocumentPreviewButton,
  getDocumentContextAttributes,
} from "../components/documents/DocumentPreviewActions";
import { PLNumberSelect } from "../components/ui/PLNumberSelect";
import { Badge, Button, GlassCard } from "../components/ui/Shared";
import { useDocTabs } from "../contexts/DocTabsContext";
import { usePLItems } from "../hooks/usePLItems";
import { PL_DATABASE } from "../lib/bomData";
import { MOCK_DOCUMENTS } from "../lib/mock";
import { ApprovalService } from "../services/ApprovalService";
import { type OcrJobRecord, OcrJobService } from "../services/OcrJobService";
import { RecentDocumentsService } from "../services/RecentDocumentsService";

type DocRecord = {
  id: string;
  name: string;
  type: string;
  size: string;
  revision: string;
  status: string;
  author: string;
  owner: string;
  date: string;
  linkedPL: string;
  ocrStatus: string;
  ocrConfidence: number | null;
  ocrText?: string;
  category: string;
  lifecycle: string;
  pages: number;
  tags: string[];
};

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileCode,
  FileImage,
  FileSearch,
  FileText,
  GitCompare,
  Hash,
  History,
  Info,
  Layers,
  Loader2,
  Maximize2,
  Paperclip,
  Plus,
  RefreshCw,
  RotateCw,
  ScanText,
  Send,
  Shield,
  Tag,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

const PANEL_LS_KEY = "edms_doc_panel_state";

function loadPanelState() {
  try {
    const raw = localStorage.getItem(PANEL_LS_KEY);
    if (raw) return JSON.parse(raw) as { leftOpen: boolean; rightOpen: boolean };
  } catch {
    /* ignore */
  }
  return { leftOpen: true, rightOpen: true };
}

function savePanelState(state: { leftOpen: boolean; rightOpen: boolean }) {
  localStorage.setItem(PANEL_LS_KEY, JSON.stringify(state));
}

const statusVariant = (s: string) => {
  if (["Approved", "APPROVED", "ACTIVE"].includes(s)) return "success" as const;
  if (["In Review", "UNDER_REVIEW", "Draft", "DRAFT"].includes(s)) return "warning" as const;
  if (["Obsolete", "OBSOLETE"].includes(s)) return "danger" as const;
  return "default" as const;
};

const ocrVariant = (s: string) => {
  if (s === "Completed" || s === "COMPLETED") return "success" as const;
  if (s === "Processing" || s === "PROCESSING") return "processing" as const;
  if (s === "Failed" || s === "FAILED") return "danger" as const;
  return "default" as const;
};

const PATTERNS = [
  { type: "pl", regex: /\b\d{8}\b/g, prefix: "/pl/", label: "PL" },
  { type: "dwg", regex: /\bDWG-[\w-]+/g, prefix: null, label: "DWG" },
  { type: "spec", regex: /\bSPC-[\w-]+/g, prefix: null, label: "SPC" },
  {
    type: "doc",
    regex: /\bDOC-\d{4}-\d{4}\b/g,
    prefix: "/documents/",
    label: "DOC",
  },
];

interface OcrRef {
  text: string;
  type: string;
  prefix: string | null;
}

function detectRefs(text: string): OcrRef[] {
  const refs: OcrRef[] = [];
  const seen = new Set<string>();
  for (const p of PATTERNS) {
    const matches = text.match(new RegExp(p.regex.source, "g")) ?? [];
    for (const m of matches) {
      if (!seen.has(m)) {
        seen.add(m);
        refs.push({ text: m, type: p.type, prefix: p.prefix });
      }
    }
  }
  return refs;
}

function renderOcrWithLinks(
  text: string,
  query: string,
  onNavigate: (path: string) => void,
): React.ReactNode[] {
  const allPatterns = PATTERNS.map((p) => `(${p.regex.source})`).join("|");
  const combined = new RegExp(allPatterns, "g");
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  const highlightQuery = (chunk: string) => {
    if (!query) return [chunk];
    const qi = chunk.toLowerCase().indexOf(query.toLowerCase());
    if (qi < 0) return [chunk];
    return [
      chunk.slice(0, qi),
      <mark key={`h-${key++}`} className="bg-teal-500/25 text-teal-200 rounded-sm px-0.5">
        {chunk.slice(qi, qi + query.length)}
      </mark>,
      chunk.slice(qi + query.length),
    ];
  };

  while ((match = combined.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before) parts.push(...highlightQuery(before));
    const matched = match[0];
    let path: string | null = null;
    let refColor =
      "text-blue-300 hover:text-blue-200 underline decoration-dotted underline-offset-2";
    if (/^\d{8}$/.test(matched)) {
      path = `/pl/${matched}`;
      refColor =
        "text-indigo-300 hover:text-indigo-200 underline decoration-dotted underline-offset-2";
    } else if (/^DOC-/.test(matched)) {
      path = `/documents/${matched}`;
      refColor =
        "text-primary/90 hover:text-teal-200 underline decoration-dotted underline-offset-2";
    }
    if (path) {
      parts.push(
        <button
          type="button"
          key={key++}
          onClick={() => onNavigate(path!)}
          className={`font-mono text-xs ${refColor} transition-colors cursor-pointer`}
          title={`Navigate to ${matched}`}
        >
          {matched}
        </button>,
      );
    } else {
      parts.push(
        <span key={key++} className="font-mono text-xs text-amber-300 bg-amber-900/20 px-1 rounded">
          {matched}
        </span>,
      );
    }
    lastIndex = match.index + matched.length;
  }
  if (lastIndex < text.length) parts.push(...highlightQuery(text.slice(lastIndex)));
  return parts;
}

function DocumentViewer({
  doc,
  zoom,
  rotation,
  currentPage,
  pageCount,
}: {
  doc: DocRecord | null;
  zoom: number;
  rotation: number;
  currentPage: number;
  pageCount: number;
}) {
  const getFileIcon = () => {
    if (!doc) return <FileText className="w-16 h-16 text-muted-foreground" />;
    const t = doc.type?.toUpperCase();
    if (t === "PDF") return <FileText className="w-16 h-16 text-rose-400/60" />;
    if (["PNG", "JPG", "JPEG", "SVG"].includes(t))
      return <FileImage className="w-16 h-16 text-blue-400/60" />;
    return <FileCode className="w-16 h-16 text-amber-400/60" />;
  };

  return (
    <div
      className="w-full h-full flex items-center justify-center overflow-hidden bg-card/40 rounded-xl"
      style={{
        transform: `scale(${zoom}) rotate(${rotation}deg)`,
        transformOrigin: "center center",
        transition: "transform 0.2s ease",
      }}
    >
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center max-w-sm">
        {getFileIcon()}
        {doc ? (
          <>
            <div>
              <p className="text-foreground/90 font-semibold text-sm">{doc.name}</p>
              <p className="text-muted-foreground text-xs mt-1 font-mono">{doc.id}</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                {doc.type} · {doc.size}
              </span>
              <span>
                Page {currentPage} of {pageCount}
              </span>
            </div>
            <div className="px-4 py-2 bg-secondary/60 border border-border/40 rounded-xl text-xs text-muted-foreground leading-relaxed">
              Viewer placeholder — in production, renders the actual PDF/image with annotations and
              OCR overlay.
            </div>
            {doc.ocrStatus === "Completed" && doc.ocrConfidence && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-900/20 border border-teal-500/20 rounded-lg text-xs text-primary/90">
                <ScanText className="w-3.5 h-3.5" /> OCR {doc.ocrConfidence}% confidence
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">No document selected</p>
        )}
      </div>
    </div>
  );
}

function PageNavPanel({
  pageCount,
  currentPage,
  onPageChange,
}: {
  pageCount: number;
  currentPage: number;
  onPageChange: (p: number) => void;
}) {
  return (
    <div className="space-y-1.5 custom-scrollbar overflow-y-auto flex-1">
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
        <button
          type="button"
          key={p}
          onClick={() => onPageChange(p)}
          className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all ${
            currentPage === p
              ? "bg-teal-500/15 border border-teal-500/25 text-primary/90"
              : "text-muted-foreground hover:bg-secondary/50 border border-transparent"
          }`}
        >
          <div
            className={`w-full h-16 rounded-lg mb-1.5 flex items-center justify-center ${currentPage === p ? "bg-teal-900/30" : "bg-secondary/40"} border border-border`}
          >
            <FileText
              className={`w-5 h-5 ${currentPage === p ? "text-primary" : "text-muted-foreground"}`}
            />
          </div>
          <span className="font-medium">Page {p}</span>
        </button>
      ))}
    </div>
  );
}

interface OcrPanelProps {
  text: string;
  query: string;
  onQueryChange: (q: string) => void;
  onNavigate: (path: string) => void;
}

function OcrPanel({ text, query, onQueryChange, onNavigate }: OcrPanelProps) {
  const [copied, setCopied] = useState(false);
  const refs = detectRefs(text);
  return (
    <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
      <div className="relative">
        <FileSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search OCR text..."
          aria-label="Search OCR text"
          className="w-full pl-8 pr-3 text-xs bg-background/80 border border-border/50 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/40 h-9"
        />
      </div>
      {refs.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
            Detected References ({refs.length})
          </p>
          <div className="space-y-1">
            {refs.map((r, i) => (
              <button
                type="button"
                key={i}
                onClick={() => (r.prefix ? onNavigate(r.prefix + r.text) : undefined)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-all border ${
                  r.prefix
                    ? "bg-teal-900/20 border-teal-500/20 text-primary/90 hover:bg-teal-900/30 cursor-pointer"
                    : "bg-amber-900/15 border-amber-500/20 text-amber-300 cursor-default"
                }`}
              >
                <Hash className="w-3 h-3 shrink-0" />
                <span className="font-mono flex-1 truncate">{r.text}</span>
                {r.prefix && <ChevronRight className="w-3 h-3 shrink-0 text-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}
      {text ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">{text.split(" ").length} words</p>
            <button
              type="button"
              onClick={() =>
                navigator.clipboard.writeText(text).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                })
              }
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/60 hover:bg-secondary/60 text-muted-foreground hover:text-foreground text-[10px] transition-colors border border-border/40"
            >
              {copied ? (
                <CheckCheck className="w-3 h-3 text-primary" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="text-[10px] text-muted-foreground bg-card border border-border/40 rounded-xl p-3 leading-relaxed overflow-auto whitespace-pre-wrap font-mono max-h-80">
            {renderOcrWithLinks(text, query, onNavigate)}
          </pre>
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground">
          <ScanText className="w-6 h-6 mx-auto mb-2 opacity-40" />
          <p className="text-xs">No OCR text available</p>
        </div>
      )}
    </div>
  );
}

interface RightPanelProps {
  doc: DocRecord | null;
  ocrJob: OcrJobRecord | null;
  ocrStatusOverride?: string;
  onNavigate: (path: string) => void;
  activeSection: string;
  onSectionChange: (s: string) => void;
}

function RightPanel({
  doc,
  ocrJob,
  ocrStatusOverride,
  onNavigate,
  activeSection,
  onSectionChange,
}: RightPanelProps) {
  const navigate = useNavigate();
  const [panelToast, setPanelToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setPanelToast(msg);
    setTimeout(() => setPanelToast(null), 3000);
  };

  const plRecord =
    doc?.linkedPL && doc.linkedPL !== "N/A" ? PL_DATABASE[doc.linkedPL.replace("PL-", "")] : null;

  const relatedDocs = MOCK_DOCUMENTS.filter(
    (d) =>
      d.id !== doc?.id &&
      ((doc?.linkedPL && d.linkedPL === doc.linkedPL) ||
        (doc?.tags && d.tags?.some((t: string) => doc.tags?.includes(t)))),
  ).slice(0, 4);

  const revHistory = [
    {
      rev: doc?.revision ?? "A.0",
      date: doc?.date ?? "—",
      author: doc?.author ?? "—",
      note: "Current revision",
    },
    {
      rev: "B.0",
      date: "2025-12-01",
      author: doc?.author ?? "—",
      note: "Previous revision",
    },
    {
      rev: "A.0",
      date: "2025-06-01",
      author: "System",
      note: "Initial release",
    },
  ];

  const sections = [
    { id: "meta", icon: Info, label: "Metadata" },
    { id: "tags", icon: Tag, label: "Tags" },
    { id: "pl", icon: Layers, label: "PL Info" },
    { id: "used", icon: Users, label: "Used In" },
    { id: "related", icon: BookOpen, label: "Related" },
    { id: "history", icon: History, label: "Revisions" },
  ];

  const effectiveOcrStatus = ocrStatusOverride ?? ocrJob?.status;

  return (
    <div className="flex flex-col h-full">
      {panelToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-card/95 backdrop-blur-xl border border-teal-500/30 shadow-2xl text-xs text-foreground slide-in-right">
          <span>{panelToast}</span>
        </div>
      )}
      <div className="grid grid-cols-3 gap-1 mb-3 shrink-0">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <button
              type="button"
              key={s.id}
              onClick={() => onSectionChange(s.id)}
              className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                activeSection === s.id
                  ? "bg-teal-500/15 text-primary/90 border border-teal-500/25"
                  : "text-muted-foreground hover:text-foreground/90 border border-transparent hover:bg-secondary/40"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
        {activeSection === "meta" && doc && (
          <>
            <div className="space-y-2">
              {(
                [
                  { label: "Document ID", value: doc.id, mono: true },
                  { label: "Category", value: doc.category },
                  { label: "Revision", value: doc.revision, mono: true },
                  { label: "File Type", value: doc.type },
                  { label: "Size", value: doc.size },
                  { label: "Pages", value: String(doc.pages ?? 1) },
                  { label: "Author", value: doc.author },
                  { label: "Owner", value: doc.owner },
                  { label: "Date", value: doc.date },
                  { label: "Lifecycle", value: doc.lifecycle },
                ] as { label: string; value: string; mono?: boolean }[]
              ).map((f) => (
                <div
                  key={f.label}
                  className="flex items-start justify-between gap-2 py-1.5 border-b border-white/[0.04]"
                >
                  <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                    {f.label}
                  </span>
                  <span
                    className={`text-xs text-foreground text-right ${f.mono ? "font-mono text-primary" : ""}`}
                  >
                    {f.value}
                  </span>
                </div>
              ))}
            </div>
            {ocrJob && (
              <div className="bg-card/40 border border-border/50 rounded-xl p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  OCR Status
                </p>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={ocrVariant(effectiveOcrStatus ?? "")}>{effectiveOcrStatus}</Badge>
                  {ocrJob.confidence && !ocrStatusOverride && (
                    <span className="text-xs text-muted-foreground">
                      {ocrJob.confidence}% confidence
                    </span>
                  )}
                </div>
                {ocrJob.failureReason && !ocrStatusOverride && (
                  <p className="text-[10px] text-rose-300 bg-rose-900/20 border border-rose-500/20 rounded-lg p-2">
                    {ocrJob.failureReason}
                  </p>
                )}
                {ocrJob.extractedRefs > 0 && !ocrStatusOverride && (
                  <p className="text-[10px] text-muted-foreground">
                    {ocrJob.extractedRefs} references extracted
                  </p>
                )}
                {ocrStatusOverride && (
                  <p className="text-[10px] text-blue-300 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Re-running OCR…
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {activeSection === "tags" && doc && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {(doc.tags ?? []).map((tag: string) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 bg-secondary/60 border border-border/40 rounded-full text-xs text-foreground/90"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Badge variant={statusVariant(doc.status)}>{doc.status}</Badge>
              <span className="inline-flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full shrink-0 ${doc.lifecycle === "Active" ? "bg-emerald-500" : doc.lifecycle === "Draft" ? "bg-amber-500" : "bg-gray-400"}`} />
                <Badge variant="default" className="text-muted-foreground">
                  {doc.lifecycle}
                </Badge>
              </span>
            </div>
          </div>
        )}

        {activeSection === "pl" &&
          (plRecord ? (
            <div className="space-y-3">
              <div className="bg-card/40 border border-border/50 rounded-xl p-3 space-y-2">
                {plRecord.safetyVital && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                    <Shield className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="text-xs text-rose-300 font-medium">Safety Vital</span>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-muted-foreground">PL Number</p>
                  <p className="font-mono text-sm font-semibold text-primary flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {plRecord.plNumber}
                  </p>
                </div>
                {(
                  [
                    { label: "Name", value: plRecord.name },
                    { label: "Owner", value: plRecord.owner },
                    { label: "Dept", value: plRecord.department },
                    { label: "Lifecycle", value: plRecord.lifecycleState },
                    { label: "Revision", value: plRecord.revision },
                  ] as { label: string; value: string }[]
                ).map((f) => (
                  <div key={f.label}>
                    <p className="text-[10px] text-muted-foreground">{f.label}</p>
                    <p className="text-xs text-foreground">{f.value}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => navigate(`/pl/${plRecord.plNumber}`)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-primary/90 text-xs hover:bg-teal-500/15 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View Full PL Record
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No PL record linked</p>
              {doc?.linkedPL && doc.linkedPL !== "N/A" && (
                <p className="text-[10px] text-muted-foreground mt-1 font-mono">{doc.linkedPL}</p>
              )}
            </div>
          ))}

        {activeSection === "used" && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Products Using This Document
            </p>
            {plRecord?.whereUsed && plRecord.whereUsed.length > 0 ? (
              plRecord.whereUsed.map((w, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-card/20 border border-border/50"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground font-medium truncate">{w.parentName}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {w.parentPL} · Find #{w.findNumber}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">×{w.quantity}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No usage data available</p>
              </div>
            )}
          </div>
        )}

        {activeSection === "related" && (
          <div className="space-y-2">
            {relatedDocs.length > 0 ? (
              relatedDocs.map((rd) => (
                <div
                  key={rd.id}
                  {...getDocumentContextAttributes(rd.id, rd.name)}
                  role="button"
                  tabIndex={0}
                  onClick={() => onNavigate(`/documents/${rd.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onNavigate(`/documents/${rd.id}`);
                    }
                  }}
                  className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-card/20 border border-border/50 hover:border-teal-500/20 hover:bg-card transition-all text-left cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground truncate">{rd.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{rd.id}</p>
                  </div>
                  <DocumentPreviewButton
                    documentId={rd.id}
                    title={rd.name}
                    iconOnly
                    className="h-7 min-h-0 px-2 text-foreground/90 hover:text-teal-200"
                  />
                  <Badge variant={statusVariant(rd.status)} className="text-[9px] px-1.5 shrink-0">
                    {rd.status}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No related documents found</p>
              </div>
            )}
          </div>
        )}

        {activeSection === "history" && (
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">
                Revision History
              </span>
              <span className="text-[10px] text-muted-foreground">{revHistory.length} revisions</span>
            </div>
            {revHistory.map((r, i) => (
              <div key={i} className="flex gap-3 group">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${i === 0 ? "bg-teal-500/30 border border-teal-500/60 text-primary/90" : "bg-secondary border border-border text-muted-foreground"}`}
                  >
                    {i === 0 ? "●" : "○"}
                  </div>
                  {i < revHistory.length - 1 && (
                    <div className="w-px flex-1 bg-secondary/40 my-1" />
                  )}
                </div>
                <div className="flex-1 pb-3">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-mono text-xs text-primary font-semibold">
                      Rev {r.rev}
                    </span>
                    {i === 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-teal-500/15 text-primary rounded-full border border-teal-500/25">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-1">{r.note}</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1.5">
                    <Calendar className="w-3 h-3" />
                    {r.date}
                    <span>·</span>
                    <span>{r.author}</span>
                  </div>
                  {i > 0 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary/60 border border-border/40 text-[10px] text-muted-foreground hover:text-primary/90 hover:border-teal-500/30 transition-colors"
                        onClick={() =>
                          showToast(`Comparing Rev ${revHistory[0].rev} with Rev ${r.rev}…`)
                        }
                      >
                        Compare with Current
                      </button>
                      <button
                        type="button"
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-[10px] text-amber-400 hover:bg-amber-500/20 transition-colors"
                        onClick={() =>
                          showToast(`Rollback to Rev ${r.rev} initiated — pending approval.`)
                        }
                      >
                        Rollback
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface EditMetaFormData {
  revision: string;
  status: string;
  linkedPL: string;
  tags: string;
}

function EditMetadataSlideOver({
  doc,
  onClose,
  onSave,
}: {
  doc: DocRecord;
  onClose: () => void;
  onSave: (data: EditMetaFormData) => void;
}) {
  const { data: plItems, loading: plItemsLoading } = usePLItems();
  const [form, setForm] = useState<EditMetaFormData>({
    revision: doc.revision,
    status: doc.status,
    linkedPL: doc.linkedPL,
    tags: (doc.tags ?? []).join(", "),
  });

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      {/* Slide-over */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-96 bg-card/90 backdrop-blur-xl border-l border-border/50 shadow-2xl flex flex-col slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 shrink-0">
          <div>
            <p className="text-xs text-muted-foreground font-mono mb-0.5">{doc.id}</p>
            <h2 className="text-sm font-semibold text-foreground">Edit Metadata</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
          <div>
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">Revision</span>
            <input
              value={form.revision}
              onChange={(e) => setForm((f) => ({ ...f, revision: e.target.value }))}
              aria-label="Revision"
              className="w-full px-3 py-2 bg-secondary/60 border border-border/60 focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 rounded-xl text-sm text-foreground font-mono outline-none transition-all"
              placeholder="e.g. C.2"
            />
          </div>

          <div>
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">Status</span>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2 bg-secondary/60 border border-border/60 focus:border-teal-500/50 rounded-xl text-sm text-foreground outline-none transition-all cursor-pointer"
            >
              {["Draft", "In Review", "Approved", "Obsolete"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">
              Linked PL Number
            </span>
            <PLNumberSelect
              value={form.linkedPL === "N/A" ? "" : form.linkedPL.replace(/^PL-/, "")}
              onChange={(linkedPL) =>
                setForm((f) => ({
                  ...f,
                  linkedPL: linkedPL ? `PL-${linkedPL}` : "N/A",
                }))
              }
              plItems={plItems}
              loading={plItemsLoading}
              placeholder="Search and select a linked PL..."
              helperText="Link the document to one controlled PL record or clear the selection if the file is not PL-bound."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Tags <span className="text-muted-foreground">(comma-separated)</span>
            </label>
            <textarea
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 bg-secondary/60 border border-border/60 focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 rounded-xl text-sm text-foreground outline-none transition-all resize-none"
              placeholder="e.g. Electrical, Schematic, Safety Vital"
            />
            {/* Tag preview */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {form.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
                .map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-secondary/60 border border-border rounded-full text-[11px] text-foreground/90"
                  >
                    {tag}
                  </span>
                ))}
            </div>
          </div>

          <div className="bg-card border-border rounded-xl p-3 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Read-only fields
            </p>
            {[
              { label: "Document ID", value: doc.id },
              { label: "Author", value: doc.author },
              { label: "Category", value: doc.category },
              { label: "File Type", value: doc.type },
            ].map((f) => (
              <div key={f.label} className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{f.label}</span>
                <span className="text-[11px] text-muted-foreground font-mono">{f.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-white/8 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl bg-secondary/60 hover:bg-secondary/60 text-foreground/90 text-sm border border-border transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-sm font-medium shadow-md shadow-teal-900/30 border border-teal-400/20 transition-all"
          >
            <Check className="w-3.5 h-3.5" /> Save Changes
          </button>
        </div>
      </div>
    </>
  );
}

function ApprovalDialog({
  doc,
  onClose,
  onConfirm,
}: {
  doc: DocRecord;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[420px] bg-card/98 backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
            <Send className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-0.5">Route for Approval</h3>
            <p className="text-xs text-muted-foreground">
              This will submit the document for the standard approval workflow.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-muted-foreground hover:text-foreground/90 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-card border-border rounded-xl p-3 mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Document</span>
            <span className="text-[11px] text-primary font-mono">{doc.id}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Current status</span>
            <Badge variant={statusVariant(doc.status)} className="text-[10px]">
              {doc.status}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Revision</span>
            <span className="text-[11px] text-foreground/90 font-mono">{doc.revision}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Approver</span>
            <span className="text-[11px] text-foreground/90">Section Head</span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/8 border border-amber-500/20 rounded-xl mb-4">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300">
            The document status will change to <strong>In Review</strong> once submitted.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl bg-secondary/60 hover:bg-secondary/60 text-foreground/90 text-sm border border-border transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-sm font-medium border border-amber-500/30 transition-colors"
          >
            <Send className="w-3.5 h-3.5" /> Submit for Approval
          </button>
        </div>
      </div>
    </>
  );
}

function Toast({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-4 py-3 rounded-xl bg-card/95 backdrop-blur-xl border border-teal-500/30 shadow-2xl shadow-black/60 text-sm text-foreground slide-in-right">
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

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { openTab, tabs: openTabs } = useDocTabs();

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [ocrQuery, setOcrQuery] = useState(() => searchParams.get("q") ?? "");
  const [rightSection, setRightSection] = useState("meta");
  const [leftSection, setLeftSection] = useState<"pages" | "ocr">("pages");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Collapsible panels with localStorage persistence
  const [leftOpen, setLeftOpen] = useState(() => loadPanelState().leftOpen);
  const [rightOpen, setRightOpen] = useState(() => loadPanelState().rightOpen);

  const toggleLeft = () =>
    setLeftOpen((v) => {
      const next = !v;
      savePanelState({ leftOpen: next, rightOpen });
      return next;
    });
  const toggleRight = () =>
    setRightOpen((v) => {
      const next = !v;
      savePanelState({ leftOpen, rightOpen: next });
      return next;
    });

  // Doc metadata overrides (for Edit Metadata)
  const [docOverrides, setDocOverrides] = useState<Map<string, Partial<DocRecord>>>(new Map());
  // OCR status overrides (for Rerun OCR)
  const [ocrOverrides, setOcrOverrides] = useState<Map<string, string>>(new Map());
  const [ocrJob, setOcrJob] = useState<OcrJobRecord | null>(null);

  // Modals
  const [showEditMeta, setShowEditMeta] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Additively register the current doc in the session-level tab list;
  // also seed ocrQuery from the URL ?q= param when changing docs
  useEffect(() => {
    if (!id) return;
    const currentDocName = MOCK_DOCUMENTS.find((d) => d.id === id)?.name;
    openTab(id, currentDocName);
    // Record view in recently viewed documents
    const doc = MOCK_DOCUMENTS.find((d) => d.id === id);
    if (doc) {
      RecentDocumentsService.record(id, doc.name, doc.type);
    }
    setZoom(1);
    setRotation(0);
    setCurrentPage(1);
    const q = searchParams.get("q") ?? "";
    setOcrQuery(q);
    // If a search term is passed, default the left panel to OCR view
    if (q) setLeftSection("ocr");
  }, [id, openTab, searchParams]);

  // Open another doc in the context tab list and navigate to it
  const openLinkedDoc = (docId: string) => {
    const linkedDocName = MOCK_DOCUMENTS.find((d) => d.id === docId)?.name;
    openTab(docId, linkedDocName);
    navigate(`/documents/${docId}`);
  };

  // Active doc always determined by URL param — no local activeTabId
  const activeTabId = id ?? "";
  useEffect(() => {
    let cancelled = false;

    if (!activeTabId) {
      setOcrJob(null);
      return;
    }

    void OcrJobService.getLatestForDocument(activeTabId).then((job) => {
      if (!cancelled) {
        setOcrJob(job);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeTabId]);

  const baseDoc =
    (MOCK_DOCUMENTS.find((d) => d.id === activeTabId) as DocRecord | undefined) ?? null;
  const docOverride = docOverrides.get(activeTabId) ?? {};
  const activeDoc: DocRecord | null = baseDoc ? { ...baseDoc, ...docOverride } : null;
  const ocrText = activeDoc?.ocrText ?? "";
  const pageCount = (baseDoc as DocRecord | null)?.pages ?? 1;
  const ocrStatusOverride = ocrOverrides.get(activeTabId);
  const effectiveOcrStatus = ocrStatusOverride ?? ocrJob?.status ?? activeDoc?.ocrStatus ?? "";
  const ocrProcessing = effectiveOcrStatus === "Processing" || effectiveOcrStatus === "PROCESSING";

  const handleDownload = () => showToast(`Downloading "${activeDoc?.name ?? activeTabId}"…`);

  const handleSaveMetadata = (data: EditMetaFormData) => {
    const tags = data.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    setDocOverrides((prev) => {
      const next = new Map(prev);
      next.set(activeTabId, {
        ...docOverride,
        revision: data.revision,
        status: data.status,
        linkedPL: data.linkedPL,
        tags,
      });
      return next;
    });
    setShowEditMeta(false);
    showToast("Metadata saved successfully.");
  };

  const handleRouteForApproval = async () => {
    if (!activeDoc) {
      return;
    }

    try {
      const additions = await ApprovalService.queueDocumentApprovals([
        {
          id: activeDoc.id,
          name: activeDoc.name,
          author: activeDoc.author,
          linkedPL: activeDoc.linkedPL,
          ocrStatus: activeDoc.ocrStatus,
        },
      ]);
      const approvals = await ApprovalService.getAll();
      const targetApprovalId =
        additions[0]?.id ?? approvals.find((approval) => approval.linkedDoc === activeDoc.id)?.id;

      setDocOverrides((prev) => {
        const next = new Map(prev);
        next.set(activeTabId, { ...docOverride, status: "In Review" });
        return next;
      });
      setShowApproval(false);
      navigate(targetApprovalId ? `/approvals?id=${targetApprovalId}` : "/approvals");
    } catch (error) {
      console.error("[DocumentDetail] Failed to queue approval", error);
      showToast("Could not route this document for approval.");
    }
  };

  const handleRerunOcr = async () => {
    if (!activeDoc) {
      return;
    }

    setOcrOverrides((prev) => {
      const next = new Map(prev);
      next.set(activeTabId, "Processing");
      return next;
    });

    try {
      const nextJob = await OcrJobService.queueRetry(activeTabId);
      setOcrJob(nextJob);
      setOcrOverrides((prev) => {
        const next = new Map(prev);
        next.delete(activeTabId);
        return next;
      });
      showToast("OCR re-run queued and sent to the monitor.");
    } catch (error) {
      console.error("[DocumentDetail] Failed to re-queue OCR", error);
      setOcrOverrides((prev) => {
        const next = new Map(prev);
        next.delete(activeTabId);
        return next;
      });
      showToast("Could not queue an OCR re-run for this document.");
    }
  };

  const handleNavigate = (path: string) => {
    if (path.startsWith("/documents/")) {
      openLinkedDoc(path.replace("/documents/", ""));
    } else {
      navigate(path);
    }
  };

  if (!activeDoc) {
    return (
      <div className="flex items-center justify-center h-64">
        <GlassCard className="p-12 text-center">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="text-foreground/90 font-medium">Document not found</p>
          <p className="text-muted-foreground text-sm mb-4">
            The document "{id}" does not exist in this system.
          </p>
          <Button onClick={() => navigate("/documents")}>
            <ArrowLeft className="w-4 h-4" /> Back to Document Hub
          </Button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-[calc(100vh-120px)] ${isFullscreen ? "fixed inset-0 z-50 h-screen bg-popover" : ""}`}
    >
      {toast && <Toast msg={toast} onDismiss={() => setToast(null)} />}
      {showEditMeta && activeDoc && (
        <EditMetadataSlideOver
          doc={activeDoc}
          onClose={() => setShowEditMeta(false)}
          onSave={handleSaveMetadata}
        />
      )}
      {showApproval && activeDoc && (
        <ApprovalDialog
          doc={activeDoc}
          onClose={() => setShowApproval(false)}
          onConfirm={handleRouteForApproval}
        />
      )}

      {/* Action bar — grouped with separators */}
      <div className="flex items-center px-1 pb-2 shrink-0 overflow-x-auto border-b border-border">
        {/* Group 1: Navigation */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => navigate("/documents")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-muted-foreground hover:text-primary transition-colors text-xs rounded-lg hover:bg-secondary/40"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Hub
          </button>
          <button
            type="button"
            onClick={() => {
              const next = MOCK_DOCUMENTS.find((d) => !openTabs.find((t) => t.id === d.id));
              if (next) openLinkedDoc((next as { id: string }).id);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 text-muted-foreground hover:text-primary transition-colors text-xs rounded-lg hover:bg-secondary/40 border border-dashed border-border/40 hover:border-teal-500/30"
          >
            <Plus className="w-3.5 h-3.5" /> Open Another
          </button>
        </div>

        {/* Separator */}
        <div className="mx-2.5 h-5 w-px bg-border/60 shrink-0" />

        {/* Group 2: View / Download */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary/60 text-foreground/90 text-xs border border-border/40 hover:border-teal-500/30 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-primary" /> Download
          </button>
          <DocumentPreviewButton
            documentId={activeDoc.id}
            title={activeDoc.name}
            size="sm"
            variant="ghost"
            className="px-2.5 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary/60 text-foreground/90 text-xs border border-border/40 hover:border-teal-500/30"
            label="Preview"
            stopPropagation={false}
          />
        </div>

        {/* Separator */}
        <div className="mx-2.5 h-5 w-px bg-border/60 shrink-0" />

        {/* Group 3: Edit / Approval */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setShowEditMeta(true)}
            disabled={!activeDoc}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary/60 text-foreground/90 text-xs border border-border/40 hover:border-indigo-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Edit3 className="w-3.5 h-3.5 text-indigo-400" /> Edit Metadata
          </button>
          <button
            type="button"
            onClick={() => setShowApproval(true)}
            disabled={!activeDoc}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary/60 text-foreground/90 text-xs border border-border/40 hover:border-amber-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5 text-amber-400" /> Route for Approval
          </button>
        </div>

        {/* Separator */}
        <div className="mx-2.5 h-5 w-px bg-border/60 shrink-0" />

        {/* Group 4: OCR + Fullscreen (push to right) */}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <button
            type="button"
            onClick={handleRerunOcr}
            disabled={!activeDoc || ocrProcessing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary/60 text-foreground/90 text-xs border border-border/40 hover:border-blue-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {ocrProcessing ? (
              <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            )}
            {ocrProcessing ? "Running…" : "Rerun OCR"}
          </button>
          <div className="w-px h-5 bg-border/60 mx-1" />
          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary/60 transition-all"
            title="Toggle fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main 3-panel layout */}
      <div className="flex-1 flex gap-2 p-2 min-h-0">
        {/* LEFT PANEL */}
        <div
          className={`flex flex-col bg-card border-border rounded-xl p-2 shrink-0 transition-all duration-200 ${leftOpen ? "w-44" : "w-8"}`}
        >
          {leftOpen ? (
            <>
              <div className="flex items-center gap-1 mb-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setLeftSection("pages")}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-medium transition-all ${leftSection === "pages" ? "bg-teal-500/20 text-primary/90 border border-teal-500/25" : "text-muted-foreground hover:text-foreground/90"}`}
                >
                  Pages
                </button>
                <button
                  type="button"
                  onClick={() => setLeftSection("ocr")}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-medium transition-all ${leftSection === "ocr" ? "bg-teal-500/20 text-primary/90 border border-teal-500/25" : "text-muted-foreground hover:text-foreground/90"}`}
                >
                  OCR
                </button>
                <button
                  type="button"
                  onClick={toggleLeft}
                  className="p-1 text-muted-foreground hover:text-foreground/90 transition-colors"
                  title="Collapse left panel"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
              {leftSection === "pages" ? (
                <PageNavPanel
                  pageCount={pageCount}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                />
              ) : (
                <OcrPanel
                  text={ocrText}
                  query={ocrQuery}
                  onQueryChange={setOcrQuery}
                  onNavigate={handleNavigate}
                />
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={toggleLeft}
              className="flex-1 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
              title="Expand left panel"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* CENTER VIEWER */}
        <div className="flex-1 flex flex-col bg-card border-border rounded-xl overflow-hidden min-w-0">
          {/* Viewer toolbar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0 gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted-foreground px-1 font-mono">
                {currentPage} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                disabled={currentPage >= pageCount}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              {activeDoc && (
                <div className="flex items-center gap-2 mr-2">
                  <Badge variant={statusVariant(activeDoc.status)} className="text-[10px]">
                    {activeDoc.status}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Rev {activeDoc.revision}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary/60 transition-all"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted-foreground w-12 text-center font-mono">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary/60 transition-all"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground/90 text-[10px] hover:bg-secondary/60 transition-all border border-border/40"
              >
                Fit
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary/60 transition-all"
                title="Rotate"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Document area */}
          <div className="flex-1 overflow-hidden p-4">
            <DocumentViewer
              doc={activeDoc}
              zoom={zoom}
              rotation={rotation}
              currentPage={currentPage}
              pageCount={pageCount}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary/60 text-foreground/90 text-xs border border-border/40 hover:border-teal-500/20 transition-all"
            >
              <Download className="w-3.5 h-3.5 text-primary" /> Download
            </button>
            <button
              type="button"
              onClick={handleRerunOcr}
              disabled={ocrProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary/60 text-foreground/90 text-xs border border-border/40 hover:border-amber-500/20 transition-all disabled:opacity-40"
            >
              {ocrProcessing ? (
                <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              )}{" "}
              {ocrProcessing ? "Running…" : "Re-OCR"}
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary/60 text-foreground/90 text-xs border border-border/40 hover:border-blue-500/20 transition-all"
            >
              <GitCompare className="w-3.5 h-3.5 text-blue-400" /> Compare
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary/60 text-foreground/90 text-xs border border-border/40 hover:border-indigo-500/20 transition-all"
            >
              <Paperclip className="w-3.5 h-3.5 text-indigo-400" /> Attach
            </button>
            <button
              type="button"
              onClick={() => setShowEditMeta(true)}
              disabled={!activeDoc}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary/60 text-foreground/90 text-xs border border-border/40 transition-all ml-auto disabled:opacity-40"
            >
              <Edit3 className="w-3.5 h-3.5 text-muted-foreground" /> Edit Metadata
            </button>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div
          className={`flex flex-col bg-card border-border rounded-xl p-3 shrink-0 transition-all duration-200 ${rightOpen ? "w-56" : "w-8"}`}
        >
          {rightOpen ? (
            <>
              <div className="flex items-center justify-between mb-2 shrink-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Info
                </span>
                <button
                  type="button"
                  onClick={toggleRight}
                  className="p-0.5 text-muted-foreground hover:text-foreground/90 transition-colors"
                  title="Collapse right panel"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <RightPanel
                doc={activeDoc}
                ocrJob={ocrJob}
                ocrStatusOverride={ocrStatusOverride}
                onNavigate={handleNavigate}
                activeSection={rightSection}
                onSectionChange={setRightSection}
              />
            </>
          ) : (
            <button
              type="button"
              onClick={toggleRight}
              className="flex-1 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
              title="Expand right panel"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
