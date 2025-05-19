import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  animated = false,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { 
  animated?: boolean 
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "bg-primary h-full w-full flex-1 transition-all",
          animated && "animate-progress-flow relative overflow-hidden"
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      >
        {animated && (
          <div className="absolute inset-0 w-full h-full">
            <div className="h-full w-3/5 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
          </div>
        )}
      </ProgressPrimitive.Indicator>
    </ProgressPrimitive.Root>
  )
}

export { Progress }
