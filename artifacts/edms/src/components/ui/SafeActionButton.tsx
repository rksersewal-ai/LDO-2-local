/**
 * SafeActionButton Component
 *
 * Safe wrapper for dangerous actions (delete, disable, archive).
 * Implements soft-delete (safe, reversible) with confirmation dialog.
 *
 * Design Principles:
 * - No hard deletes (data loss prevented by soft delete)
 * - Confirmation required before any state change
 * - Clear, honest messaging about what will happen
 * - Optional undo capability
 *
 * Usage:
 *   <SafeActionButton
 *     action="delete"
 *     itemName="Work Record WR-2026-001"
 *     onConfirm={() => softDeleteRecord(id)}
 *     message="This record will be marked as archived (soft delete). You can restore it later."
 *   >
 *     <Trash2 className="w-4 h-4" /> Delete
 *   </SafeActionButton>
 */

import { AlertTriangle, Archive, Ban, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";
import { Button } from "./button";

interface SafeActionButtonProps {
  action: "delete" | "archive" | "disable" | "custom";
  itemName?: string;
  message?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  children: React.ReactNode;
  className?: string;
  variant?: "danger" | "warning" | "default";
  isLoading?: boolean;
  disabled?: boolean;
  title?: string;
}

const ACTION_CONFIG = {
  delete: {
    icon: Trash2,
    title: "Archive Item?",
    description:
      "This item will be soft-deleted (archived). You can restore it later. No data is permanently lost.",
    actionLabel: "Archive",
    cancelLabel: "Cancel",
    color: "text-[color:var(--status-danger)]",
  },
  archive: {
    icon: Archive,
    title: "Archive Item?",
    description: "This item will be archived and hidden from normal views.",
    actionLabel: "Archive",
    cancelLabel: "Cancel",
    color: "text-[color:var(--status-warning)]",
  },
  disable: {
    icon: Ban,
    title: "Disable Item?",
    description: "This item will be disabled but remain in the system.",
    actionLabel: "Disable",
    cancelLabel: "Cancel",
    color: "text-muted-foreground",
  },
  custom: {
    icon: AlertTriangle,
    title: "Confirm Action?",
    description: "Please confirm this action.",
    actionLabel: "Confirm",
    cancelLabel: "Cancel",
    color: "text-[color:var(--status-warning)]",
  },
};

export function SafeActionButton({
  action,
  itemName,
  message,
  onConfirm,
  onCancel,
  children,
  className = "",
  variant = "danger",
  isLoading = false,
  disabled = false,
  title,
}: SafeActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const config = ACTION_CONFIG[action];
  const Icon = config.icon;

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      const result = onConfirm();
      if (result instanceof Promise) {
        await result;
      }
      setIsOpen(false);
    } catch (error) {
      console.error(`[SafeActionButton] Error during ${action}:`, error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    onCancel?.();
  };

  const variantStyles = {
    danger: "hover:bg-[color:var(--status-danger)]/10 hover:border-[color:var(--status-danger)]/30 text-[color:var(--status-danger)] hover:text-[color:var(--status-danger)]/80",
    warning: "hover:bg-[color:var(--status-warning)]/10 hover:border-[color:var(--status-warning)]/30 text-[color:var(--status-warning)] hover:text-[color:var(--status-warning)]/80",
    default:
      "hover:bg-muted/50 hover:border-border text-muted-foreground hover:text-foreground",
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        disabled={disabled || isLoading || isProcessing}
        className={`${variantStyles[variant]} transition-colors ${className}`}
        title={`${action.charAt(0).toUpperCase() + action.slice(1)}${itemName ? ` ${itemName}` : ""}`}
      >
        {children}
      </Button>

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <Icon className={`w-5 h-5 ${config.color}`} />
              <AlertDialogTitle>{title || config.title}</AlertDialogTitle>
            </div>
          </AlertDialogHeader>

          <AlertDialogDescription className="space-y-3">
            <p>{message || config.description}</p>
            {itemName && <p className="text-sm font-mono text-foreground/90">{itemName}</p>}
            <p className="text-xs text-muted-foreground italic">
              💡 No data is permanently deleted. Items can be restored from archive.
            </p>
          </AlertDialogDescription>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel} disabled={isProcessing}>
              {config.cancelLabel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isProcessing}
              className="bg-[color:var(--status-danger)]/20 text-[color:var(--status-danger)] border-[color:var(--status-danger)]/30 hover:bg-[color:var(--status-danger)]/30"
            >
              {isProcessing ? "Processing..." : config.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * CommandButton: Safe action button with loading state and error handling
 *
 * Usage:
 *   <CommandButton
 *     onClick={async () => await deleteRecord(id)}
 *     loadingMessage="Deleting..."
 *     successMessage="Record deleted"
 *     errorMessage="Failed to delete"
 *   >
 *     Delete
 *   </CommandButton>
 */
interface CommandButtonProps {
  onClick: () => void | Promise<void>;
  children: React.ReactNode;
  loadingMessage?: string;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  className?: string;
  variant?: "default" | "danger" | "warning";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

export function CommandButton({
  onClick,
  children,
  loadingMessage = "Processing...",
  onSuccess,
  onError,
  className = "",
  variant = "default",
  size = "md",
  disabled = false,
  ..._unusedProps
}: CommandButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      const result = onClick();
      if (result instanceof Promise) {
        await result;
      }
      // Show success (via toast or callback)
      onSuccess?.();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    } finally {
      setIsLoading(false);
    }
  };

  const variantClasses = {
    default: "bg-primary/20 text-primary border-primary/30 hover:bg-primary/30",
    danger: "bg-[color:var(--status-danger)]/20 text-[color:var(--status-danger)] border-[color:var(--status-danger)]/30 hover:bg-[color:var(--status-danger)]/30",
    warning: "bg-[color:var(--status-warning)]/20 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30 hover:bg-[color:var(--status-warning)]/30",
  };

  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-2",
    lg: "text-base px-4 py-2.5",
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading || disabled}
      className={`${variantClasses[variant]} ${sizeClasses[size]} transition-all ${className}`}
    >
      {isLoading ? loadingMessage : children}
    </Button>
  );
}
