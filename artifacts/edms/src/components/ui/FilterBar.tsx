/**
 * FilterBar — shared filter panel with faceted and inline variants.
 * Eliminates duplicated filter UIs across SearchExplorer, AuditLog, DocumentHub.
 */

import { SlidersHorizontal, X } from "lucide-react";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import { Button } from "./button";
import { Input } from "./input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

// ─── Filter Definitions ───────────────────────────────────────────────────────

export type FilterValue = string | string[] | null;

export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

export interface FilterField {
  key: string;
  label: string;
  type: "select" | "multiselect" | "text" | "date" | "daterange";
  options?: FilterOption[];
  placeholder?: string;
}

export type FilterValues = Record<string, FilterValue>;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FilterBarProps {
  fields: FilterField[];
  values: FilterValues;
  onChange: (key: string, value: FilterValue) => void;
  onClear: () => void;
  /** 'inline' renders fields horizontally; 'faceted' stacks them vertically */
  variant?: "inline" | "faceted";
  /** Active filter count badge */
  activeCount?: number;
  className?: string;
}

// ─── Active filter count helper ───────────────────────────────────────────────

function countActive(values: FilterValues): number {
  return Object.values(values).filter(
    (v) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0),
  ).length;
}

// ─── FilterChip ───────────────────────────────────────────────────────────────

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="flex items-center gap-1 pr-1 text-xs">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-sm hover:bg-muted/60 p-0.5 transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FilterBar({
  fields,
  values,
  onChange,
  onClear,
  variant = "inline",
  className,
}: FilterBarProps) {
  const active = countActive(values);

  const renderField = useCallback(
    (field: FilterField) => {
      const value = values[field.key] ?? "";

      if (field.type === "select") {
        return (
          <Select
            key={field.key}
            value={(value as string) || ""}
            onValueChange={(v) => onChange(field.key, v || null)}
          >
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder={field.placeholder ?? field.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All {field.label}</SelectItem>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                  {opt.count != null && (
                    <span className="ml-1 text-muted-foreground">({opt.count})</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      if (field.type === "text") {
        return (
          <Input
            key={field.key}
            value={(value as string) || ""}
            onChange={(e) => onChange(field.key, e.target.value || null)}
            placeholder={field.placeholder ?? `Filter by ${field.label}…`}
            className="h-8 w-44 text-xs"
          />
        );
      }

      if (field.type === "date") {
        return (
          <Input
            key={field.key}
            type="date"
            value={(value as string) || ""}
            onChange={(e) => onChange(field.key, e.target.value || null)}
            className="h-8 w-36 text-xs"
          />
        );
      }

      return null;
    },
    [values, onChange],
  );

  // Build active chips for applied filters
  const chips: { key: string; label: string }[] = [];
  for (const field of fields) {
    const v = values[field.key];
    if (!v || (Array.isArray(v) && v.length === 0)) continue;
    const display = Array.isArray(v) ? v.join(", ") : (v as string);
    const optLabel = field.options?.find((o) => o.value === display)?.label ?? display;
    chips.push({ key: field.key, label: `${field.label}: ${optLabel}` });
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Filter controls */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          variant === "faceted" && "flex-col items-start",
        )}
      >
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Filters</span>
          {active > 0 && (
            <Badge variant="default" className="h-4 px-1.5 text-[10px]">
              {active}
            </Badge>
          )}
        </div>
        {fields.map(renderField)}
        {active > 0 && (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onClear}>
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <FilterChip
              key={chip.key}
              label={chip.label}
              onRemove={() => onChange(chip.key, null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
