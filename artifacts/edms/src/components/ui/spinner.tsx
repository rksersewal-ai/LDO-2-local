/**
 * Spinner — Inline loading indicator (icon-sized).
 *
 * Use this inside buttons, table cells, or inline contexts where you need
 * a compact spinning indicator without surrounding layout.
 *
 * For full-page or section-level loading states, use `<LoadingState />` instead.
 *
 * @example
 * <Button disabled><Spinner className="mr-2" /> Saving...</Button>
 */
import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
