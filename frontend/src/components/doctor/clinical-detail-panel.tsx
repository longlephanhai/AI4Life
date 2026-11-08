import * as React from "react"
import {
  AlertCircle,
  Check,
  ClipboardList,
  MessageSquarePlus,
  Send,
  Siren,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { QueueCase } from "@/lib/types"

interface ClinicalDetailPanelProps {
  selectedCase: QueueCase | null
  isReplying: boolean
  isServing: boolean
  onSendQuickReply: (ticketNumber: string, message: string) => void
  onServeCase: (ticketNumber: string) => void
}

export function ClinicalDetailPanel({
  selectedCase,
  isReplying,
  isServing,
  onSendQuickReply,
  onServeCase,
}: ClinicalDetailPanelProps) {
  const [customReply, setCustomReply] = React.useState("")

  if (!selectedCase) {
    return (
      <Card className="flex min-h-112 flex-col items-center justify-center gap-3 p-10 text-center">
        <ClipboardList className="size-8 text-muted-foreground" aria-hidden />
        <div className="max-w-sm space-y-1">
          <h3 className="text-base font-semibold">Chưa chọn hồ sơ bệnh nhân</h3>
          <p className="text-sm text-muted-foreground">
            Chọn một phiếu khám ở danh sách bên trái để xem thông tin lâm sàng bóc tách và gửi phản hồi 1 chạm.
          </p>
        </div>
      </Card>
    )
  }

  const { semantic_frame: frame } = selectedCase
  const isEmergency = frame.intent === "emergency"
  const quickReplies =
    frame.doctor_quick_responses?.length > 0
      ? frame.doctor_quick_responses
      : [
          "Mời bạn vào phòng khám 102",
          "Mời bạn xuất trình thẻ BHYT / CCCD",
          "Bạn vui lòng ngồi chờ điều dưỡng đo sinh hiệu",
        ]

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customReply.trim()) return
    onSendQuickReply(selectedCase.ticket_number, customReply.trim())
    setCustomReply("")
  }

  return (
    <Card className="flex flex-col justify-between gap-6 p-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Hồ Sơ Lâm Sàng Bóc Tách Tự Động
            </p>
            <h2 className="font-display text-xl font-semibold">
              {selectedCase.patient_name} — Phiếu #{selectedCase.ticket_number}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={isEmergency ? "destructive" : "accent"}>
              {selectedCase.ticket_number}
            </Badge>
            <Button
              variant="success"
              size="sm"
              loading={isServing}
              onClick={() => onServeCase(selectedCase.ticket_number)}
            >
              <Check />
              Hoàn thành tiếp nhận
            </Button>
          </div>
        </div>

        {isEmergency && (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-xl bg-destructive p-4 text-destructive-foreground shadow-sm"
          >
            <Siren className="size-7 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-bold uppercase tracking-wide">
                Cảnh Báo Cấp Cứu Đỏ Khẩn Cấp
              </p>
              <p className="text-xs opacity-90">
                Người bệnh có dấu hiệu suy hô hấp / tim mạch cấp tính. Đề nghị ưu tiên tiếp nhận ngay lập tức.
              </p>
            </div>
          </div>
        )}

        <div className="rounded-xl border bg-muted/40 p-4 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Tóm Tắt Chuyên Môn Cho Nhân Viên Y Tế
          </p>
          <p className="text-base font-semibold leading-relaxed">
            {frame.summary_for_clinician}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-background p-3.5 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Chuyên Khoa Đề Xuất
            </p>
            <p className="text-sm font-semibold text-primary">
              {frame.specialty ?? "Khám Đa Khoa"}
            </p>
          </div>

          <div className="rounded-xl border bg-background p-3.5 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Triệu Chứng Ghi Nhận
            </p>
            <p className="text-sm font-semibold">
              {frame.symptoms?.length > 0
                ? frame.symptoms.join(", ")
                : "Không có triệu chứng cấp"}
            </p>
          </div>

          <div className="rounded-xl border bg-background p-3.5 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Khởi Phát & Mức Độ
            </p>
            <p className="text-sm font-semibold">
              {[frame.body_location, frame.onset, frame.severity]
                .filter(Boolean)
                .join(" • ") || "Chưa ghi nhận"}
            </p>
          </div>
        </div>

        {frame.needs_human_review && frame.review_reasons?.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/15 p-3.5">
            <AlertCircle
              className="mt-0.5 size-4 shrink-0 text-warning-foreground"
              aria-hidden
            />
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-warning-foreground">
                Lưu Ý Cần Khảo Sát Thêm
              </p>
              <p className="text-sm text-foreground">
                {frame.review_reasons.join(" • ")}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-xl border bg-muted/30 p-4 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Hướng Xử Trí Đề Xuất
          </p>
          <p className="text-sm">{frame.suggested_action}</p>
        </div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center gap-2">
          <MessageSquarePlus className="size-4 text-primary" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Phản Hồi Trực Quan 1 Chạm Tới Màn Hình Kiosk Bệnh Nhân
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {quickReplies.map((reply) => (
            <Button
              key={reply}
              variant="secondary"
              size="sm"
              disabled={isReplying}
              onClick={() => onSendQuickReply(selectedCase.ticket_number, reply)}
            >
              <Send />
              {reply}
            </Button>
          ))}
        </div>

        <form onSubmit={handleCustomSubmit} className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={customReply}
            onChange={(e) => setCustomReply(e.target.value)}
            placeholder="Nhập tin nhắn hướng dẫn trực tiếp cho người bệnh..."
            className="h-10 flex-1 rounded-md border bg-background px-3 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
          />
          <Button
            type="submit"
            size="sm"
            loading={isReplying}
            disabled={!customReply.trim()}
          >
            <Send />
            Gửi Kiosk
          </Button>
        </form>
      </div>
    </Card>
  )
}

