import { ListOrdered, RefreshCw } from "lucide-react"
import { AsyncList } from "@/components/ui/async-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { QueueCase } from "@/lib/types"
import { cn } from "@/lib/utils"

interface QueuePanelProps {
  cases: QueueCase[] | undefined
  isLoading: boolean
  error: unknown
  selectedTicket: string | null
  onSelectTicket: (ticketNumber: string) => void
  onRefresh: () => void
  onSwitchToKiosk: () => void
}

export function QueuePanel({
  cases,
  isLoading,
  error,
  selectedTicket,
  onSelectTicket,
  onRefresh,
  onSwitchToKiosk,
}: QueuePanelProps) {
  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <ListOrdered className="size-5 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold">Hàng Đợi Tiếp Nhận</h2>
          <Badge variant="secondary" className="tabular-nums">
            {cases?.length ?? 0}
          </Badge>
        </div>

        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw />
          Làm mới
        </Button>
      </div>

      <AsyncList
        items={cases}
        isLoading={isLoading}
        error={error}
        onRetry={onRefresh}
        getKey={(c) => c.ticket_number}
        emptyTitle="Hàng đợi tiếp nhận hiện đang trống"
        emptyDescription="Ca khai báo từ Kiosk Người thăm khám sẽ tự động hiển thị tại đây theo thời gian thực."
        emptyAction={
          <Button variant="outline" size="sm" onClick={onSwitchToKiosk}>
            Mở Kiosk Người thăm khám để gửi ca mẫu
          </Button>
        }
        className="max-h-140 overflow-y-auto overscroll-contain pr-1"
        renderItem={(item) => {
          const isEmergency = item.semantic_frame.intent === "emergency"
          const isSelected = item.ticket_number === selectedTicket
          return (
            <button
              type="button"
              onClick={() => onSelectTicket(item.ticket_number)}
              className={cn(
                "flex w-full cursor-pointer flex-col gap-2 rounded-xl border p-4 text-left transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.98]",
                isSelected
                  ? "border-primary bg-accent/50 ring-2 ring-ring"
                  : isEmergency
                    ? "border-destructive/50 bg-destructive/10 hover:bg-destructive/15"
                    : "border-border bg-background hover:bg-muted/60",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant={isEmergency ? "destructive" : "default"}>
                    {item.ticket_number}
                  </Badge>
                  <span className="text-sm font-semibold">{item.patient_name}</span>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {item.created_at}
                </span>
              </div>

              <p className="line-clamp-2 text-sm font-medium text-foreground">
                “{item.confirmed_text}”
              </p>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">
                  {item.semantic_frame.specialty ?? "Quầy Tiếp Đón"}
                </Badge>
                {isEmergency && <Badge variant="destructive">Cấp cứu đỏ</Badge>}
                {!isEmergency && item.semantic_frame.needs_human_review && (
                  <Badge variant="warning">Cần khảo sát thêm</Badge>
                )}
                {item.doctor_reply && <Badge variant="success">Đã hướng dẫn</Badge>}
              </div>
            </button>
          )
        }}
      />
    </Card>
  )
}

