import * as SwitchPrimitives from "@radix-ui/react-switch";
import * as React from "react";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-teal-300/45 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-teal-500 data-[state=checked]:to-emerald-500 data-[state=checked]:shadow-[0_10px_24px_rgba(20,184,166,0.28)] data-[state=unchecked]:border-border/70 data-[state=unchecked]:bg-card/90",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-[0_5px_12px_rgba(15,23,42,0.45)] ring-0 transition-transform data-[state=checked]:translate-x-[20px] data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
