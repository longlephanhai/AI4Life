import * as React from "react"
import { TrendingDown, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

function Root({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-6 shadow-sm",
        className,
      )}
      {...props}
    />
  )
}

function Label({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm font-medium text-muted-foreground", className)} {...props} />
}

function Value({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("font-display text-3xl font-semibold tracking-tight tabular-nums", className)}
      {...props}
    />
  )
}

interface TrendProps extends React.ComponentProps<"p"> {
  direction: "up" | "down"
}

function Trend({ direction, className, children, ...props }: TrendProps) {
  const Icon = direction === "up" ? TrendingUp : TrendingDown
  return (
    <p
      className={cn(
        "inline-flex items-center gap-1 text-sm",
        direction === "up" ? "text-success" : "text-destructive",
        className,
      )}
      {...props}
    >
      <Icon className="size-4" aria-hidden />
      {children}
    </p>
  )
}

export const StatCard = Object.assign(Root, { Label, Value, Trend })

