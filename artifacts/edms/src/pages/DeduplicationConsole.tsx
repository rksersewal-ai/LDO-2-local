import {
  ArrowLeft,
  ArrowUpRight,
  BadgeAlert,
  Building2,
  CalendarClock,
  CheckCircle2,
  CopyCheck,
  Database,
  Download,
  FileStack,
  Filter,
  FolderGit2,
  GitBranch,
  Layers3,
  Link2,
  Play,
  RefreshCcw,
  ScanSearch,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  DocumentPreviewButton,
  getDocumentContextAttributes,
} from "../components/documents/DocumentPreviewActions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { DatePicker } from "../components/ui/DatePicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Badge, Button, GlassCard, Input, PageHeader, Select } from "../components/ui/Shared";
import { Switch } from "../components/ui/switch";
import { useRightPanel } from "../contexts/RightPanelContext";
import {
  DEDUP_CLASS_OPTIONS,
  DEDUP_MIN_SIZE_OPTIONS,
  DEDUP_OWNER_OPTIONS,
  DEDUP_SOURCE_SYSTEM_OPTIONS,
  type DedupDecision,
  type DedupMode,
  DUPLICATE_GROUPS,
  type DuplicateCandidateDocument,
  type DuplicateGroup,
  type FingerprintState,
  type GroupStatus,
} from "../lib/deduplicationMock";
import { DeduplicationService } from "../services/DeduplicationService";

type RepositoryScope = "LDO Repository";
type CollectionScope =
  | "All collections"
  | "Electrical Drawings"
  | "Vendor Qualifications"
  | "Control Specifications"
  | "Maintenance Procedures";
type PlantScope =
  | "All plants"
  | "BLW / Varanasi"
  | "CLW / Chittaranjan"
  | "ICF / Chennai"
  | "RWF / Bengaluru";

interface FilterState {
  documentClasses: string[];
  sourceSystem: string;
  owner: string;
  uploadFrom: string;
  uploadTo: string;
  minSizeBytes: number;
  search: string;
}

type PendingActionState =
  | { type: "scan_missing_hashes" }
  | { type: "apply_decision"; groupId: string }
  | { type: "mark_non_duplicate"; groupId: string }
  | { type: "bulk_ignore" }
  | null;

const DEFAULT_FILTERS: FilterState = {
  documentClasses: [],
  sourceSystem: "All sources",
  owner: "All owners",
  uploadFrom: "",
  uploadTo: "",
  minSizeBytes: 0,
  search: "",
};

const REPOSITORY_OPTIONS: RepositoryScope[] = ["LDO Repository"];
const COLLECTION_OPTIONS: CollectionScope[] = [
  "All collections",
  "Electrical Drawings",
  "Vendor Qualifications",
  "Control Specifications",
  "Maintenance Procedures",
];
const PLANT_OPTIONS: PlantScope[] = [
  "All plants",
  "BLW / Varanasi",
  "CLW / Chittaranjan",
  "ICF / Chennai",
  "RWF / Bengaluru",
];

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function humanizeToken(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function summarizeList(values: string[], fallback: string, limit = 3) {
  if (!values.length) return fallback;
  if (values.length <= limit) return values.join(", ");
  return `${values.slice(0, limit).join(", ")} +${values.length - limit}`;
}

function totalReferences(doc: DuplicateCandidateDocument) {
  return (
    doc.references.erp + doc.references.work + doc.references.config + doc.references.approvals
  );
}

function aggregateReferences(group: DuplicateGroup) {
  return group.documents.reduce(
    (acc, doc) => ({
      erp: acc.erp + doc.references.erp,
      work: acc.work + doc.references.work,
      config: acc.config + doc.references.config,
      approvals: acc.approvals + doc.references.approvals,
    }),
    { erp: 0, work: 0, config: 0, approvals: 0 },
  );
}

function getFingerprintMeta(state: FingerprintState) {
  switch (state) {
    case "full":
      return {
        label: "Full hash present",
        className: "bg-emerald-500/15 text-emerald-200 border border-emerald-400/30",
      };
    case "present":
      return {
        label: "Present",
        className: "bg-teal-500/15 text-teal-200 border border-teal-400/30",
      };
    default:
      return {
        label: "Missing (needs scan)",
        className: "bg-amber-500/15 text-amber-200 border border-amber-400/30",
      };
  }
}

function getStatusMeta(status: GroupStatus, mode: DedupMode) {
  if (status === "exact" && mode === "fingerprint") {
    return { label: "Exact duplicate", variant: "success" as const };
  }
  if (status === "pending") {
    return { label: "Pending confirmation", variant: "warning" as const };
  }
  return {
    label: mode === "metadata" ? "Probable duplicate (metadata only)" : "Probable duplicate",
    variant: "warning" as const,
  };
}

function deriveStatus(group: DuplicateGroup, mode: DedupMode) {
  if (mode === "metadata") {
    return group.status === "exact" ? "probable" : group.status;
  }
  if (group.documents.some((doc) => doc.fingerprintState === "missing")) {
    return group.status === "exact" ? "pending" : group.status;
  }
  return group.status;
}

function buildCsv(groups: DuplicateGroup[]) {
  const rows = [
    [
      "Group ID",
      "Document ID",
      "Title",
      "Document Number",
      "Part Number",
      "Revision",
      "Class",
      "File Size",
      "Fingerprint",
      "Upload Date",
      "Uploader",
      "References",
      "Group Status",
    ],
    ...groups.flatMap((group) =>
      group.documents.map((doc) => [
        group.id,
        doc.id,
        doc.title,
        doc.documentNumber,
        doc.partNumber ?? "",
        doc.revision,
        doc.className,
        formatBytes(doc.fileSizeBytes),
        getFingerprintMeta(doc.fingerprintState).label,
        doc.uploadDate,
        doc.uploader,
        String(totalReferences(doc)),
        getStatusMeta(group.status, group.dedupModeUsed).label,
      ]),
    ),
  ];

  return rows
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function ScopeChip({
  icon,
  label,
  value,
  children,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-border/60 bg-card/55 px-3.5 py-2 text-left text-xs text-foreground transition-all hover:border-primary/30 hover:bg-card/70"
        >
          <span className="text-primary/90">{icon}</span>
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {label}
            </span>
            <span className="block truncate font-semibold text-foreground">{value}</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 rounded-2xl border border-primary/20 bg-popover/95 p-4 text-popover-foreground shadow-2xl"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

function SelectionList({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">
          Choosing a scope chip updates the query state without leaving this screen.
        </p>
      </div>
      <div className="space-y-1.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-all ${
              value === option
                ? "border-teal-400/35 bg-teal-500/12 text-teal-200"
                : "border-border/60 bg-card text-foreground/90 hover:border-border hover:bg-card/80"
            }`}
          >
            <span>{option}</span>
            {value === option && <CheckCircle2 className="h-4 w-4" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function MultiSelectChipPicker({
  label,
  summary,
  options,
  value,
  onChange,
  icon,
}: {
  label: string;
  summary: string;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  icon: ReactNode;
}) {
  const toggleValue = (nextValue: string) => {
    onChange(
      value.includes(nextValue)
        ? value.filter((item) => item !== nextValue)
        : [...value, nextValue],
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 min-w-[210px] items-center gap-2 rounded-xl border border-border/60 bg-card/55 px-3 text-left text-sm text-foreground transition-all hover:border-primary/30 hover:bg-card/70"
        >
          <span className="text-primary/90">{icon}</span>
          <span className="min-w-0 flex-1 truncate">
            <span className="mr-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </span>
            <span className="text-foreground">{summary}</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 rounded-2xl border border-primary/20 bg-popover/95 p-4 text-popover-foreground shadow-2xl"
      >
        <div className="mb-3">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">
            Selections apply when you click “Apply filters”.
          </p>
        </div>
        <div className="space-y-2">
          {options.map((option) => {
            const selected = value.includes(option);
            return (
              <label
                key={option}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                  selected
                    ? "border-teal-400/35 bg-teal-500/12 text-teal-100"
                    : "border-border/60 bg-card text-foreground/90 hover:border-border hover:bg-card/80"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-teal-400"
                  checked={selected}
                  onChange={() => toggleValue(option)}
                />
                <span className="flex-1">{option}</span>
              </label>
            );
          })}
        </div>
        <div className="mt-4 flex justify-between">
          <Button variant="ghost" size="sm" onClick={() => onChange([])}>
            Clear
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onChange([...value])}>
            Keep selection
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OwnerPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [search, setSearch] = useState("");
  const filteredOptions = useMemo(
    () =>
      ["All owners", ...DEDUP_OWNER_OPTIONS].filter((option) =>
        option.toLowerCase().includes(search.toLowerCase()),
      ),
    [search],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 min-w-[200px] items-center gap-2 rounded-xl border border-border/60 bg-card/55 px-3 text-left text-sm text-foreground transition-all hover:border-primary/30 hover:bg-card/70"
        >
          <ShieldCheck className="h-4 w-4 text-primary/90" />
          <span className="min-w-0 flex-1 truncate">
            <span className="mr-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Uploader / owner
            </span>
            {value}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 rounded-2xl border border-primary/20 bg-popover/95 p-4 text-popover-foreground shadow-2xl"
      >
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Uploader / owner</p>
            <p className="text-xs text-muted-foreground">
              Use the existing EDMS permission scope; the picker only refines what the user already
              can see.
            </p>
          </div>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search owner..."
            className="w-full text-xs"
          />
          <div className="max-h-64 space-y-1 overflow-y-auto custom-scrollbar">
            {filteredOptions.map((option) => {
              const selected = value === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onChange(option)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-all ${
                    selected
                      ? "border-teal-400/35 bg-teal-500/12 text-teal-100"
                      : "border-border/60 bg-card text-foreground/90 hover:border-border hover:bg-card/80"
                  }`}
                >
                  <span>{option}</span>
                  {selected && <CheckCircle2 className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DateRangePickerChip({
  label,
  start,
  end,
  onStartChange,
  onEndChange,
  icon,
  compact = false,
}: {
  label: string;
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  icon: ReactNode;
  compact?: boolean;
}) {
  const summary = start && end ? `${formatDate(start)} → ${formatDate(end)}` : "Any time";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 rounded-xl border border-border/60 bg-card/55 px-3 text-left transition-all hover:border-primary/30 hover:bg-card/70 ${
            compact
              ? "h-9 min-w-[220px] text-sm text-foreground"
              : "rounded-full px-3.5 py-2 text-xs text-foreground"
          }`}
        >
          <span className="text-primary/90">{icon}</span>
          <span className="min-w-0 flex-1 truncate">
            <span className="mr-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </span>
            <span>{summary}</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[360px] rounded-2xl border border-primary/20 bg-popover/95 p-4 text-popover-foreground shadow-2xl"
      >
        <div className="mb-4">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">
            Calendars stay non-blocking and close when you click anywhere outside or press Escape.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <DatePicker
            value={start}
            onChange={onStartChange}
            placeholder="From"
            maxDate={end || undefined}
          />
          <DatePicker
            value={end}
            onChange={onEndChange}
            placeholder="To"
            minDate={start || undefined}
          />
        </div>
        <div className="mt-4 flex justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onStartChange("");
              onEndChange("");
            }}
          >
            Clear
          </Button>
          <span className="text-[11px] text-muted-foreground">Current: {summary}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SettingRow({
  title,
  description,
  control,
}: {
  title: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-card/45 px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export default function DeduplicationConsole() {
  const navigate = useNavigate();
  const { openPanel, closePanel } = useRightPanel();

  const [groups, setGroups] = useState<DuplicateGroup[]>(DUPLICATE_GROUPS);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [groupSource, setGroupSource] = useState<"backend" | "mock">("mock");
  const [dedupMode, setDedupMode] = useState<DedupMode>("fingerprint");
  const [confirmFullHash, setConfirmFullHash] = useState(true);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [repositoryScope, setRepositoryScope] = useState<RepositoryScope>("LDO Repository");
  const [collectionScope, setCollectionScope] = useState<CollectionScope>("All collections");
  const [plantScope, setPlantScope] = useState<PlantScope>("All plants");
  const [scopeDateFrom, setScopeDateFrom] = useState("2025-11-01");
  const [scopeDateTo, setScopeDateTo] = useState("2026-03-31");
  const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [bulkSelectedGroupIds, setBulkSelectedGroupIds] = useState<string[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingActionState>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [jobStatus, setJobStatus] = useState<string>("No dedup jobs running.");
  const [scheduleForm, setScheduleForm] = useState({
    cadence: "Weekly",
    runDate: "2026-04-02",
    runTime: "02:00",
    notify: true,
  });
  const [settingsForm, setSettingsForm] = useState({
    hashAlgo: "BLAKE3",
    hashVersion: "2",
    inlineFingerprintLimit: "50 MB",
    indexCollectionWide: true,
  });
  const [masterSelection, setMasterSelection] = useState<Record<string, string>>(() =>
    Object.fromEntries(DUPLICATE_GROUPS.map((group) => [group.id, group.suggestedMasterId])),
  );
  const [decisionSelection, setDecisionSelection] = useState<Record<string, DedupDecision>>(() =>
    Object.fromEntries(
      DUPLICATE_GROUPS.map((group) => [
        group.id,
        group.status === "exact"
          ? "hide_duplicates"
          : group.status === "pending"
            ? "merge_metadata"
            : "ignore_for_now",
      ]),
    ),
  );
  const [groupNotes, setGroupNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(DUPLICATE_GROUPS.map((group) => [group.id, group.notes])),
  );

  const loadGroups = useCallback(async (signal?: AbortSignal) => {
    setIsLoadingGroups(true);
    try {
      const result = await DeduplicationService.getCandidateGroups(signal);
      setGroups(result.groups);
      setGroupSource(result.source);
      setJobStatus(result.summary);
    } catch (error) {
      console.warn(
        "[DeduplicationConsole] Falling back to local groups after load failure.",
        error,
      );
      setGroups(DUPLICATE_GROUPS);
      setGroupSource("mock");
      setJobStatus(
        "Using the fallback console dataset because duplicate groups could not be loaded from the backend.",
      );
    } finally {
      setIsLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    void loadGroups(controller.signal).catch(() => {
      if (!cancelled) {
        setGroupSource("mock");
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [loadGroups]);

  useEffect(() => {
    setMasterSelection((current) => {
      const next = { ...current };
      for (const group of groups) {
        if (!next[group.id]) next[group.id] = group.suggestedMasterId;
      }
      return next;
    });
    setDecisionSelection((current) => {
      const next = { ...current };
      for (const group of groups) {
        if (!next[group.id]) {
          next[group.id] =
            group.status === "exact"
              ? "hide_duplicates"
              : group.status === "pending"
                ? "merge_metadata"
                : "ignore_for_now";
        }
      }
      return next;
    });
    setGroupNotes((current) => {
      const next = { ...current };
      for (const group of groups) {
        if (!(group.id in next)) next[group.id] = group.notes;
      }
      return next;
    });
  }, [groups]);

  const displayedGroups = useMemo(() => {
    return groups
      .map((group) => {
        const derivedStatus = deriveStatus(group, dedupMode);
        const visibleDocuments = group.documents.filter((doc) => {
          if (repositoryScope !== group.repository) return false;
          if (collectionScope !== "All collections" && group.collection !== collectionScope)
            return false;
          if (plantScope !== "All plants" && group.plant !== plantScope) return false;
          if (!includeArchived && doc.isArchived) return false;
          if (scopeDateFrom && doc.uploadDate < scopeDateFrom) return false;
          if (scopeDateTo && doc.uploadDate > scopeDateTo) return false;
          if (
            appliedFilters.documentClasses.length &&
            !appliedFilters.documentClasses.includes(doc.className)
          )
            return false;
          if (
            appliedFilters.sourceSystem !== "All sources" &&
            doc.sourceSystem !== appliedFilters.sourceSystem
          )
            return false;
          if (
            appliedFilters.owner !== "All owners" &&
            doc.owner !== appliedFilters.owner &&
            doc.uploader !== appliedFilters.owner
          )
            return false;
          if (appliedFilters.uploadFrom && doc.uploadDate < appliedFilters.uploadFrom) return false;
          if (appliedFilters.uploadTo && doc.uploadDate > appliedFilters.uploadTo) return false;
          if (appliedFilters.minSizeBytes && doc.fileSizeBytes < appliedFilters.minSizeBytes)
            return false;
          if (appliedFilters.search) {
            const haystack = [
              doc.id,
              doc.title,
              doc.documentNumber,
              doc.drawingNumber,
              doc.partNumber,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            if (!haystack.includes(appliedFilters.search.toLowerCase())) return false;
          }
          return true;
        });

        return {
          ...group,
          derivedStatus,
          visibleDocuments,
        };
      })
      .filter((group) => group.visibleDocuments.length > 0);
  }, [
    appliedFilters,
    collectionScope,
    dedupMode,
    groups,
    includeArchived,
    plantScope,
    repositoryScope,
    scopeDateFrom,
    scopeDateTo,
  ]);

  const selectedGroup = useMemo(
    () => displayedGroups.find((group) => group.id === selectedGroupId) ?? null,
    [displayedGroups, selectedGroupId],
  );

  const summaryStats = useMemo(() => {
    const docCount = displayedGroups.reduce((sum, group) => sum + group.visibleDocuments.length, 0);
    const savings = displayedGroups.reduce((sum, group) => sum + group.potentialSavingsBytes, 0);
    return { groups: displayedGroups.length, documents: docCount, savings };
  }, [displayedGroups]);

  useEffect(() => {
    if (selectedGroupId && !displayedGroups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(null);
    }
  }, [displayedGroups, selectedGroupId]);

  useEffect(() => {
    if (!selectedGroup) {
      closePanel();
      return;
    }

    const aggregate = aggregateReferences(selectedGroup);
    const masterId = masterSelection[selectedGroup.id] ?? selectedGroup.suggestedMasterId;
    const selectedMaster =
      selectedGroup.documents.find((doc) => doc.id === masterId) ?? selectedGroup.documents[0];
    const decision = decisionSelection[selectedGroup.id];
    const impactSummary =
      decision === "hide_duplicates"
        ? `Hide ${Math.max(selectedGroup.documents.length - 1, 1)} duplicates and keep ${selectedMaster.id} as the master record.`
        : decision === "merge_metadata"
          ? `Merge metadata into ${selectedMaster.id} and preserve existing links on the most-referenced document.`
          : "Leave the group visible but excluded from future queue prioritization.";

    openPanel({
      panelKey: selectedGroup.id,
      title: `Duplicate group ${selectedGroup.id}`,
      subtitle: `${selectedGroup.documents.length} candidate documents`,
      icon: <Layers3 className="h-4 w-4" />,
      defaultExpandedSections: [0, 1, 2, 3],
      headerActions: (
        <button
          type="button"
          onClick={() => setSelectedGroupId(null)}
          className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-[11px] font-semibold text-foreground/90 transition-colors hover:border-teal-400/30 hover:text-teal-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to list
        </button>
      ),
      sections: [
        {
          heading: "Summary",
          content: (
            <div className="space-y-4">
              <div className="rounded-2xl border border-teal-500/20 bg-teal-500/8 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                      Master candidate suggestion
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {selectedMaster.id}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{selectedMaster.title}</p>
                  </div>
                  <Badge variant="success">Most-linked candidate</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-border bg-card/45 p-3">
                    <p className="text-muted-foreground">Potential storage saving</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {formatBytes(selectedGroup.potentialSavingsBytes)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card/45 p-3">
                    <p className="text-muted-foreground">Mode used</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {dedupMode === "fingerprint"
                        ? "Metadata + content fingerprint"
                        : "Metadata only"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Risk review
                </p>
                {selectedGroup.risks.map((risk) => (
                  <div
                    key={risk}
                    className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2.5 text-xs text-amber-100"
                  >
                    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                    <span>{risk}</span>
                  </div>
                ))}
                <div className="rounded-xl border border-border bg-card/45 p-3 text-xs text-foreground/90">
                  <span className="font-semibold text-foreground">Impact summary:</span>{" "}
                  {impactSummary}
                </div>
              </div>

              {((selectedGroup.approvedAssertions?.length ?? 0) > 0 ||
                (selectedGroup.conflictingEntities?.length ?? 0) > 0) && (
                <div className="space-y-3 rounded-2xl border border-border/70 bg-card/45 p-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                      Metadata evidence
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Duplicate grouping is reinforced by governed identifiers and extracted
                      entities already stored on the document records.
                    </p>
                  </div>
                  {(selectedGroup.approvedAssertions?.length ?? 0) > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-foreground">
                        Common approved assertions
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedGroup.approvedAssertions?.map((assertion) => (
                          <span
                            key={`${assertion.fieldKey}-${assertion.values.join("|")}`}
                            className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-[11px] text-indigo-100"
                          >
                            <span className="font-semibold">
                              {humanizeToken(assertion.fieldKey)}:
                            </span>{" "}
                            {assertion.values.join(", ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(selectedGroup.conflictingEntities?.length ?? 0) > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-foreground">
                        Conflicting extracted entities
                      </p>
                      <div className="space-y-2">
                        {selectedGroup.conflictingEntities?.map((entity) => (
                          <div
                            key={`${entity.entityType}-${entity.values.join("|")}`}
                            className="rounded-xl border border-rose-500/20 bg-rose-500/8 px-3 py-2 text-xs text-rose-100"
                          >
                            <span className="font-semibold">
                              {humanizeToken(entity.entityType)}:
                            </span>{" "}
                            {entity.values.join(", ")}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ),
        },
        {
          heading: "Documents in this group",
          content: (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(["hide_duplicates", "merge_metadata", "ignore_for_now"] as DedupDecision[]).map(
                  (option) => {
                    const selected = decision === option;
                    const label =
                      option === "hide_duplicates"
                        ? "Hide duplicates"
                        : option === "merge_metadata"
                          ? "Merge metadata"
                          : "Ignore for now";
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() =>
                          setDecisionSelection((current) => ({
                            ...current,
                            [selectedGroup.id]: option,
                          }))
                        }
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                          selected
                            ? "border-teal-400/40 bg-teal-500/14 text-teal-100"
                            : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  },
                )}
              </div>
              {selectedGroup.documents.map((doc) => {
                const isMaster =
                  (masterSelection[selectedGroup.id] ?? selectedGroup.suggestedMasterId) === doc.id;
                const fingerprint = getFingerprintMeta(doc.fingerprintState);
                return (
                  <div
                    key={doc.id}
                    {...getDocumentContextAttributes(doc.id, doc.title)}
                    className="rounded-2xl border border-border/70 bg-card/45 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name={`master-${selectedGroup.id}`}
                        checked={isMaster}
                        onChange={() =>
                          setMasterSelection((current) => ({
                            ...current,
                            [selectedGroup.id]: doc.id,
                          }))
                        }
                        className="mt-1 h-4 w-4 accent-teal-400"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => navigate(`/documents/${doc.id}`)}
                              className="text-left text-sm font-semibold text-teal-200 transition-colors hover:text-teal-100"
                            >
                              {doc.id}
                            </button>
                            <p className="mt-1 text-xs text-foreground/90">{doc.title}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <DocumentPreviewButton
                              documentId={doc.id}
                              title={doc.title}
                              iconOnly
                              className="h-7 min-h-0 px-2 text-foreground/90 hover:text-teal-200"
                            />
                            {isMaster && <Badge variant="success">Set as master</Badge>}
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                          <div className="rounded-xl border border-border/60 bg-card/55 px-3 py-2">
                            <p className="uppercase tracking-[0.16em]">Number / revision</p>
                            <p className="mt-1 text-foreground">
                              {doc.documentNumber} · {doc.revision}
                            </p>
                          </div>
                          <div className="rounded-xl border border-border/60 bg-card/55 px-3 py-2">
                            <p className="uppercase tracking-[0.16em]">Links count</p>
                            <p className="mt-1 text-foreground">
                              {totalReferences(doc)} linked entities
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="rounded-full border border-border/60 bg-card/70 px-2.5 py-1 text-muted-foreground">
                            Metadata key ready
                          </span>
                          <span className={`rounded-full px-2.5 py-1 ${fingerprint.className}`}>
                            {fingerprint.label}
                          </span>
                          {doc.isFullHashRequired && (
                            <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-emerald-100">
                              Full hash required class
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ),
        },
        {
          heading: "Links & impact",
          content: (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "ERP orders / jobs",
                    value: aggregate.erp,
                    route: "/reports",
                    icon: <Database className="h-4 w-4" />,
                  },
                  {
                    label: "Work / approvals",
                    value: aggregate.work + aggregate.approvals,
                    route: "/approvals",
                    icon: <GitBranch className="h-4 w-4" />,
                  },
                  {
                    label: "Config / BOM links",
                    value: aggregate.config,
                    route: "/bom",
                    icon: <FolderGit2 className="h-4 w-4" />,
                  },
                  {
                    label: "Document refs total",
                    value: selectedGroup.documents.reduce(
                      (sum, doc) => sum + totalReferences(doc),
                      0,
                    ),
                    route: "/documents",
                    icon: <Link2 className="h-4 w-4" />,
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => navigate(item.route)}
                    className="rounded-2xl border border-border/70 bg-card/45 p-3 text-left transition-all hover:border-teal-400/25 hover:bg-card/75"
                  >
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-primary/90">{item.icon}</span>
                      <span className="text-[11px] uppercase tracking-[0.16em]">{item.label}</span>
                    </div>
                    <div className="mt-2 flex items-end justify-between">
                      <span className="text-2xl font-semibold text-foreground">{item.value}</span>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
              <div className="rounded-2xl border border-border/70 bg-card/45 p-3 text-xs text-muted-foreground">
                Review these linked entities before hiding or merging duplicates. Destructive
                actions must preserve link targets and approval history.
              </div>
            </div>
          ),
        },
        {
          heading: "Notes & log",
          content: (
            <div className="space-y-3">
              <textarea
                value={groupNotes[selectedGroup.id] ?? ""}
                onChange={(event) =>
                  setGroupNotes((current) => ({
                    ...current,
                    [selectedGroup.id]: event.target.value,
                  }))
                }
                className="min-h-[120px] w-full rounded-2xl border border-border/60 bg-popover/65 px-3 py-3 text-sm text-foreground outline-none transition-all focus:border-teal-400/40 focus:ring-1 focus:ring-teal-400/30"
                placeholder="Capture operator notes, exception handling, or audit rationale."
              />
              <div className="space-y-2 rounded-2xl border border-border/70 bg-card/45 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Decision log
                </p>
                {selectedGroup.decisionLog.map((entry) => (
                  <div
                    key={`${entry.at}-${entry.actor}-${entry.action}`}
                    className="rounded-xl border border-border/60 bg-card/55 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-3 text-[11px]">
                      <span className="font-semibold text-foreground">{entry.action}</span>
                      <span className="text-muted-foreground">{formatDateTime(entry.at)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{entry.actor}</p>
                    <p className="mt-2 text-xs text-foreground/90">{entry.note}</p>
                  </div>
                ))}
              </div>
            </div>
          ),
        },
      ],
      footer: (
        <div className="space-y-2">
          <Button
            className="w-full"
            onClick={() =>
              setPendingAction({
                type: "apply_decision",
                groupId: selectedGroup.id,
              })
            }
          >
            <CopyCheck className="h-4 w-4" />
            Apply dedup decision
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setPendingAction({
                  type: "mark_non_duplicate",
                  groupId: selectedGroup.id,
                })
              }
            >
              Mark as non-duplicate
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <DocumentPreviewButton
                documentId={selectedMaster.id}
                title={selectedMaster.title}
                size="sm"
                variant="ghost"
                className="w-full"
                label="Preview"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/documents/${selectedMaster.id}`)}
              >
                Open full document view
              </Button>
            </div>
          </div>
        </div>
      ),
    });

    return () => closePanel();
  }, [
    closePanel,
    decisionSelection,
    dedupMode,
    groupNotes,
    masterSelection,
    navigate,
    openPanel,
    selectedGroup,
  ]);

  const allVisibleGroupIds = displayedGroups.map((group) => group.id);
  const allVisibleSelected =
    allVisibleGroupIds.length > 0 &&
    allVisibleGroupIds.every((groupId) => bulkSelectedGroupIds.includes(groupId));

  const runDedupNow = async () => {
    const descriptor = dedupMode === "fingerprint" ? "metadata + fingerprint" : "metadata only";
    setJobStatus(`Refreshing duplicate groups using ${descriptor} across the current scope.`);
    await loadGroups();
    toast.success("Dedup groups refreshed", {
      description: `Using ${descriptor} mode with current scope and filters.`,
    });
  };

  const exportReport = () => {
    downloadFile(
      buildCsv(displayedGroups),
      `dedup-report-${new Date().toISOString().slice(0, 10)}.csv`,
      "text/csv;charset=utf-8;",
    );
    toast.success("Dedup report exported");
  };

  const resetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  };

  const handleBulkToggle = (groupId: string, checked: boolean) => {
    setBulkSelectedGroupIds((current) =>
      checked ? Array.from(new Set([...current, groupId])) : current.filter((id) => id !== groupId),
    );
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    setActionBusy(true);

    try {
      if (pendingAction.type === "scan_missing_hashes") {
        const pendingCount = groups.reduce(
          (sum, group) =>
            sum + group.documents.filter((doc) => doc.fingerprintState === "missing").length,
          0,
        );
        await DeduplicationService.queueMissingHashes();
        setJobStatus(
          `Background hash scan queued for ${pendingCount} documents missing sparse fingerprints.`,
        );
        toast.success("Fingerprint scan queued", {
          description: `${pendingCount} documents will be processed in the background.`,
        });
      }

      if (pendingAction.type === "apply_decision") {
        const group = groups.find((item) => item.id === pendingAction.groupId);
        if (group) {
          const masterId = masterSelection[group.id] ?? group.suggestedMasterId;
          const decision = decisionSelection[group.id];
          if (groupSource === "mock") {
            setGroups((current) =>
              current.map((item) =>
                item.id === group.id
                  ? {
                      ...item,
                      notes: groupNotes[group.id] ?? item.notes,
                      decisionLog: [
                        {
                          at: new Date().toISOString(),
                          actor: "edms.admin",
                          action:
                            decision === "hide_duplicates"
                              ? "Dedup applied"
                              : decision === "merge_metadata"
                                ? "Metadata merged"
                                : "Ignored",
                          note:
                            decision === "hide_duplicates"
                              ? `Kept ${masterId} as master and queued ${Math.max(item.documents.length - 1, 1)} duplicates for hide/supersede.`
                              : decision === "merge_metadata"
                                ? `Merged duplicate metadata into ${masterId} and retained its existing links.`
                                : "Excluded this group from the active review queue while preserving audit visibility.",
                        },
                        ...item.decisionLog,
                      ],
                    }
                  : item,
              ),
            );
            toast.success("Dedup decision queued", {
              description: `${group.id} was updated in the fallback console dataset.`,
            });
          } else {
            await DeduplicationService.applyDecision(group.id, {
              decision,
              masterDocumentId: masterId,
              notes: groupNotes[group.id] ?? group.notes,
            });
            await loadGroups();
            toast.success("Dedup decision queued", {
              description: `${group.id} was submitted to the backend decision flow.`,
            });
          }
        }
      }

      if (pendingAction.type === "mark_non_duplicate") {
        if (groupSource === "mock") {
          setGroups((current) =>
            current.map((item) =>
              item.id === pendingAction.groupId
                ? {
                    ...item,
                    notes: `${groupNotes[item.id] ?? item.notes}\nMarked as non-duplicate by admin review.`,
                    decisionLog: [
                      {
                        at: new Date().toISOString(),
                        actor: "edms.admin",
                        action: "Marked non-duplicate",
                        note: "Group removed from active dedup queue while preserving audit history.",
                      },
                      ...item.decisionLog,
                    ],
                  }
                : item,
            ),
          );
        } else {
          await DeduplicationService.applyDecision(pendingAction.groupId, {
            decision: "ignore_for_now",
            notes: `${groupNotes[pendingAction.groupId] ?? ""}\nMarked as non-duplicate by admin review.`,
          });
          await loadGroups();
        }
        toast.success("Group marked as non-duplicate");
        setSelectedGroupId(null);
      }

      if (pendingAction.type === "bulk_ignore") {
        if (groupSource === "mock") {
          setGroups((current) =>
            current.map((item) =>
              bulkSelectedGroupIds.includes(item.id)
                ? {
                    ...item,
                    decisionLog: [
                      {
                        at: new Date().toISOString(),
                        actor: "edms.admin",
                        action: "Bulk ignored",
                        note: "Group deprioritized from the active dedup queue via bulk action.",
                      },
                      ...item.decisionLog,
                    ],
                  }
                : item,
            ),
          );
        } else {
          await Promise.all(
            bulkSelectedGroupIds.map((groupId) =>
              DeduplicationService.applyDecision(groupId, {
                decision: "ignore_for_now",
                notes: "Group deprioritized from the active dedup queue via bulk action.",
              }),
            ),
          );
          await loadGroups();
        }
        toast.success("Selected groups ignored", {
          description: `${bulkSelectedGroupIds.length} groups moved out of the active queue.`,
        });
        setBulkSelectedGroupIds([]);
      }

      setPendingAction(null);
    } catch (error) {
      toast.error("Dedup action failed", {
        description:
          error instanceof Error ? error.message : "The backend rejected the dedup action.",
      });
    } finally {
      setActionBusy(false);
    }
  };

  const pendingDialogCopy = (() => {
    if (!pendingAction) return null;
    if (pendingAction.type === "scan_missing_hashes") {
      return {
        title: "Queue background fingerprint scan?",
        description:
          "This starts a background job that computes sparse fingerprints only for documents missing hash data. The UI stays responsive while hashes are scanned.",
        actionLabel: "Queue scan",
      };
    }

    if (pendingAction.type === "bulk_ignore") {
      return {
        title: `Ignore ${bulkSelectedGroupIds.length} selected groups?`,
        description:
          "This will keep the records intact but remove the selected groups from active dedup review priority until a later pass.",
        actionLabel: "Ignore selected",
      };
    }

    if (pendingAction.type === "mark_non_duplicate") {
      return {
        title: `Mark ${pendingAction.groupId} as non-duplicate?`,
        description:
          "This keeps all documents visible and records the operator decision in the audit log so the group stops returning as an active duplicate candidate.",
        actionLabel: "Mark non-duplicate",
      };
    }

    const group = groups.find((item) => item.id === pendingAction.groupId);
    const masterId = group ? (masterSelection[group.id] ?? group.suggestedMasterId) : "";
    const decision = group ? decisionSelection[group.id] : "hide_duplicates";
    return {
      title: `Apply dedup decision for ${pendingAction.groupId}?`,
      description:
        decision === "hide_duplicates"
          ? `Keep ${masterId} as master and queue the remaining duplicates for hide/supersede handling. Link targets and audit history remain intact.`
          : decision === "merge_metadata"
            ? `Merge duplicate metadata into ${masterId} while preserving the most-linked document as the active record.`
            : `Leave this group visible but excluded from the active processing queue.`,
      actionLabel: "Apply decision",
    };
  })();

  return (
    <div className="mx-auto max-w-[1680px] space-y-6">
      <PageHeader
        title="Document Deduplication Console"
        subtitle="Identify and resolve duplicate documents across the repository using metadata and content fingerprints."
        breadcrumb={
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="transition-colors hover:text-primary/90"
            >
              Admin
            </button>
            <span>/</span>
            <span>Data Quality</span>
            <span>/</span>
            <span className="text-foreground/90">Deduplication</span>
          </nav>
        }
        primaryAction={{
          label: "Run dedup now",
          icon: <Play className="h-4 w-4" />,
          onClick: runDedupNow,
        }}
        secondaryActions={[
          {
            label: "Schedule job",
            icon: <CalendarClock className="h-4 w-4" />,
            onClick: () => setScheduleOpen(true),
            variant: "secondary",
          },
          {
            label: "Dedup settings",
            icon: <Settings2 className="h-4 w-4" />,
            onClick: () => setSettingsOpen(true),
            variant: "secondary",
          },
          {
            label: "Export report",
            icon: <Download className="h-4 w-4" />,
            onClick: exportReport,
            variant: "secondary",
          },
        ]}
      />

      <GlassCard className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md">
        <div className="grid gap-5 xl:grid-cols-[1.8fr_1.2fr]">
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Mode + scope
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Compact scope chips keep the scan boundary visible without taking over the
                workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ScopeChip
                icon={<Database className="h-4 w-4" />}
                label="Repository / collection"
                value={`${repositoryScope} · ${collectionScope}`}
              >
                <div className="space-y-4">
                  <SelectionList
                    title="Repository"
                    options={REPOSITORY_OPTIONS}
                    value={repositoryScope}
                    onChange={(value) => setRepositoryScope(value as RepositoryScope)}
                  />
                  <SelectionList
                    title="Collection"
                    options={COLLECTION_OPTIONS}
                    value={collectionScope}
                    onChange={(value) => setCollectionScope(value as CollectionScope)}
                  />
                </div>
              </ScopeChip>
              <ScopeChip
                icon={<Building2 className="h-4 w-4" />}
                label="Plant / site"
                value={plantScope}
              >
                <SelectionList
                  title="Plant / site"
                  options={PLANT_OPTIONS}
                  value={plantScope}
                  onChange={(value) => setPlantScope(value as PlantScope)}
                />
              </ScopeChip>
              <ScopeChip
                icon={<FileStack className="h-4 w-4" />}
                label="Document classes"
                value={summarizeList(
                  appliedFilters.documentClasses,
                  "Specs, Drawings, Vendor docs",
                )}
              >
                <MultiSelectChipPicker
                  label="Document class"
                  summary={summarizeList(appliedFilters.documentClasses, "All classes")}
                  options={DEDUP_CLASS_OPTIONS}
                  value={draftFilters.documentClasses}
                  onChange={(next) =>
                    setDraftFilters((current) => ({
                      ...current,
                      documentClasses: next,
                    }))
                  }
                  icon={<FileStack className="h-4 w-4" />}
                />
              </ScopeChip>
              <DateRangePickerChip
                label="Upload date range"
                start={scopeDateFrom}
                end={scopeDateTo}
                onStartChange={setScopeDateFrom}
                onEndChange={setScopeDateTo}
                icon={<CalendarClock className="h-4 w-4" />}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-teal-500/20 bg-card/35 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Dedup mode
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Mode changes re-query the candidate list in place. No page reloads.
                </p>
              </div>
              <Badge variant={dedupMode === "fingerprint" ? "success" : "info"}>
                {dedupMode === "fingerprint" ? "Operational default" : "Quick scan"}
              </Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setDedupMode("metadata")}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  dedupMode === "metadata"
                    ? "border-teal-400/35 bg-teal-500/12 shadow-[0_18px_40px_rgba(20,184,166,0.12)]"
                    : "border-border/60 bg-card hover:border-border hover:bg-card/80"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">Metadata only</p>
                  <div
                    className={`h-3 w-3 rounded-full border ${dedupMode === "metadata" ? "border-teal-300 bg-teal-300" : "border-border"}`}
                  />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Use metadata keys (number, title, revision, class, file size) without reading file
                  content.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDedupMode("fingerprint")}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  dedupMode === "fingerprint"
                    ? "border-teal-400/35 bg-teal-500/12 shadow-[0_18px_40px_rgba(20,184,166,0.12)]"
                    : "border-border/60 bg-card hover:border-border hover:bg-card/80"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    Metadata + content fingerprint
                  </p>
                  <div
                    className={`h-3 w-3 rounded-full border ${dedupMode === "fingerprint" ? "border-teal-300 bg-teal-300" : "border-border"}`}
                  />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Use metadata plus a sparse file hash computed from 64 KB at the start, middle, and
                  end of the file. Fingerprints are stored with document records for reuse.
                </p>
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <SettingRow
                title="For high-value classes, confirm with full-file hash when required."
                description="Use the stored full-file hash only for selected classes such as regulatory packs, vendor-critical drawings, or legal evidence bundles."
                control={
                  <Switch
                    checked={confirmFullHash}
                    onCheckedChange={setConfirmFullHash}
                    aria-label="Confirm with full file hash when required"
                  />
                }
              />
              <SettingRow
                title="Include archived documents."
                description="Archived records stay visible to admins for cleanup, but remain hidden from general operations unless explicitly included."
                control={
                  <Switch
                    checked={includeArchived}
                    onCheckedChange={setIncludeArchived}
                    aria-label="Include archived documents"
                  />
                }
              />
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-3.5 border-border/50 bg-card/40 backdrop-blur-md">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Filter row
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Narrow candidate groups without leaving the console. Filters are applied explicitly to
              mirror backend query behavior.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={groupSource === "backend" ? "success" : "info"}>
              {groupSource === "backend" ? "API-backed groups" : "Fallback dataset"}
            </Badge>
            <div className="rounded-full border border-teal-500/20 bg-teal-500/8 px-3 py-1.5 text-xs text-teal-100">
              {isLoadingGroups ? "Loading duplicate groups…" : jobStatus}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 items-center">
          <MultiSelectChipPicker
            label="Document class"
            summary={summarizeList(draftFilters.documentClasses, "All classes")}
            options={DEDUP_CLASS_OPTIONS}
            value={draftFilters.documentClasses}
            onChange={(next) =>
              setDraftFilters((current) => ({
                ...current,
                documentClasses: next,
              }))
            }
            icon={<Filter className="h-4 w-4" />}
          />
          <Select
            value={draftFilters.sourceSystem}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                sourceSystem: event.target.value,
              }))
            }
            className="min-w-[190px] h-9"
          >
            <option value="All sources">All sources</option>
            {DEDUP_SOURCE_SYSTEM_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <OwnerPicker
            value={draftFilters.owner}
            onChange={(value) => setDraftFilters((current) => ({ ...current, owner: value }))}
          />
          <DateRangePickerChip
            label="Upload date range"
            start={draftFilters.uploadFrom}
            end={draftFilters.uploadTo}
            onStartChange={(value) =>
              setDraftFilters((current) => ({ ...current, uploadFrom: value }))
            }
            onEndChange={(value) => setDraftFilters((current) => ({ ...current, uploadTo: value }))}
            icon={<CalendarClock className="h-4 w-4" />}
            compact
          />
          <Select
            value={String(draftFilters.minSizeBytes)}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                minSizeBytes: Number(event.target.value),
              }))
            }
            className="min-w-[170px] h-9"
          >
            <option value="0">Any size</option>
            {DEDUP_MIN_SIZE_OPTIONS.map((option) => (
              <option key={option.bytes} value={option.bytes}>
                {option.label}
              </option>
            ))}
          </Select>
          <div className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={draftFilters.search}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Document number / title / part number"
              className="w-full pl-9 h-9"
            />
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="h-9"
              onClick={() => setAppliedFilters({ ...draftFilters })}
            >
              Apply filters
            </Button>
            <Button variant="ghost" className="h-9" onClick={resetFilters}>
              Reset
            </Button>
            <Button
              variant="secondary"
              className="h-9"
              onClick={() => setPendingAction({ type: "scan_missing_hashes" })}
            >
              <ScanSearch className="h-4 w-4" />
              Scan missing hashes
            </Button>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="overflow-hidden border-border/50 bg-card/40 backdrop-blur-md">
        <div className="border-b border-border/70 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="info">{summaryStats.groups} groups</Badge>
              <Badge variant="default">{summaryStats.documents} documents</Badge>
              <Badge variant="success">{formatBytes(summaryStats.savings)} potential savings</Badge>
            </div>
            {bulkSelectedGroupIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100">
                <span>{bulkSelectedGroupIds.length} groups selected</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingAction({ type: "bulk_ignore" })}
                >
                  Ignore selected
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setBulkSelectedGroupIds([])}>
                  Clear
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-auto custom-scrollbar">
          <table className="min-w-[1420px] w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-20 bg-popover/95 backdrop-blur-xl">
              <tr className="border-b border-border/70 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <th className="sticky left-0 z-30 border-b border-border/70 bg-popover/95 px-4 py-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) =>
                        setBulkSelectedGroupIds(event.target.checked ? allVisibleGroupIds : [])
                      }
                      className="h-4 w-4 accent-teal-400"
                    />
                    Group / document
                  </label>
                </th>
                <th className="border-b border-border/70 px-4 py-3">Title / description</th>
                <th className="border-b border-border/70 px-4 py-3">Document / drawing / part</th>
                <th className="border-b border-border/70 px-4 py-3">Revision</th>
                <th className="border-b border-border/70 px-4 py-3">Class / type</th>
                <th className="border-b border-border/70 px-4 py-3">File size</th>
                <th className="border-b border-border/70 px-4 py-3">Metadata key</th>
                <th className="border-b border-border/70 px-4 py-3">Content fingerprint</th>
                <th className="border-b border-border/70 px-4 py-3">Upload details</th>
                <th className="border-b border-border/70 px-4 py-3">References</th>
                <th className="border-b border-border/70 px-4 py-3">Group status</th>
              </tr>
            </thead>
            <tbody>
              {displayedGroups.map((group) => {
                const groupStatus = getStatusMeta(group.derivedStatus, dedupMode);
                return (
                  <Fragment key={group.id}>
                    <tr className="bg-popover/75">
                      <td colSpan={11} className="border-y border-border/70 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                handleBulkToggle(group.id, !bulkSelectedGroupIds.includes(group.id))
                              }
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-all ${
                                bulkSelectedGroupIds.includes(group.id)
                                  ? "border-teal-400/35 bg-teal-500/12 text-teal-100"
                                  : "border-border/60 bg-card text-muted-foreground hover:border-border"
                              }`}
                            >
                              {bulkSelectedGroupIds.includes(group.id) ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <span className="h-2 w-2 rounded-full bg-current" />
                              )}
                            </button>
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                Group {group.id} · {group.visibleDocuments.length} docs · Potential
                                savings: {formatBytes(group.potentialSavingsBytes)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {group.repository} · {group.collection} · {group.plant}
                              </p>
                            </div>
                            <Badge variant={groupStatus.variant}>{groupStatus.label}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedGroupId(group.id)}
                            >
                              Choose master
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedGroupId(group.id);
                                setPendingAction({
                                  type: "mark_non_duplicate",
                                  groupId: group.id,
                                });
                              }}
                            >
                              Mark non-duplicates
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setSelectedGroupId(group.id)}
                            >
                              Open in side panel
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {group.visibleDocuments.map((doc) => {
                      const fingerprint = getFingerprintMeta(doc.fingerprintState);
                      const selected = selectedGroupId === group.id;
                      return (
                        <tr
                          key={doc.id}
                          data-document-id={doc.id}
                          data-document-title={doc.title}
                          onClick={() => setSelectedGroupId(group.id)}
                          className={`cursor-pointer border-b border-border/70 transition-colors ${selected ? "bg-teal-500/7" : "hover:bg-card/45"}`}
                        >
                          <td className="sticky left-0 z-10 border-b border-border/70 bg-popover/90 px-4 py-3 align-top">
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={bulkSelectedGroupIds.includes(group.id)}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) =>
                                  handleBulkToggle(group.id, event.target.checked)
                                }
                                className="mt-1 h-4 w-4 accent-teal-400"
                              />
                              <div className="min-w-0">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    navigate(`/documents/${doc.id}`);
                                  }}
                                  className="font-mono text-xs text-primary/90 transition-colors hover:text-teal-100"
                                >
                                  {doc.id}
                                </button>
                                <p className="mt-1 text-[11px] text-muted-foreground">{group.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="border-b border-border/70 px-4 py-3 align-top">
                            <p className="font-medium text-foreground">{doc.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {doc.isArchived ? "Archived copy" : "Active repository record"} ·{" "}
                              {group.collection}
                            </p>
                          </td>
                          <td className="border-b border-border/70 px-4 py-3 align-top">
                            <div className="space-y-1 text-xs">
                              <p className="font-mono text-foreground">{doc.documentNumber}</p>
                              <p className="text-muted-foreground">{doc.drawingNumber ?? "—"}</p>
                              <p className="text-teal-200">PL-{doc.partNumber ?? "—"}</p>
                            </div>
                          </td>
                          <td className="border-b border-border/70 px-4 py-3 align-top">
                            <span className="font-mono text-xs text-foreground">
                              {doc.revision}
                            </span>
                          </td>
                          <td className="border-b border-border/70 px-4 py-3 align-top">
                            <div className="space-y-1 text-xs">
                              <p className="text-foreground">{doc.className}</p>
                              <p className="text-muted-foreground">{doc.type}</p>
                            </div>
                          </td>
                          <td className="border-b border-border/70 px-4 py-3 align-top">
                            <span className="font-mono text-xs text-foreground">
                              {formatBytes(doc.fileSizeBytes)}
                            </span>
                          </td>
                          <td className="border-b border-border/70 px-4 py-3 align-top">
                            <code className="rounded-lg border border-border/70 bg-card/50 px-2 py-1 text-[11px] text-foreground/90">
                              {doc.metadataKey}
                            </code>
                          </td>
                          <td className="border-b border-border/70 px-4 py-3 align-top">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${fingerprint.className}`}
                            >
                              {fingerprint.label}
                            </span>
                          </td>
                          <td className="border-b border-border/70 px-4 py-3 align-top">
                            <div className="space-y-1 text-xs">
                              <p className="text-foreground">{formatDate(doc.uploadDate)}</p>
                              <p className="text-muted-foreground">{doc.uploader}</p>
                              <p className="text-muted-foreground">{doc.sourceSystem}</p>
                            </div>
                          </td>
                          <td className="border-b border-border/70 px-4 py-3 align-top">
                            <div className="space-y-1 text-xs">
                              <p className="font-semibold text-foreground">
                                {totalReferences(doc)} linked
                              </p>
                              <p className="text-muted-foreground">
                                ERP {doc.references.erp} · Work {doc.references.work}
                              </p>
                              <p className="text-muted-foreground">
                                Config {doc.references.config} · Approvals{" "}
                                {doc.references.approvals}
                              </p>
                            </div>
                          </td>
                          <td className="border-b border-border/70 px-4 py-3 align-top">
                            <Badge variant={groupStatus.variant}>{groupStatus.label}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}

              {displayedGroups.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-6 py-20 text-center">
                    <BadgeAlert className="mx-auto h-10 w-10 text-muted-foreground" />
                    <p className="mt-4 text-sm font-semibold text-foreground">
                      No candidate groups match the current scope and filters.
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Reset the review filters or widen the scope chips to bring duplicate groups
                      back into view.
                    </p>
                    <div className="mt-4">
                      <Button variant="secondary" onClick={resetFilters}>
                        <RefreshCcw className="h-4 w-4" />
                        Reset filters
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="max-w-2xl rounded-3xl border border-teal-500/20 bg-popover/96 p-0 text-foreground shadow-2xl shadow-slate-950/80">
          <div className="border-b border-border/70 px-6 py-5">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-xl text-foreground">Schedule dedup job</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Queue recurring metadata and fingerprint scans without leaving the console.
                Scheduling remains non-blocking and preserves the current scope.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
            <SettingRow
              title="Run cadence"
              description="Use off-peak scheduling for large hash backfill and storage reclamation sweeps."
              control={
                <Select
                  value={scheduleForm.cadence}
                  onChange={(event) =>
                    setScheduleForm((current) => ({
                      ...current,
                      cadence: event.target.value,
                    }))
                  }
                >
                  <option>Daily</option>
                  <option>Weekly</option>
                  <option>Monthly</option>
                </Select>
              }
            />
            <SettingRow
              title="Notify on completion"
              description="Send an in-app notification and email summary after the scheduled run finishes."
              control={
                <Switch
                  checked={scheduleForm.notify}
                  onCheckedChange={(checked) =>
                    setScheduleForm((current) => ({
                      ...current,
                      notify: checked,
                    }))
                  }
                />
              }
            />
            <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
              <DatePicker
                value={scheduleForm.runDate}
                onChange={(value) => setScheduleForm((current) => ({ ...current, runDate: value }))}
                label="Next run date"
              />
              <div>
                <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Run time
                </span>
                <Select
                  value={scheduleForm.runTime}
                  onChange={(event) =>
                    setScheduleForm((current) => ({
                      ...current,
                      runTime: event.target.value,
                    }))
                  }
                  className="w-full"
                >
                  <option>00:30</option>
                  <option>02:00</option>
                  <option>03:30</option>
                  <option>22:00</option>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-border/70 px-6 py-4 sm:justify-between">
            <div className="text-xs text-muted-foreground">
              Scheduled jobs respect document visibility, repository scope, and the current dedup
              mode.
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setScheduleOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setScheduleOpen(false);
                  setJobStatus(
                    `Scheduled ${scheduleForm.cadence.toLowerCase()} dedup job for ${formatDate(scheduleForm.runDate)} at ${scheduleForm.runTime}.`,
                  );
                  toast.success("Dedup job scheduled", {
                    description: `${scheduleForm.cadence} at ${scheduleForm.runTime}`,
                  });
                }}
              >
                Save schedule
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-3xl rounded-3xl border border-teal-500/20 bg-popover/96 p-0 text-foreground shadow-2xl shadow-slate-950/80">
          <div className="border-b border-border/70 px-6 py-5">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-xl text-foreground">Dedup settings</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Tune the console against the PostgreSQL hash-index strategy: compute sparse
                fingerprints once, reuse them, and escalate to full hashes only when class risk
                requires it.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid gap-4 px-6 py-5">
            <SettingRow
              title="Hash algorithm"
              description="Persist hash metadata with algorithm and version so future migrations can be staged without reprocessing the entire repository at request time."
              control={
                <Select
                  value={settingsForm.hashAlgo}
                  onChange={(event) =>
                    setSettingsForm((current) => ({
                      ...current,
                      hashAlgo: event.target.value,
                    }))
                  }
                >
                  <option>BLAKE3</option>
                  <option>SHA-256</option>
                </Select>
              }
            />
            <SettingRow
              title="Hash version"
              description="Fingerprint versioning keeps comparisons stable when chunking rules or hash algorithms change."
              control={
                <Select
                  value={settingsForm.hashVersion}
                  onChange={(event) =>
                    setSettingsForm((current) => ({
                      ...current,
                      hashVersion: event.target.value,
                    }))
                  }
                >
                  <option>1</option>
                  <option>2</option>
                  <option>3</option>
                </Select>
              }
            />
            <SettingRow
              title="Inline fingerprint threshold"
              description="Keep large file hashing out of the request path after this threshold; schedule background workers instead."
              control={
                <Select
                  value={settingsForm.inlineFingerprintLimit}
                  onChange={(event) =>
                    setSettingsForm((current) => ({
                      ...current,
                      inlineFingerprintLimit: event.target.value,
                    }))
                  }
                >
                  <option>25 MB</option>
                  <option>50 MB</option>
                  <option>100 MB</option>
                </Select>
              }
            />
            <SettingRow
              title="Index collection-wide fingerprints"
              description="Reuse stored sparse/full hashes across collections and repeated uploads to avoid recalculating identical content."
              control={
                <Switch
                  checked={settingsForm.indexCollectionWide}
                  onCheckedChange={(checked) =>
                    setSettingsForm((current) => ({
                      ...current,
                      indexCollectionWide: checked,
                    }))
                  }
                />
              }
            />
          </div>
          <DialogFooter className="border-t border-border/70 px-6 py-4 sm:justify-between">
            <div className="text-xs text-muted-foreground">
              Recommended backend: size-first filtering, sparse hash reuse, full-hash confirmation
              for high-value classes only.
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setSettingsOpen(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setSettingsOpen(false);
                  toast.success("Dedup settings updated", {
                    description: `${settingsForm.hashAlgo} v${settingsForm.hashVersion}`,
                  });
                }}
              >
                Save settings
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingAction}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent className="rounded-3xl border border-teal-500/20 bg-popover/96 text-foreground shadow-2xl shadow-slate-950/80">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              {pendingDialogCopy?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {pendingDialogCopy?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border border-border/60 bg-card text-foreground/90 hover:bg-card/80"
              disabled={actionBusy}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-teal-500/15 text-teal-100 hover:bg-teal-500/25"
              onClick={handleConfirmAction}
              disabled={actionBusy}
            >
              {actionBusy ? "Processing..." : pendingDialogCopy?.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
