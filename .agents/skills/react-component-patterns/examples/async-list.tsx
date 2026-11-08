import { AlertCircle, Inbox, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AsyncListProps<T> {
  items: T[] | undefined
  isLoading: boolean
  error: unknown
  onRetry: () => void
  renderItem: (item: T) => React.ReactNode
  getKey: (item: T) => string
  emptyTitle?: string
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
  emptyAction,
  className,
}: AsyncListProps<T>) {
  if (isLoading) {
    return (
      <ul className={cn("flex flex-col gap-3", className)} aria-busy>
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
        ))}
      </ul>
    )
  }

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
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
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
        <Inbox className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{emptyTitle}</p>
        {emptyAction}
      </div>
    )
  }

  return (
    <ul className={cn("flex flex-col gap-3", className)} aria-live="polite">
      {items.map((item) => (
        <li key={getKey(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  )
}

