/**
 * ExportButton — shared export button supporting CSV, Excel, and JSON.
 * Eliminates duplicated export logic across AuditLog, DocumentHub, WorkLedger.
 */

import { Braces, ChevronDown, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

export type ExportFormat = "csv" | "excel" | "json";

export interface ExportButtonProps {
  /** Called with the chosen format. Should return a Promise that resolves when export is done. */
  onExport: (format: ExportFormat) => Promise<void>;
  /** Formats to offer. Defaults to ['csv', 'excel'] */
  formats?: ExportFormat[];
  /** Button label */
  label?: string;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
}

const FORMAT_META: Record<ExportFormat, { label: string; icon: React.ReactNode }> = {
  csv: { label: "Export as CSV", icon: <FileText className="h-4 w-4" /> },
  excel: {
    label: "Export as Excel (.xlsx)",
    icon: <FileSpreadsheet className="h-4 w-4" />,
  },
  json: { label: "Export as JSON", icon: <Braces className="h-4 w-4" /> },
};

export function ExportButton({
  onExport,
  formats = ["csv", "excel"],
  label = "Export",
  disabled = false,
  className,
  variant = "outline",
}: ExportButtonProps) {
  const [loading, setLoading] = useState<ExportFormat | null>(null);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (loading) return;
      setLoading(format);
      try {
        await onExport(format);
      } finally {
        setLoading(null);
      }
    },
    [loading, onExport],
  );

  // If only one format, render a simple button
  if (formats.length === 1) {
    const fmt = formats[0];
    const isLoading = loading === fmt;
    return (
      <Button
        variant={variant}
        size="sm"
        disabled={disabled || isLoading}
        onClick={() => handleExport(fmt)}
        className={cn("gap-2", className)}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {label}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size="sm"
          disabled={disabled || loading !== null}
          className={cn("gap-2", className)}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {label}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {formats.map((fmt) => (
          <DropdownMenuItem
            key={fmt}
            onClick={() => handleExport(fmt)}
            disabled={loading !== null}
            className="gap-2"
          >
            {loading === fmt ? <Loader2 className="h-4 w-4 animate-spin" /> : FORMAT_META[fmt].icon}
            {FORMAT_META[fmt].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
