import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  FileDiff,
  GitCompareArrows,
  Loader2,
  MoreHorizontal,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { resolveDocumentPreviewPath } from "../../lib/documentPreview";
import type { DocumentMetadataAssertion, DocumentOcrEntity } from "../../lib/types";
import apiClient from "../../services/ApiClient";
import type { DocumentChangeAlert } from "../../services/DocumentChangeAlertService";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Badge, Button } from "../ui/Shared";

type DeltaState = "added" | "removed" | "changed" | "same";

interface DeltaRow {
  key: string;
  latestValues: string[];
  previousValues: string[];
  state: DeltaState;
}

interface DocumentChangeReviewCardProps {
  alert: DocumentChangeAlert;
  className?: string;
  defaultOpen?: boolean;
  busy?: boolean;
  onOpenPl?: () => void;
  onApprove?: () => Promise<void> | void;
  onBypass?: () => Promise<void> | void;
}

function humanizeToken(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeValue(value?: string | null) {
  return String(value ?? "").trim();
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right),
  );
}

function groupAssertions(assertions: DocumentMetadataAssertion[]) {
  return assertions
    .filter((assertion) => assertion.status === "APPROVED")
    .reduce<Record<string, string[]>>((accumulator, assertion) => {
      const key = normalizeValue(assertion.field_key);
      const value = normalizeValue(assertion.normalized_value || assertion.value);
      if (!key || !value) return accumulator;
      accumulator[key] = uniqueSorted([...(accumulator[key] ?? []), value]);
      return accumulator;
    }, {});
}

function groupEntities(entities: DocumentOcrEntity[]) {
  return entities
    .filter((entity) => entity.review_status !== "REJECTED")
    .reduce<Record<string, string[]>>((accumulator, entity) => {
      const key = normalizeValue(entity.entity_type);
      const value = normalizeValue(entity.normalized_value || entity.entity_value);
      if (!key || !value) return accumulator;
      accumulator[key] = uniqueSorted([...(accumulator[key] ?? []), value]);
      return accumulator;
    }, {});
}

function areListsEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function buildDeltaRows(
  latestMap: Record<string, string[]>,
  previousMap: Record<string, string[]>,
) {
  const keys = Array.from(new Set([...Object.keys(previousMap), ...Object.keys(latestMap)]));
  const rank: Record<DeltaState, number> = {
    changed: 0,
    added: 1,
    removed: 2,
    same: 3,
  };

  return keys
    .map<DeltaRow>((key) => {
      const latestValues = latestMap[key] ?? [];
      const previousValues = previousMap[key] ?? [];

      let state: DeltaState = "same";
      if (!previousValues.length && latestValues.length) state = "added";
      else if (previousValues.length && !latestValues.length) state = "removed";
      else if (!areListsEqual(latestValues, previousValues)) state = "changed";

      return { key, latestValues, previousValues, state };
    })
    .sort((left, right) => {
      const rankDelta = rank[left.state] - rank[right.state];
      if (rankDelta !== 0) return rankDelta;
      return left.key.localeCompare(right.key);
    });
}

function stateBadgeVariant(state: DeltaState): "success" | "warning" | "danger" | "default" {
  if (state === "added") return "success";
  if (state === "changed") return "warning";
  if (state === "removed") return "danger";
  return "default";
}

function stateLabel(state: DeltaState) {
  if (state === "added") return "New";
  if (state === "removed") return "Removed";
  if (state === "changed") return "Changed";
  return "Same";
}

function formatValues(values: string[]) {
  return values.length ? values.join(", ") : "—";
}

function DeltaTable({
  title,
  icon,
  rows,
  emptyLabel,
}: {
  title: string;
  icon: ReactNode;
  rows: DeltaRow[];
  emptyLabel: string;
}) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-border/80 bg-slate-950/30 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          {title}
        </div>
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/80 bg-slate-950/30">
      <div className="flex items-center gap-2 border-b border-border/80 px-4 py-3 text-sm font-semibold text-foreground">
        {icon}
        {title}
      </div>
      <div className="divide-y divide-slate-800/70">
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid gap-3 px-4 py-3 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_72px]"
          >
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {humanizeToken(row.key)}
            </div>
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Previous
              </p>
              <p className="text-sm text-foreground/90">{formatValues(row.previousValues)}</p>
            </div>
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Latest
              </p>
              <p className="text-sm text-foreground">{formatValues(row.latestValues)}</p>
            </div>
            <div className="flex items-start justify-start md:justify-end">
              <Badge variant={stateBadgeVariant(row.state)} size="sm">
                {stateLabel(row.state)}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DocumentChangeReviewCard({
  alert,
  className = "",
  defaultOpen = false,
  busy = false,
  onOpenPl,
  onApprove,
  onBypass,
}: DocumentChangeReviewCardProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(defaultOpen);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestAssertions, setLatestAssertions] = useState<DocumentMetadataAssertion[]>([]);
  const [latestEntities, setLatestEntities] = useState<DocumentOcrEntity[]>([]);
  const [previousAssertions, setPreviousAssertions] = useState<DocumentMetadataAssertion[]>([]);
  const [previousEntities, setPreviousEntities] = useState<DocumentOcrEntity[]>([]);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const latestRequests = Promise.all([
      apiClient.getDocumentAssertions(alert.documentId, {
        signal: controller.signal,
      }),
      apiClient.getDocumentEntities(alert.documentId, {
        signal: controller.signal,
      }),
    ]);
    const previousRequests = alert.previousDocumentId
      ? Promise.all([
          apiClient.getDocumentAssertions(alert.previousDocumentId, {
            signal: controller.signal,
          }),
          apiClient.getDocumentEntities(alert.previousDocumentId, {
            signal: controller.signal,
          }),
        ])
      : Promise.resolve<[DocumentMetadataAssertion[], DocumentOcrEntity[]]>([[], []]);

    Promise.all([latestRequests, previousRequests])
      .then(
        ([
          [latestAssertionRows, latestEntityRows],
          [previousAssertionRows, previousEntityRows],
        ]) => {
          setLatestAssertions(latestAssertionRows);
          setLatestEntities(latestEntityRows);
          setPreviousAssertions(previousAssertionRows);
          setPreviousEntities(previousEntityRows);
        },
      )
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        console.error("[DocumentChangeReviewCard] Failed to load comparison evidence", loadError);
        setError("Could not load metadata evidence for this change.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [alert.documentId, alert.previousDocumentId, open]);

  const assertionRows = useMemo(
    () => buildDeltaRows(groupAssertions(latestAssertions), groupAssertions(previousAssertions)),
    [latestAssertions, previousAssertions],
  );
  const entityRows = useMemo(
    () => buildDeltaRows(groupEntities(latestEntities), groupEntities(previousEntities)),
    [latestEntities, previousEntities],
  );

  const latestChangedCount = assertionRows.filter((row) => row.state !== "same").length;
  const entityChangedCount = entityRows.filter((row) => row.state !== "same").length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={`rounded-2xl border border-amber-500/20 bg-amber-500/6 ${className}`}>
        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-300" />
                  <span className="text-sm font-semibold text-foreground">
                    PL {alert.plNumber} change review
                  </span>
                </div>
                <Badge
                  variant={
                    alert.status === "PENDING"
                      ? "warning"
                      : alert.status === "APPROVED"
                        ? "success"
                        : "danger"
                  }
                  size="sm"
                >
                  {alert.status}
                </Badge>
                {alert.documentFamilyKey && (
                  <Badge variant="info" size="sm" className="max-w-full truncate">
                    Family {alert.documentFamilyKey}
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-sm text-foreground">{alert.documentName}</p>
              <p className="mt-1 text-xs text-amber-200">{alert.message}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>Latest rev {alert.revision || "N/A"}</span>
                <span className="text-slate-600">/</span>
                <span>Previous rev {alert.previousRevision || "N/A"}</span>
                {alert.designSupervisor && (
                  <>
                    <span className="text-slate-600">/</span>
                    <span>Supervisor {alert.designSupervisor}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(resolveDocumentPreviewPath(alert.documentId))}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview latest
              </Button>
              {alert.previousDocumentId && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    navigate(
                      alert.previousDocumentId
                        ? resolveDocumentPreviewPath(alert.previousDocumentId)
                        : "/",
                    )
                  }
                >
                  <FileDiff className="h-3.5 w-3.5" />
                  Preview previous
                </Button>
              )}
              {onOpenPl && (
                <Button size="sm" variant="secondary" onClick={onOpenPl}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open PL
                </Button>
              )}
              {(onApprove || onBypass) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" disabled={busy}>
                      <MoreHorizontal className="h-3.5 w-3.5" />
                      Decide
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-52 border border-border/60 bg-slate-950 text-foreground"
                  >
                    <DropdownMenuItem
                      className="focus:bg-secondary"
                      onSelect={() => void onApprove?.()}
                      disabled={!onApprove || busy}
                    >
                      Approve update
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-secondary" />
                    <DropdownMenuItem
                      className="text-rose-200 focus:bg-secondary focus:text-rose-100"
                      onSelect={() => void onBypass?.()}
                      disabled={!onBypass || busy}
                    >
                      Bypass update
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <CollapsibleTrigger asChild>
                <Button size="sm" variant="ghost">
                  <GitCompareArrows className="h-3.5 w-3.5" />
                  {open ? "Hide diff" : "Review diff"}
                  {open ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          {(alert.changeSummary ||
            alert.resolutionNotes ||
            alert.bypassReason ||
            alert.resolvedAt) && (
            <div className="rounded-xl border border-amber-500/15 bg-slate-950/35 px-3 py-3 text-sm">
              {alert.changeSummary && <p className="text-foreground/90">{alert.changeSummary}</p>}
              {alert.resolutionNotes && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Resolution notes: {alert.resolutionNotes}
                </p>
              )}
              {alert.bypassReason && (
                <p className="mt-1 text-xs text-rose-200">Bypass reason: {alert.bypassReason}</p>
              )}
              {alert.resolvedAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Resolved at {new Date(alert.resolvedAt).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>

        <CollapsibleContent>
          <div className="border-t border-amber-500/15 px-4 pb-4 pt-4">
            {loading ? (
              <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-slate-950/30 px-4 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading comparison evidence...
              </div>
            ) : error ? (
              <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 px-4 py-4 text-sm text-rose-200">
                {error}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-border/80 bg-slate-950/35 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Latest document
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">{alert.documentName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{alert.documentId}</p>
                    {alert.documentStatus && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Status: {alert.documentStatus}
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl border border-border/80 bg-slate-950/35 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Previous document
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {alert.previousDocumentName || "No previous linked document"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {alert.previousDocumentId || "—"}
                    </p>
                    {alert.previousDocumentStatus && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Status: {alert.previousDocumentStatus}
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl border border-border/80 bg-slate-950/35 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Approved assertion delta
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">{latestChangedCount}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Changed or newly governed metadata fields.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-slate-950/35 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Extracted entity delta
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">{entityChangedCount}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Changed OCR/entity groups across revisions.
                    </p>
                  </div>
                </div>

                <DeltaTable
                  title="Approved identifiers"
                  icon={<ShieldCheck className="h-4 w-4 text-primary/90" />}
                  rows={assertionRows}
                  emptyLabel="No approved metadata assertions are available for this document pair yet."
                />
                <DeltaTable
                  title="Extracted entities"
                  icon={<ScanSearch className="h-4 w-4 text-indigo-300" />}
                  rows={entityRows}
                  emptyLabel="No extracted entity evidence is available for this document pair yet."
                />
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
