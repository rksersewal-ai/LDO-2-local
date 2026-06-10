import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow-xs",
        neutral: "border-border bg-secondary text-secondary-foreground",
        secondary: "border-border bg-secondary text-secondary-foreground",
        success:
          "border-[color:color-mix(in_oklab,var(--status-success)_35%,var(--border))] bg-[color-mix(in_oklab,var(--status-success)_12%,transparent)] text-[color:var(--status-success)]",
        warning:
          "border-[color:color-mix(in_oklab,var(--status-warning)_38%,var(--border))] bg-[color-mix(in_oklab,var(--status-warning)_14%,transparent)] text-[color:var(--status-warning)]",
        danger:
          "border-[color:color-mix(in_oklab,var(--status-danger)_38%,var(--border))] bg-[color-mix(in_oklab,var(--status-danger)_12%,transparent)] text-[color:var(--status-danger)]",
        destructive: "border-transparent bg-destructive text-destructive-foreground shadow-xs",
        info: "border-[color:color-mix(in_oklab,var(--status-info)_35%,var(--border))] bg-[color-mix(in_oklab,var(--status-info)_12%,transparent)] text-[color:var(--status-info)]",
        processing:
          "border-[color:color-mix(in_oklab,var(--status-processing)_35%,var(--border))] bg-[color-mix(in_oklab,var(--status-processing)_12%,transparent)] text-[color:var(--status-processing)] motion-safe:animate-pulse",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
