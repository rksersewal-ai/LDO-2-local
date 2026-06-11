/**
 * DataTable — shared, reusable table component with sorting, filtering,
 * pagination, multi-select, and density toggle.
 *
 * Eliminates duplicated table patterns across WorkLedger, DocumentHub,
 * SearchExplorer, and AuditLog pages.
 */

import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp } from "lucide-react";
import type React from "react";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Spinner } from "./spinner";

// ─── Column Definition ────────────────────────────────────────────────────────

export type SortDirection = "asc" | "desc" | null;

export interface DataTableColumn<T> {
  key: string;
  header: string | React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  /** Enable sorting on this column */
  sortable?: boolean;
  /** Fixed column width */
  width?: string | number;
  /** Align cell content */
  align?: "left" | "center" | "right";
  /** Hide on smaller screens */
  hidden?: boolean;
}

export interface SortState {
  key: string;
  direction: SortDirection;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DataTableProps<T extends { id: string }> {
  data: T[];
  columns: DataTableColumn<T>[];
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  emptyState?: React.ReactNode;

  /** Accessible name for the table (announced by screen readers) */
  caption?: string;

  // Sorting
  sort?: SortState;
  onSort?: (sort: SortState) => void;

  // Selection
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;

  // Pagination
  page?: number;
  pageSize?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;

  // Density
  density?: "dense" | "normal";

  // Row click
  onRowClick?: (row: T) => void;
  getRowClassName?: (row: T) => string;

  className?: string;
}

// ─── Sort Icon ────────────────────────────────────────────────────────────────

function SortIcon({ direction }: { direction: SortDirection }) {
  if (direction === "asc") return <ChevronUp className="h-3.5 w-3.5 ml-1 inline-block" />;
  if (direction === "desc") return <ChevronDown className="h-3.5 w-3.5 ml-1 inline-block" />;
  return <ChevronsUpDown className="h-3.5 w-3.5 ml-1 inline-block opacity-40" />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DataTable<T extends { id: string }>({
  data,
  columns,
  isLoading = false,
  error = null,
  emptyMessage = "No records found.",
  emptyState,
  caption,
  sort,
  onSort,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  page = 1,
  pageSize = 25,
  totalCount,
  onPageChange,
  density = "normal",
  onRowClick,
  getRowClassName,
  className,
}: DataTableProps<T>) {
  const rowHeight = density === "dense" ? "h-9" : "h-10";
  const visibleCols = columns.filter((c) => !c.hidden);
  const totalPages = totalCount != null ? Math.ceil(totalCount / pageSize) : undefined;
  const isAllSelected = selectable && data.length > 0 && selectedIds?.size === data.length;
  const isPartial = selectable && (selectedIds?.size ?? 0) > 0 && !isAllSelected;

  const handleSort = useCallback(
    (col: DataTableColumn<T>) => {
      if (!col.sortable || !onSort) return;
      if (sort?.key === col.key) {
        const next: SortDirection =
          sort.direction === "asc" ? "desc" : sort.direction === "desc" ? null : "asc";
        onSort({ key: col.key, direction: next });
      } else {
        onSort({ key: col.key, direction: "asc" });
      }
    },
    [sort, onSort],
  );

  return (
    <div className={cn("flex flex-col gap-0", className)}>
      {/* Table */}
      <div className="relative w-full overflow-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full caption-bottom text-sm" aria-label={caption}>
          {caption && <caption className="sr-only">{caption}</caption>}
          {/* Sticky header */}
          <thead className="sticky top-0 z-10 border-b bg-muted/50">
            <tr>
              {selectable && (
                <th className="w-9 px-2 py-1.5">
                  <Checkbox
                    checked={isAllSelected ? true : isPartial ? "indeterminate" : false}
                    onCheckedChange={onToggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
              )}
              {visibleCols.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={cn(
                    "select-none px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground",
                    col.align === "center" && "text-center",
                    col.align === "right" && "text-right",
                    col.sortable && "cursor-pointer hover:text-foreground transition-colors",
                  )}
                  onClick={() => handleSort(col)}
                >
                  {col.header}
                  {col.sortable && (
                    <SortIcon direction={sort?.key === col.key ? (sort.direction ?? null) : null} />
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="[&_tr:last-child]:border-0">
            {isLoading ? (
              <tr>
                <td
                  colSpan={visibleCols.length + (selectable ? 1 : 0)}
                  className="py-12 text-center"
                >
                  <Spinner className="mx-auto h-5 w-5" />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan={visibleCols.length + (selectable ? 1 : 0)}
                  className="py-10 text-center text-sm text-destructive"
                >
                  {error}
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleCols.length + (selectable ? 1 : 0)}
                  className={cn(
                    "text-center text-sm text-muted-foreground",
                    emptyState ? "p-4" : "py-10",
                  )}
                >
                  {emptyState ?? emptyMessage}
                </td>
              </tr>
            ) : (
              // Pagination is the current DOM-size safeguard; virtualization can be added here if large unpaged datasets appear.
              data.map((row, index) => {
                const isRowSelected = selectable && (selectedIds?.has(row.id) ?? false);
                return (
                  <tr
                    key={row.id}
                    data-state={isRowSelected ? "selected" : undefined}
                    className={cn(
                      "border-b text-[13px] transition-colors",
                      rowHeight,
                      isRowSelected ? "bg-accent" : "hover:bg-muted/50",
                      onRowClick && "cursor-pointer",
                      getRowClassName?.(row),
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {selectable && (
                      <td className="w-9 px-2 py-0">
                        <Checkbox
                          checked={isRowSelected}
                          onCheckedChange={() => onToggleSelect?.(row.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select row ${index + 1}`}
                        />
                      </td>
                    )}
                    {visibleCols.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-2.5 py-0 align-middle",
                          col.align === "center" && "text-center",
                          col.align === "right" && "text-right",
                        )}
                      >
                        {col.cell(row, index)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages != null && totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between px-2 py-2 text-xs text-muted-foreground">
          <span>
            {totalCount != null &&
              `${Math.min((page - 1) * pageSize + 1, totalCount)}–${Math.min(page * pageSize, totalCount)} of ${totalCount}`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
