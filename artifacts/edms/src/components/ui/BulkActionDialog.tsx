/**
 * BulkActionDialog — dialog for confirming bulk operations on selected items.
 * Shows count of affected items with clear messaging.
 */

import { AlertTriangle, Loader2 } from "lucide-react";
import React from "react";
import { Badge } from "./badge";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";

export interface BulkAction {
  key: string;
  label: string;
  description?: string;
  variant?: "destructive" | "warning" | "default";
}

export interface BulkActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  actions: BulkAction[];
  onAction: (actionKey: string) => void | Promise<void>;
  isLoading?: boolean;
  entityLabel?: string;
}

export function BulkActionDialog({
  open,
  onOpenChange,
  selectedCount,
  actions,
  onAction,
  isLoading = false,
  entityLabel = "item",
}: BulkActionDialogProps) {
  const [activeAction, setActiveAction] = React.useState<string | null>(null);

  const handleAction = async (key: string) => {
    setActiveAction(key);
    try {
      await onAction(key);
    } finally {
      setActiveAction(null);
    }
  };

  const plural = selectedCount === 1 ? entityLabel : `${entityLabel}s`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Bulk Action
            <Badge variant="secondary">
              {selectedCount} {plural} selected
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Choose an action to apply to all {selectedCount} selected {plural}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2">
          {actions.map((action) => {
            const isActive = activeAction === action.key;
            return (
              <div
                key={action.key}
                className="flex items-start gap-3 rounded-md border p-3 hover:bg-muted/40 transition-colors"
              >
                {action.variant === "destructive" && (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{action.label}</p>
                  {action.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{action.description}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={
                    action.variant === "destructive"
                      ? "destructive"
                      : action.variant === "warning"
                        ? "secondary"
                        : "default"
                  }
                  disabled={isLoading || activeAction !== null}
                  onClick={() => handleAction(action.key)}
                  className="shrink-0"
                >
                  {isActive && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  {action.label}
                </Button>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
