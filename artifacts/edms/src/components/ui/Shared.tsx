/**
 * Shared UI Components — Canonical Public API
 *
 * This module is the SINGLE import point for standardized UI primitives used
 * across all EDMS pages. It wraps the low-level shadcn/ui primitives with:
 * - Consistent sizing scale (sm / md / lg)
 * - Application-specific variant names (primary / secondary / ghost / danger / teal-outline)
 * - Theme-aware defaults (cursor-pointer, transition durations)
 *
 * Usage:
 *   import { Button, Badge, GlassCard, Input, Select, PageHeader } from "@/components/ui/Shared";
 *
 * Do NOT import from ui/button.tsx or ui/badge.tsx directly in page components
 * unless building a new low-level primitive. Use this module instead.
 */
import React from "react";
import { cn } from "@/lib/utils";
import { Badge as CanonicalBadge } from "./badge";
import { Button as ShadcnButton, type ButtonProps as ShadcnButtonProps } from "./button";
import { Card } from "./card";
import { Input as ShadcnInput } from "./input";

/* ── Card surfaces ──────────────────────────────────────────────────────── */

export function GlassCard({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Card variant="default" className={cn("glass-card", className)} {...props}>
      {children}
    </Card>
  );
}

export function GlassCardTeal({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Card
      variant="default"
      className={cn("glass-card-teal border-primary/30", className)}
      {...props}
    >
      {children}
    </Card>
  );
}

/* ── Status Badge ───────────────────────────────────────────────────────── */

export function Badge({
  children,
  variant = "default",
  size = "md",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "processing" | "info";
  size?: "sm" | "md";
  className?: string;
}) {
  const sizeClass = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]";

  return (
    <CanonicalBadge
      variant={variant}
      className={cn("leading-none tracking-[0.025em]", sizeClass, className)}
    >
      {children}
    </CanonicalBadge>
  );
}

/* ── Button ─────────────────────────────────────────────────────────────── */
/**
 * Standardized Button:
 * – primary: solid teal, no gradient
 * – secondary: bordered ghost on dark surface
 * – ghost: text-only, no border
 * – danger: rose, reserved for destructive actions
 * – teal-outline: teal border + bg tint
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "teal-outline";
  size?: "sm" | "md" | "lg";
}) {
  const variantMap: Record<string, ShadcnButtonProps["variant"]> = {
    primary: "default",
    secondary: "secondary",
    ghost: "ghost",
    danger: "destructive",
    "teal-outline": "outline",
  };
  const sizeMap: Record<string, ShadcnButtonProps["size"]> = {
    sm: "sm",
    md: "default",
    lg: "lg",
  };

  /* Exact style per variant — flat, no gradient */
  const variantCls: Record<string, string> = {
    primary: "cursor-pointer",
    secondary: "cursor-pointer",
    ghost: "cursor-pointer",
    danger: "cursor-pointer",
    "teal-outline": "cursor-pointer",
  };
  const sizeCls: Record<string, string> = {
    sm: "h-8 px-2.5 text-xs gap-1.5",
    md: "h-10 px-3 text-[13px] gap-2",
    lg: "h-12 px-4 text-sm gap-2",
  };

  return (
    <ShadcnButton
      variant={variantMap[variant]}
      size={sizeMap[size]}
      className={cn(
        "font-medium transition-colors duration-150",
        sizeCls[size],
        variantCls[variant],
        className,
      )}
      {...props}
    >
      {children}
    </ShadcnButton>
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className = "", ...props }, ref) => {
  return (
    <ShadcnInput
      ref={ref}
      className={cn(
        "h-10 bg-background hover:border-border transition-colors duration-150 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

/* ── Select ─────────────────────────────────────────────────────────────── */

export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm text-foreground",
        "transition-colors duration-150",
        "focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring/50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/* ── Stat Card ──────────────────────────────────────────────────────────── */

/**
 * KPI metric card with optional colour accent on the top border.
 * Uses `stat-number` class for monospaced tabular figures.
 *
 * @example
 * <StatCard label="Documents" value={1_824} sub="+12 today" colorVariant="teal" />
 */
export function StatCard({
  label,
  value,
  sub,
  accent = false,
  colorVariant = "teal",
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  colorVariant?: "teal" | "amber" | "blue" | "rose" | "violet" | "orange";
}) {
  const topBorder: Record<string, string> = {
    teal: "stat-card-teal",
    amber: "stat-card-amber",
    blue: "stat-card-blue",
    rose: "stat-card-rose",
    violet: "stat-card-violet",
    orange: "stat-card-orange",
  };

  return (
    <div className={cn("stat-card", topBorder[colorVariant] ?? "stat-card-teal")}>
      <div className="flex flex-col gap-1.5 px-3 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
          {label}
        </span>
        <span className={cn("stat-number", accent && "text-primary")}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

/* ── Page Header ────────────────────────────────────────────────────────── */

export interface PageHeaderAction {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
}

export function PageHeader({
  title,
  subtitle,
  primaryAction,
  secondaryActions,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  primaryAction?: PageHeaderAction;
  secondaryActions?: PageHeaderAction[];
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const derivedActions =
    primaryAction || secondaryActions ? (
      <div className="flex items-center gap-2 flex-shrink-0">
        {secondaryActions?.map((action, i) => (
          <Button
            key={i}
            variant={action.variant ?? "secondary"}
            size="md"
            onClick={action.onClick}
          >
            {action.icon && (
              <span className="w-4 h-4" aria-hidden="true">
                {action.icon}
              </span>
            )}
            {action.label}
          </Button>
        ))}
        {primaryAction && (
          <Button
            variant={primaryAction.variant ?? "primary"}
            size="md"
            onClick={primaryAction.onClick}
          >
            {primaryAction.icon && (
              <span className="w-4 h-4" aria-hidden="true">
                {primaryAction.icon}
              </span>
            )}
            {primaryAction.label}
          </Button>
        )}
      </div>
    ) : null;

  const actionContent = actions ?? children ?? derivedActions;

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1
            className="text-[22px] font-semibold leading-tight text-foreground"
            style={{ letterSpacing: "-0.01em" }}
          >
            {title}
          </h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {actionContent && (
          <div className="flex items-center gap-2 flex-shrink-0">{actionContent}</div>
        )}
      </div>
    </div>
  );
}

/* ── Filter Pills ───────────────────────────────────────────────────────── */

export function FilterPills({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset className="flex flex-wrap gap-1.5" aria-label="Filter options">
      {options.map((opt) => (
        <button
          type="button"
          key={opt}
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={cn(
            "pill-filter",
            value === opt ? "pill-filter-active" : "pill-filter-inactive",
          )}
        >
          {opt}
        </button>
      ))}
    </fieldset>
  );
}
