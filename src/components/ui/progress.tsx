
import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, ...props }, ref) => {
  const [value, setValue] = React.useState(0)

  React.useEffect(() => {
    let startTime = Date.now()

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000 // seconds
      const progress = Math.min(100, (elapsed / 7) * 100)
      setValue(progress)

      if (progress >= 100) {
        clearInterval(interval)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [])

  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={value}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-primary transition-all duration-100"
        style={{ transform: `translateX(-${100 - value}%)` }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs text-white font-medium shadow-sm">
          {Math.max(0, Math.ceil(7 - (value / 100) * 7))}s
        </span>
      </div>
    </ProgressPrimitive.Root>
  )
})

Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
