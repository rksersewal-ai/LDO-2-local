import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  CheckCircle,
  ChevronRight,
  Clock,
  Command,
  Database,
  FileText,
  Hash,
  Layers,
  ScanText,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  DocumentPreviewButton,
  getDocumentContextAttributes,
} from "../components/documents/DocumentPreviewActions";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { Button, GlassCard, Input } from "../components/ui/Shared";
import { useAbortController } from "../hooks/useAbortOnNavigate";
import { useDebounce } from "../hooks/useOverloadProtection";
import { SearchHistoryService } from "../services/SearchHistoryService";
import type { CrossEntityResults, SearchResult } from "../services/SearchService";
import { SearchService } from "../services/SearchService";

const _SAVED_KEY = "edms_saved_searches";

const _RECENT_KEY = "edms_recent_searches";
const SCOPE_OPTIONS = ["ALL", "DOCUMENTS", "PL", "WORK", "CASES"] as const;
type Scope = (typeof SCOPE_OPTIONS)[number];

const SCOPE_LABELS: Record<Scope, string> = {
  ALL: "All",
  DOCUMENTS: "Documents",
  PL: "PL Items",
  WORK: "Work Records",
  CASES: "Cases",
};

const EXAMPLE_QUERIES = [
  "traction motor insulation",
  "WAP7 bogie frame",
  "38110000",
  "pantograph DSA380",
  "wiring harness 25kV",
  "brake failure",
];

function highlightSnippet(text: string, query: string) {
  if (!text || !query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  const pre = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const post = text.slice(idx + query.length);
  return (
    <span>
      {pre}
      <mark className="bg-teal-500/25 text-primary/90 rounded px-0.5">{match}</mark>
      {post}
    </span>
  );
}

function statusColor(status: string): string {
  const s = status?.toUpperCase();
  if (["ACTIVE", "APPROVED", "VERIFIED", "CLOSED"].includes(s)) return "text-[color:var(--status-success)]";
  if (["DRAFT", "OPEN", "UNDER_REVIEW", "IN_PROGRESS", "SUBMITTED"].includes(s))
    return "text-[color:var(--status-warning)]";
  if (["OBSOLETE", "FAILED", "OVERDUE"].includes(s)) return "text-[color:var(--status-danger)]";
  return "text-muted-foreground";
}

function statusDot(status: string): string {
  const s = status?.toUpperCase();
  if (["ACTIVE", "APPROVED", "VERIFIED", "CLOSED"].includes(s)) return "bg-[color:var(--status-success)]";
  if (["DRAFT", "OPEN", "UNDER_REVIEW", "IN_PROGRESS", "SUBMITTED"].includes(s))
    return "bg-[color:var(--status-warning)]";
  if (["OBSOLETE", "FAILED", "OVERDUE"].includes(s)) return "bg-[color:var(--status-danger)]";
  return "bg-muted-foreground";
}

function humanizeKey(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function reasonLabel(reason: string) {
  switch (reason) {
    case "approved_assertion":
      return "Approved assertion";
    case "extracted_entity":
      return "Extracted entity";
    default:
      return humanizeKey(reason);
  }
}

function getEntityPath(result: SearchResult, query?: string): string {
  switch (result.type) {
    case "document":
      return query
        ? `/documents/${result.id}?q=${encodeURIComponent(query)}`
        : `/documents/${result.id}`;
    case "pl":
      return `/pl/${result.id}`;
    case "work":
      return `/ledger?id=${encodeURIComponent(result.id)}`;
    case "case":
      return `/cases?id=${encodeURIComponent(result.id)}`;
    default:
      return "/";
  }
}

interface ResultCardProps {
  result: SearchResult;
  query: string;
  onClick: () => void;
}

function ResultCard({ result, query, onClick }: ResultCardProps) {
  const icons: Record<string, React.ReactNode> = {
    document: <FileText className="w-4 h-4 text-blue-400" />,
    pl: <Database className="w-4 h-4 text-indigo-400" />,
    work: <Briefcase className="w-4 h-4 text-amber-400" />,
    case: <AlertTriangle className="w-4 h-4 text-rose-400" />,
  };

  const typeLabels: Record<string, string> = {
    document: "Document",
    pl: "PL Item",
    work: "Work Record",
    case: "Case",
  };

  const typeBg: Record<string, string> = {
    document: "bg-blue-500/10 border-blue-500/20",
    pl: "bg-indigo-500/10 border-indigo-500/20",
    work: "bg-amber-500/10 border-amber-500/20",
    case: "bg-rose-500/10 border-rose-500/20",
  };

  const duplicateMeta =
    result.type === "document" && result.duplicateStatus
      ? result.duplicateStatus === "DUPLICATE"
        ? {
            label: "Duplicate",
            className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
          }
        : result.duplicateStatus === "MASTER"
          ? {
              label: "Master copy",
              className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
            }
          : null
      : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      {...(result.type === "document" ? getDocumentContextAttributes(result.id, result.title) : {})}
      className="w-full text-left p-3 rounded-xl border border-border/50 bg-card/40 backdrop-blur-md hover:-translate-y-0.5 hover:border-primary/30 hover:bg-secondary/40 transition-all duration-200 group"
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${typeBg[result.type]}`}
        >
          {icons[result.type]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-sm font-semibold text-foreground group-hover:text-primary/90 transition-colors truncate">
              {highlightSnippet(result.title, query)}
            </span>
            {result.status && (
              <span
                className={`flex items-center gap-1 text-[10px] font-medium ${statusColor(result.status)}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusDot(result.status)}`} />
                {result.status}
              </span>
            )}
            {duplicateMeta && (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${duplicateMeta.className}`}
              >
                {duplicateMeta.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span className="text-muted-foreground">{typeLabels[result.type]}</span>
            {result.subtitle && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="font-mono text-primary/70">{result.subtitle}</span>
              </>
            )}
            {result.matchField && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="flex items-center gap-0.5">
                  {result.matchField === "OCR Text" && (
                    <ScanText className="w-3 h-3 text-violet-400" />
                  )}
                  <span className="text-muted-foreground">{result.matchField}</span>
                </span>
              </>
            )}
          </div>
          {result.snippet && (
            <p className="text-xs text-muted-foreground leading-relaxed bg-card/40 rounded-lg px-3 py-2 border border-border/30 font-mono mt-1">
              {highlightSnippet(result.snippet, query)}
            </p>
          )}
          {result.type === "document" &&
            ((result.matchedAssertions?.length ?? 0) > 0 ||
              (result.matchedEntities?.length ?? 0) > 0 ||
              (result.matchReasons?.length ?? 0) > 0) && (
              <div className="mt-2 space-y-2">
                {(result.matchReasons?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {result.matchReasons?.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full border border-teal-500/20 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold text-teal-200"
                      >
                        {reasonLabel(reason)}
                      </span>
                    ))}
                  </div>
                )}
                {(result.matchedAssertions?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {result.matchedAssertions?.slice(0, 3).map((assertion) => (
                      <span
                        key={`${assertion.field_key}-${assertion.normalized_value ?? assertion.value}`}
                        className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-100"
                      >
                        <span className="font-semibold">{humanizeKey(assertion.field_key)}:</span>{" "}
                        {assertion.value}
                      </span>
                    ))}
                  </div>
                )}
                {(result.matchedEntities?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {result.matchedEntities?.slice(0, 3).map((entity) => (
                      <span
                        key={`${entity.entity_type}-${entity.normalized_value ?? entity.value}`}
                        className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-100"
                      >
                        <span className="font-semibold">{humanizeKey(entity.entity_type)}:</span>{" "}
                        {entity.value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
        </div>
        <div className="mt-1 flex items-center gap-1.5 shrink-0">
          {result.type === "document" && (
            <DocumentPreviewButton
              documentId={result.id}
              title={result.title}
              iconOnly
              className="h-8 min-h-0 px-2 text-foreground/90 hover:text-teal-200"
            />
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
    </div>
  );
}

interface ResultGroupProps {
  title: string;
  icon: React.ReactNode;
  results: SearchResult[];
  query: string;
  onNavigate: (path: string) => void;
}

function ResultGroup({ title, icon, results, query, onNavigate }: ResultGroupProps) {
  if (results.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        {icon}
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
        <span className="text-xs text-muted-foreground font-mono ml-1">{results.length}</span>
      </div>
      <div className="space-y-2">
        {results.map((r) => (
          <ResultCard
            key={`${r.type}-${r.id}`}
            result={r}
            query={query}
            onClick={() => onNavigate(getEntityPath(r, query))}
          />
        ))}
      </div>
    </div>
  );
}

import { useSearchStore } from "../store/useSearchStore";

export default function SearchExplorer() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { reset: resetSearchAbort, abort: abortSearch } = useAbortController();

  const {
    query,
    setQuery,
    scope,
    setScope,
    showFilters,
    setShowFilters,
    statusFilters,
    setStatusFilters,
    dateFilter,
    setDateFilter,
    entityFilters,
    setEntityFilters,
    duplicateFilter,
    setDuplicateFilter,
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    savedSearches,
    addSavedSearch,
    removeSavedSearch,
    inputFocused,
    setInputFocused,
  } = useSearchStore();

  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState<CrossEntityResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sourceFilter, setSourceFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [hashStatusFilter, setHashStatusFilter] = useState<"" | "present" | "full" | "missing">("");
  const [plLinkedFilter, setPlLinkedFilter] = useState<"" | "linked" | "unlinked">("");

  const [sortField, setSortField] = useState<"relevance" | "date" | "title" | "type">("relevance");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (field: "relevance" | "date" | "title" | "type") => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const _typeCounts = useMemo(() => {
    if (!results) return { document: 0, pl: 0, work: 0, case: 0 };
    return {
      document: results.documents.length,
      pl: results.plItems.length,
      work: results.work.length,
      case: results.cases.length,
    };
  }, [results]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const statuses = ["Approved", "In Progress", "Draft", "Verified", "Closed", "Obsolete"];
    statuses.forEach((s) => {
      let count = 0;
      if (results) {
        count += results.documents.filter((d) => d.status === s).length;
        count += results.plItems.filter((d) => d.status === s).length;
        count += results.work.filter((d) => d.status === s).length;
        count += results.cases.filter((d) => d.status === s).length;
      }
      counts[s] = count;
    });
    return counts;
  }, [results]);

  const isSaved = savedSearches.some((s) => s.q === debouncedQuery && s.scope === scope);

  const saveSearch = () => {
    if (!debouncedQuery.trim() || isSaved) return;
    addSavedSearch({
      q: debouncedQuery,
      scope,
      label: `${debouncedQuery}${scope !== "ALL" ? ` (${SCOPE_LABELS[scope]})` : ""}`,
    });
  };

  const deleteSaved = (idx: number) => {
    removeSavedSearch(idx);
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const prevUrlQ = useRef(searchParams.get("q") ?? "");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Sync query state when navigated externally (e.g., header Enter → /search?q=...)
  useEffect(() => {
    const urlQ = searchParams.get("q") ?? "";
    if (urlQ !== prevUrlQ.current) {
      prevUrlQ.current = urlQ;
      setQuery(urlQ);
    }
  }, [searchParams]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const signal = resetSearchAbort();
    const s = scope === "ALL" ? "ALL" : scope;
    SearchService.searchAll(debouncedQuery, s, signal, {
      duplicateFilter,
      source: sourceFilter || undefined,
      className: classFilter || undefined,
      hashStatus: hashStatusFilter || undefined,
      plLinked: plLinkedFilter || undefined,
      statusFilters: Array.from(statusFilters),
      dateRange: dateFilter,
    })
      .then((r) => {
        setResults(r);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (
          (err instanceof DOMException && err.name === "AbortError") ||
          (typeof err === "object" && err !== null && "code" in err && err.code === "ERR_CANCELED")
        ) {
          return;
        }

        setResults(null);
        setLoading(false);
        setError(err instanceof Error ? err.message : "Search request failed");
      });

    return () => abortSearch();
  }, [
    abortSearch,
    classFilter,
    dateFilter,
    debouncedQuery,
    duplicateFilter,
    hashStatusFilter,
    plLinkedFilter,
    resetSearchAbort,
    scope,
    sourceFilter,
    statusFilters,
  ]);

  useEffect(() => {
    const q = debouncedQuery.trim() ? debouncedQuery : "";
    prevUrlQ.current = q;
    if (q) {
      setSearchParams({ q }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [debouncedQuery, setSearchParams]);

  const handleNavigate = useCallback(
    (path: string) => {
      const q = debouncedQuery.trim();
      if (q && !recentSearches.includes(q)) {
        addRecentSearch(q);
      }
      if (q) SearchHistoryService.addSearch(q, scope, results?.total ?? 0);
      navigate(path);
    },
    [navigate, debouncedQuery, recentSearches, scope, results, addRecentSearch],
  );

  const scopeCounts: Record<Scope, number> = {
    ALL: results?.total ?? 0,
    DOCUMENTS: results?.documents.length ?? 0,
    PL: results?.plItems.length ?? 0,
    WORK: results?.work.length ?? 0,
    CASES: results?.cases.length ?? 0,
  };

  // Entity type still filters locally because it only reshapes already-fetched buckets.
  const matchesFilters = (result: SearchResult) => {
    if (entityFilters.size > 0 && !entityFilters.has(result.type)) return false;
    return true;
  };

  // Filter results based on active filters
  const filteredResults = results
    ? {
        ...results,
        documents: results.documents.filter(matchesFilters),
        plItems: results.plItems.filter(matchesFilters),
        work: results.work.filter(matchesFilters),
        cases: results.cases.filter(matchesFilters),
        total:
          results.documents.filter(matchesFilters).length +
          results.plItems.filter(matchesFilters).length +
          results.work.filter(matchesFilters).length +
          results.cases.filter(matchesFilters).length,
      }
    : null;

  const sortedResults = useMemo(() => {
    if (!filteredResults) return null;

    const sortFn = (a: SearchResult, b: SearchResult) => {
      if (sortField === "relevance") {
        return 0; // Natural API search relevance ranking
      }
      if (sortField === "title") {
        const titleA = a.title || "";
        const titleB = b.title || "";
        return sortDir === "asc" ? titleA.localeCompare(titleB) : titleB.localeCompare(titleA);
      }
      if (sortField === "type") {
        return sortDir === "asc" ? a.type.localeCompare(b.type) : b.type.localeCompare(a.type);
      }
      if (sortField === "date") {
        const dateA = a.date || "";
        const dateB = b.date || "";
        return sortDir === "asc" ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      }
      return 0;
    };

    return {
      ...filteredResults,
      documents: [...filteredResults.documents].sort(sortFn),
      plItems: [...filteredResults.plItems].sort(sortFn),
      work: [...filteredResults.work].sort(sortFn),
      cases: [...filteredResults.cases].sort(sortFn),
    };
  }, [filteredResults, sortField, sortDir]);

  const duplicateFacetCounts = filteredResults
    ? filteredResults.documents.reduce(
        (accumulator, result) => {
          if (result.duplicateStatus === "DUPLICATE") accumulator.duplicates += 1;
          if (result.duplicateStatus === "MASTER") accumulator.masters += 1;
          if (!result.duplicateStatus || result.duplicateStatus === "UNIQUE")
            accumulator.unique += 1;
          return accumulator;
        },
        { duplicates: 0, masters: 0, unique: 0 },
      )
    : { duplicates: 0, masters: 0, unique: 0 };

  const hasActiveFilters =
    statusFilters.size > 0 ||
    dateFilter !== "any" ||
    entityFilters.size > 0 ||
    duplicateFilter !== "include" ||
    Boolean(sourceFilter || classFilter || hashStatusFilter || plLinkedFilter);

  const documentFacets = results?.facets ?? {
    source_system: [],
    category: [],
    duplicate_status: [],
    ocr_status: [],
    hash_status: [],
    pl_linked: [],
  };

  const hasResults = results && results.total > 0;
  const hasQuery = debouncedQuery.trim().length > 0;
  const clearFilters = () => {
    setStatusFilters(new Set());
    setDateFilter("any");
    setEntityFilters(new Set());
    setDuplicateFilter("include");
    setSourceFilter("");
    setClassFilter("");
    setHashStatusFilter("");
    setPlLinkedFilter("");
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {/* A11y: Live region for screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {loading
          ? "Searching…"
          : error
            ? `Search error: ${error}`
            : results
              ? `${results.total} result${results.total !== 1 ? "s" : ""} found${debouncedQuery ? ` for "${debouncedQuery}"` : ""}`
              : ""}
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-md bg-accent border border-border flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Search Explorer</h1>
        </div>
        <p className="text-muted-foreground text-sm pl-11">
          Full-text search across documents, PL records, work entries, and cases — including
          OCR-extracted text.
        </p>
      </div>

      {/* Bento metrics cards strip */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Indexed domains",
            value: "4",
            hint: "Documents, PL, work, cases",
            action: () => setScope("ALL"),
          },
          {
            label: "Saved playbooks",
            value: String(savedSearches.length),
            hint: "Reusable operator queries",
            action: () => {
              if (savedSearches[0]) {
                setQuery(savedSearches[0].q);
                setScope(savedSearches[0].scope);
              }
            },
          },
          {
            label: "Recent queries",
            value: String(recentSearches.length),
            hint: "Session query recall",
            action: () => {
              if (recentSearches[0]) setQuery(recentSearches[0]);
            },
          },
          {
            label: "Search focus",
            value: hasResults ? String(filteredResults?.total ?? 0) : "Ready",
            hint: hasResults ? "Click to refine results" : "Waiting for query",
            action: () => setShowFilters(true),
          },
        ].map((metric) => (
          <button
            key={metric.label}
            type="button"
            onClick={metric.action}
            className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-md p-3 text-left shadow-sm transition-all duration-200 hover:border-primary/30 hover:bg-secondary/40 hover:-translate-y-0.5 active:translate-y-0"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {metric.label}
            </p>
            <p className="mt-1.5 font-mono text-2xl font-semibold text-foreground">
              {metric.value}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">{metric.hint}</p>
          </button>
        ))}
      </div>

      {/* Action shortcuts row */}
      <GlassCard className="p-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="teal-outline" onClick={() => setQuery(EXAMPLE_QUERIES[0])}>
            <Sparkles className="h-3.5 w-3.5" />
            Run Example Search
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setScope("DOCUMENTS");
              setShowFilters(true);
              inputRef.current?.focus();
            }}
          >
            <FileText className="h-3.5 w-3.5" />
            Document-Only Mode
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate("/documents")}>
            <ArrowRight className="h-3.5 w-3.5" />
            Open Document Hub
          </Button>
          {hasActiveFilters && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" />
              Reset Filters
            </Button>
          )}
        </div>
      </GlassCard>

      {/* Main content grid */}
      {!hasQuery ? (
        /* Landing Layout when there is no query */
        <div className="space-y-4">
          <GlassCard className="p-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none z-10" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setTimeout(() => setInputFocused(false), 150)}
                placeholder="Search documents, PLs, OCR text, work records, cases..."
                className="w-full pl-10 pr-20 h-10 text-sm rounded-md"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-muted-foreground text-[10px] border border-border rounded px-1.5 py-0.5 pointer-events-none">
                <Command className="w-2.5 h-2.5" />K
              </div>

              {/* Saved & Recent Searches Dropdown */}
              {inputFocused && (savedSearches.length > 0 || recentSearches.length > 0) && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card/95 backdrop-blur-xl border border-border/50 rounded-md shadow-2xl shadow-black/60 overflow-hidden">
                  {savedSearches.length > 0 && (
                    <div className="p-2">
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Saved
                      </p>
                      {savedSearches.slice(0, 5).map((s, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-lg hover:bg-muted group transition-colors"
                        >
                          <button
                            type="button"
                            onMouseDown={() => {
                              setQuery(s.q);
                              setScope(s.scope);
                              setInputFocused(false);
                            }}
                            className="flex-1 flex items-center gap-2 px-2 py-2 text-left"
                          >
                            <BookmarkCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                            <span className="text-sm text-foreground/90 truncate">{s.label}</span>
                          </button>
                          <button
                            type="button"
                            onMouseDown={() => deleteSaved(i)}
                            className="mr-2 w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {recentSearches.length > 0 && (
                    <div
                      className={`p-2 ${savedSearches.length > 0 ? "border-t border-border" : ""}`}
                    >
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Recent
                      </p>
                      {recentSearches.slice(0, 5).map((s, i) => (
                        <button
                          type="button"
                          key={i}
                          onMouseDown={() => {
                            setQuery(s);
                            setInputFocused(false);
                          }}
                          className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted text-left transition-colors"
                        >
                          <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm text-muted-foreground">{s}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recent Searches */}
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground/90">Recent Searches</h3>
              </div>
              {recentSearches.length > 0 ? (
                <div className="space-y-1">
                  {recentSearches.map((s, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => setQuery(s)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary/40 text-left transition-colors group"
                    >
                      <Search className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                        {s}
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-primary ml-auto transition-colors" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No recent searches yet.</p>
              )}
            </GlassCard>

            {/* Saved Searches */}
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Bookmark className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground/90">Saved Searches</h3>
              </div>
              {savedSearches.length > 0 ? (
                <div className="space-y-1">
                  {savedSearches.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 group px-3 py-2 rounded-lg hover:bg-secondary/40 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setQuery(s.q);
                          setScope(s.scope);
                        }}
                        className="flex-1 flex items-center gap-2 text-left"
                      >
                        <BookmarkCheck className="w-3.5 h-3.5 text-primary/60 group-hover:text-primary transition-colors flex-shrink-0" />
                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors truncate">
                          {s.label}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSaved(i)}
                        className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-sm">No saved searches yet.</p>
                  <p className="text-xs text-muted-foreground">
                    Run a search and click <span className="text-primary/70">Save Search</span> to
                    bookmark it here.
                  </p>
                </div>
              )}
            </GlassCard>

            {/* Search Tips & Examples */}
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground/90">Try searching for</h3>
              </div>
              <div className="space-y-2">
                {EXAMPLE_QUERIES.map((example, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setQuery(example)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/40 hover:bg-teal-500/10 hover:border-teal-500/20 border border-transparent text-left w-full transition-all group"
                  >
                    <Hash className="w-3.5 h-3.5 text-primary/60 group-hover:text-primary flex-shrink-0 transition-colors" />
                    <span className="text-sm text-muted-foreground group-hover:text-primary/90 font-mono transition-colors">
                      {example}
                    </span>
                  </button>
                ))}
              </div>
            </GlassCard>

            {/* Feature Summary */}
            <GlassCard className="p-5 md:col-span-2">
              <h3 className="text-sm font-semibold text-foreground/90 mb-3">What gets indexed?</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    icon: <FileText className="w-4 h-4 text-blue-400" />,
                    label: "Documents",
                    detail: "IDs, titles, tags, OCR text",
                  },
                  {
                    icon: <Layers className="w-4 h-4 text-indigo-400" />,
                    label: "PL Items",
                    detail: "8-digit PL numbers, descriptions",
                  },
                  {
                    icon: <Briefcase className="w-4 h-4 text-amber-400" />,
                    label: "Work Records",
                    detail: "IDs, type, e-Office refs",
                  },
                  {
                    icon: <AlertCircle className="w-4 h-4 text-rose-400" />,
                    label: "Cases",
                    detail: "Case numbers, linked PL, vendors",
                  },
                ].map(({ icon, label, detail }) => (
                  <div
                    key={label}
                    className="p-3 rounded-xl bg-secondary/40 border border-border/30"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {icon}
                      <span className="text-sm font-medium text-foreground">{label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{detail}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      ) : (
        /* Results Layout: Compact horizontal filter bar + full-width results */
        <div className="space-y-4">
          {/* Compact inline filter bar */}
          <GlassCard className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Scope/Entity Domain */}
              <div className="flex items-center border border-border/50 rounded-lg overflow-hidden bg-secondary/30">
                {SCOPE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScope(s)}
                    className={`px-3 py-1.5 text-xs transition-colors border-r border-border/30 last:border-r-0 flex items-center gap-1 ${
                      scope === s
                        ? "bg-teal-500/25 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground/90 hover:bg-secondary/40"
                    }`}
                  >
                    <span>{SCOPE_LABELS[s]}</span>
                    {scopeCounts[s] > 0 && scope !== s && (
                      <span className="text-[10px] font-mono text-muted-foreground/70">
                        {scopeCounts[s]}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Status multi-select dropdown */}
              <div className="relative">
                <select
                  className={`h-9 pl-3 pr-8 text-xs rounded-lg border transition-colors appearance-none cursor-pointer focus:outline-none focus:border-primary/50 bg-background/60 ${
                    statusFilters.size > 0
                      ? "border-teal-500/50 text-primary bg-teal-500/8"
                      : "border-border/60 text-muted-foreground"
                  }`}
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    const next = new Set(statusFilters);
                    if (next.has(val)) next.delete(val);
                    else next.add(val);
                    setStatusFilters(next);
                  }}
                >
                  <option value="">
                    {statusFilters.size > 0 ? `Status (${statusFilters.size})` : "Status: All"}
                  </option>
                  {["Approved", "In Progress", "Draft", "Verified", "Closed", "Obsolete"].map(
                    (status) => (
                      <option key={status} value={status}>
                        {statusFilters.has(status) ? "✓ " : ""}
                        {status} ({statusCounts[status] ?? 0})
                      </option>
                    ),
                  )}
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

              {/* Date range dropdown */}
              <div className="relative">
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
                  className={`h-9 pl-3 pr-8 text-xs rounded-lg border transition-colors appearance-none cursor-pointer focus:outline-none focus:border-primary/50 bg-background/60 ${
                    dateFilter !== "any"
                      ? "border-teal-500/50 text-primary bg-teal-500/8"
                      : "border-border/60 text-muted-foreground"
                  }`}
                >
                  <option value="any">Date: Any</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
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

              {/* Duplicate filter dropdown */}
              <div className="relative">
                <select
                  value={duplicateFilter}
                  onChange={(e) => setDuplicateFilter(e.target.value as typeof duplicateFilter)}
                  className={`h-9 pl-3 pr-8 text-xs rounded-lg border transition-colors appearance-none cursor-pointer focus:outline-none focus:border-primary/50 bg-background/60 ${
                    duplicateFilter !== "include"
                      ? "border-teal-500/50 text-primary bg-teal-500/8"
                      : "border-border/60 text-muted-foreground"
                  }`}
                >
                  <option value="include">Duplicates: All</option>
                  <option value="exclude">Hide duplicates</option>
                  <option value="only">Duplicates only</option>
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

              {/* Source system */}
              {documentFacets.source_system.length > 0 && (
                <div className="relative">
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className={`h-9 pl-3 pr-8 text-xs rounded-lg border transition-colors appearance-none cursor-pointer focus:outline-none focus:border-primary/50 bg-background/60 ${
                      sourceFilter
                        ? "border-teal-500/50 text-primary bg-teal-500/8"
                        : "border-border/60 text-muted-foreground"
                    }`}
                  >
                    <option value="">Source: All</option>
                    {documentFacets.source_system.map((b) => {
                      const val = b.source_system ?? b.value ?? "";
                      return val ? (
                        <option key={val} value={val}>
                          {val} ({b.count})
                        </option>
                      ) : null;
                    })}
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
              )}

              {/* PL Linkage */}
              {documentFacets.pl_linked.length > 0 && (
                <div className="relative">
                  <select
                    value={plLinkedFilter}
                    onChange={(e) =>
                      setPlLinkedFilter(e.target.value as "" | "linked" | "unlinked")
                    }
                    className={`h-9 pl-3 pr-8 text-xs rounded-lg border transition-colors appearance-none cursor-pointer focus:outline-none focus:border-primary/50 bg-background/60 ${
                      plLinkedFilter
                        ? "border-teal-500/50 text-primary bg-teal-500/8"
                        : "border-border/60 text-muted-foreground"
                    }`}
                  >
                    <option value="">PL Link: All</option>
                    {documentFacets.pl_linked.map((b) => {
                      const val = b.value ?? "";
                      return val ? (
                        <option key={val} value={val}>
                          {val} ({b.count})
                        </option>
                      ) : null;
                    })}
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
              )}

              {/* Clear all filters */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-medium border border-rose-500/20 bg-rose-500/8 text-rose-400 hover:bg-rose-500/15 transition-colors ml-auto"
                >
                  <X className="w-3.5 h-3.5" /> Clear Filters
                </button>
              )}
            </div>
          </GlassCard>

          {/* Full-width Search + Results */}
          <div className="space-y-4">
            <GlassCard className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none z-10" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setTimeout(() => setInputFocused(false), 150)}
                  placeholder="Search documents, PLs, OCR text, work records, cases..."
                  className="w-full pl-10 pr-20 h-10 text-sm rounded-md"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setResults(null);
                      setSearchParams({}, { replace: true });
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/90 text-xs px-2.5 h-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Autocomplete suggestions dropdown */}
              {inputFocused &&
                query.length >= 2 &&
                (() => {
                  const suggestions = recentSearches
                    .filter((s) => s.toLowerCase().includes(query.toLowerCase()) && s !== query)
                    .slice(0, 5);
                  const historySuggestions = SearchHistoryService.getSuggestions(query, scope)
                    .filter((h) => !suggestions.includes(h.query))
                    .slice(0, 3);
                  if (suggestions.length === 0 && historySuggestions.length === 0) return null;
                  return (
                    <div className="absolute left-0 right-0 mt-2 z-50 bg-card/95 backdrop-blur-xl border border-white/8 rounded-xl shadow-2xl p-2 max-w-lg mx-auto">
                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Suggestions
                      </p>
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          onMouseDown={() => {
                            setQuery(s);
                            setInputFocused(false);
                          }}
                          className="w-full text-left text-sm text-foreground/90 p-1.5 hover:bg-muted rounded flex items-center gap-2"
                        >
                          <Search className="w-3.5 h-3.5 text-primary" /> {s}
                        </button>
                      ))}
                    </div>
                  );
                })()}

              {/* Dedicated unified sorting bar supporting date sorting */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-border/30">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                    Sort By:
                  </span>
                  <div className="flex border border-border/50 rounded-xl overflow-hidden bg-secondary/30">
                    {[
                      { field: "relevance" as const, label: "Relevance" },
                      { field: "date" as const, label: "Date" },
                      { field: "title" as const, label: "Name" },
                      { field: "type" as const, label: "Type" },
                    ].map(({ field, label }) => (
                      <button
                        type="button"
                        key={field}
                        onClick={() => handleSort(field)}
                        className={`px-3 py-1 text-xs transition-colors border-r border-border/30 last:border-r-0 flex items-center gap-1 ${
                          sortField === field
                            ? "bg-teal-500/25 text-primary font-semibold"
                            : "text-muted-foreground hover:text-foreground/90 hover:bg-secondary/40"
                        }`}
                      >
                        <span>{label}</span>
                        {sortField === field &&
                          field !== "relevance" &&
                          (sortDir === "asc" ? (
                            <ArrowUp className="w-2.5 h-2.5 text-primary" />
                          ) : (
                            <ArrowDown className="w-2.5 h-2.5 text-primary" />
                          ))}
                      </button>
                    ))}
                  </div>
                </div>

                {hasResults && filteredResults && (
                  <div className="text-xs text-muted-foreground font-medium">
                    Showing{" "}
                    <span className="text-primary font-semibold">{filteredResults.total}</span>{" "}
                    matches
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Results Output */}
            {loading && <LoadingState message="Searching all records..." size="sm" />}

            {!loading && error && (
              <GlassCard className="p-6 border border-rose-500/20 bg-rose-950/10">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-rose-300">Search unavailable</p>
                    <p className="text-sm text-muted-foreground mt-1">{error}</p>
                  </div>
                </div>
              </GlassCard>
            )}

            {!loading && !error && hasResults && sortedResults && (
              <div className="space-y-6">
                {/* Summary & Save Search */}
                <div className="flex items-center gap-2 px-1">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground text-sm">
                    Found{" "}
                    <span className="text-primary/90 font-semibold">{sortedResults.total}</span>{" "}
                    {hasActiveFilters && (
                      <span className="text-muted-foreground font-semibold">filtered </span>
                    )}
                    results for{" "}
                    <span className="text-white font-semibold font-mono">"{debouncedQuery}"</span>
                  </span>
                  <button
                    type="button"
                    onClick={saveSearch}
                    disabled={isSaved}
                    title={isSaved ? "Already saved" : "Save this search"}
                    className={`ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      isSaved
                        ? "bg-teal-500/10 border-teal-500/30 text-primary cursor-default"
                        : "bg-secondary/60 border-border text-muted-foreground hover:text-primary/90 hover:border-teal-500/30"
                    }`}
                  >
                    {isSaved ? (
                      <BookmarkCheck className="w-3.5 h-3.5" />
                    ) : (
                      <Bookmark className="w-3.5 h-3.5" />
                    )}
                    {isSaved ? "Saved" : "Save Search"}
                  </button>
                </div>

                {/* Document Duplicate Metrics Panel */}
                {sortedResults.documents.length > 0 &&
                  (!scope || scope === "ALL" || scope === "DOCUMENTS") && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <GlassCard className="p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Duplicate docs
                        </p>
                        <p className="mt-2 text-2xl font-bold text-amber-300">
                          {duplicateFacetCounts.duplicates}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Duplicate candidates found.
                        </p>
                      </GlassCard>
                      <GlassCard className="p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Master copies
                        </p>
                        <p className="mt-2 text-2xl font-bold text-emerald-300">
                          {duplicateFacetCounts.masters}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Active master documents.
                        </p>
                      </GlassCard>
                      <GlassCard className="p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Duplicate filter
                        </p>
                        <p className="mt-2 text-sm font-semibold text-foreground">
                          {duplicateFilter === "include"
                            ? "All documents"
                            : duplicateFilter === "exclude"
                              ? "Duplicates hidden"
                              : "Duplicates only"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">Filter mode applied.</p>
                      </GlassCard>
                    </div>
                  )}

                {/* Document Results */}
                {(!scope || scope === "ALL" || scope === "DOCUMENTS") && (
                  <ResultGroup
                    title="Documents"
                    icon={<FileText className="w-3.5 h-3.5 text-blue-400" />}
                    results={sortedResults.documents.slice(0, 200)}
                    query={debouncedQuery}
                    onNavigate={handleNavigate}
                  />
                )}

                {/* PL Results */}
                {(!scope || scope === "ALL" || scope === "PL") && (
                  <ResultGroup
                    title="PL Items"
                    icon={<Database className="w-3.5 h-3.5 text-indigo-400" />}
                    results={sortedResults.plItems.slice(0, 200)}
                    query={debouncedQuery}
                    onNavigate={handleNavigate}
                  />
                )}

                {/* Work Results */}
                {(!scope || scope === "ALL" || scope === "WORK") && (
                  <ResultGroup
                    title="Work Records"
                    icon={<Briefcase className="w-3.5 h-3.5 text-amber-400" />}
                    results={sortedResults.work.slice(0, 200)}
                    query={debouncedQuery}
                    onNavigate={handleNavigate}
                  />
                )}

                {/* Case Results */}
                {(!scope || scope === "ALL" || scope === "CASES") && (
                  <ResultGroup
                    title="Cases"
                    icon={<AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                    results={sortedResults.cases.slice(0, 200)}
                    query={debouncedQuery}
                    onNavigate={handleNavigate}
                  />
                )}
              </div>
            )}

            {/* No Results Found */}
            {!loading && !error && hasQuery && results && results.total === 0 && (
              <GlassCard className="p-8">
                <EmptyState
                  icon={Search}
                  title="No results found"
                  description={`No matches for "${debouncedQuery}" across any domain. Try adjusting filters, checking spelling, or widening the search term.`}
                />
              </GlassCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
