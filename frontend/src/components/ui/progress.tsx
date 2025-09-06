"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  className?: string
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-gray-200",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full transition-all duration-300 ease-in-out",
            value === undefined 
              ? "w-full bg-gradient-to-r from-blue-400 to-blue-600 animate-pulse"
              : "bg-blue-600"
          )}
          style={
            value !== undefined 
              ? { width: `${Math.max(0, Math.min(100, value))}%` }
              : undefined
          }
        />
      </div>
    )
  }
)
Progress.displayName = "Progress"

export { Progress }