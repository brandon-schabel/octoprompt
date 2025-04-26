import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "../lib/utils"

type ProgressVariant = 'default' | 'danger' | 'fullness'

type ProgressProps = React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
  indicatorColor?: string;
  variant?: ProgressVariant;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, indicatorColor, variant = 'default', ...props }, ref) => {
  const percentage = value || 0

  const getColorClass = (percentage: number, variant: ProgressVariant): string => {
    if (indicatorColor) return indicatorColor

    switch (variant) {
      case 'danger':
        if (percentage >= 90) return 'bg-red-500'
        if (percentage >= 70) return 'bg-orange-500'
        return 'bg-primary'
      
      case 'fullness':
        if (percentage >= 90) return 'bg-green-500'
        if (percentage >= 70) return 'bg-green-400'
        if (percentage >= 40) return 'bg-green-300'
        return 'bg-primary'
      
      default:
        return 'bg-primary'
    }
  }

  const colorClass = getColorClass(percentage, variant)

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 transition-all duration-300",
          colorClass
        )}
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </ProgressPrimitive.Root>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
export type { ProgressProps, ProgressVariant }
