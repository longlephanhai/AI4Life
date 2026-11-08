import * as React from "react"
import { AlertCircle, Inbox, RotateCw } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AsyncListProps<T> {
  items: T[] | undefined
  isLoading: boolean
  error: unknown
  onRetry: () => void
  renderItem: (item: T, index: number) => React.ReactNode
  getKey: (item: T) => string
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
  className?: string
}

export function AsyncList<T>({
  items,
  isLoading,
  error,
  onRetry,
  renderItem,
  getKey,
  emptyTitle = "Chưa có dữ liệu",
  emptyDescription,
  emptyAction,
  className,
}: AsyncListProps<T>) {
  if (isLoading) {
    return (
      <ul className={cn("flex flex-col gap-3", className)} aria-busy>
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </ul>
    )
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center"
      >
        <AlertCircle className="size-6 text-destructive" aria-hidden />
        <p className="text-sm">Không tải được dữ liệu. Vui lòng thử lại.</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> Thử lại
        </Button>
      </div>
    )
  }

  if (!items?.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center">
        <Inbox className="size-6 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
          {emptyDescription && (
            <p className="text-sm text-muted-foreground">{emptyDescription}</p>
          )}
        </div>
        {emptyAction}
      </div>
    )
  }

  return (
    <ul className={cn("flex flex-col gap-3", className)} aria-live="polite">
      <AnimatePresence initial={false}>
        {items.map((item, idx) => (
          <motion.li
            key={getKey(item)}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {renderItem(item, idx)}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}

