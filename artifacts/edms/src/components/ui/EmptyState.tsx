import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./empty";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  primaryAction,
  secondaryAction,
  className = "",
}: EmptyStateProps) {
  const actions = primaryAction || secondaryAction ? (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {primaryAction}
      {secondaryAction}
    </div>
  ) : (
    action
  );

  return (
    <Empty role="status" aria-live="polite" className={className}>
      <EmptyHeader>
        {Icon && (
          <EmptyMedia
            variant="icon"
            className="bg-primary/10 text-primary border border-primary/20"
          >
            <Icon className="w-5 h-5" />
          </EmptyMedia>
        )}
        <EmptyTitle className="text-foreground font-semibold mt-2">{title}</EmptyTitle>
        {description && (
          <EmptyDescription className="max-w-xs text-xs mt-1 leading-relaxed">
            {description}
          </EmptyDescription>
        )}
      </EmptyHeader>
      {actions && <EmptyContent className="mt-2">{actions}</EmptyContent>}
    </Empty>
  );
}
