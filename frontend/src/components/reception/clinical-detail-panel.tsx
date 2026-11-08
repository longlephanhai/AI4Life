import * as React from "react"
import {
  AlertCircle,
  AlertTriangle,
  ArrowRightCircle,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  CreditCard,
  HeartPulse,
  HelpCircle,
  MessageSquarePlus,
  Send,
  Siren,
  ThumbsUp,
  X,
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
          <h3 className="text-base font-semibold">Chưa chọn hồ sơ người thăm khám</h3>
          <p className="text-sm text-muted-foreground">
            Chọn một phiếu từ danh sách hàng đợi bên trái để xem thông tin tiếp nhận bóc tách và gửi hướng dẫn 1 chạm đến Kiosk.
          </p>
        </div>
      </Card>
    )
  }

  const { semantic_frame: frame } = selectedCase
  const isEmergency = frame.intent === "emergency"

  // Gợi ý phản hồi thông minh theo từng tình huống ca bệnh
  const defaultPresets = [
    "Mời bạn xuất trình thẻ BHYT / CCCD",
    "Mời bạn đến Bàn Tiếp Nhận số 1",
    "Vui lòng ngồi chờ nhân viên y tế đo huyết áp",
    "Bạn có mang theo đơn thuốc / sổ khám cũ không?",
  ]

  const contextQuickReplies =
    frame.doctor_quick_responses?.length > 0
      ? Array.from(new Set([...frame.doctor_quick_responses, ...defaultPresets]))
      : defaultPresets

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customReply.trim()) return
    onSendQuickReply(selectedCase.ticket_number, customReply.trim())
    setCustomReply("")
  }

  const activeReply = selectedCase.doctor_reply
  const patientAck = activeReply?.patient_ack

  return (
    <Card className="flex flex-col justify-between gap-6 p-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Hồ Sơ Tiếp Nhận Bóc Tách Tự Động
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
          <div className="flex items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/15 p-4 text-destructive-foreground animate-pulse">
            <Siren className="size-5 shrink-0 text-destructive" aria-hidden />
            <div className="space-y-1">
              <p className="text-sm font-bold uppercase tracking-wide">
                Cảnh Báo Cấp Cứu Đỏ Khẩn Cấp
              </p>
              <p className="text-xs opacity-90">
                Người bệnh có dấu hiệu suy hô hấp / tim mạch cấp tính. Đề nghị nhân viên y tế can thiệp ngay lập tức.
              </p>
            </div>
          </div>
        )}

        <div className="rounded-xl border bg-muted/40 p-4 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Tóm Tắt Chuyên Môn Cho Nhân Viên Tiếp Nhận
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
              {frame.specialty ?? "Bàn Tiếp Nhận Chung"}
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
                Lưu Ý Cần Nhân Viên Khảo Sát Thêm
              </p>
              <p className="text-sm text-foreground">
                {frame.review_reasons.join(" • ")}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-xl border bg-muted/30 p-4 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Hướng Xử Trí Tiếp Đón Đề Xuất
          </p>
          <p className="text-sm">{frame.suggested_action}</p>
        </div>
      </div>

      {/* KHU VỰC PHẢN HỒI NGƯỢC 2 CHIỀU & THEO DÕI TƯƠNG TÁC TỪ KIOSK */}
      <div className="space-y-3.5 border-t pt-4">
        {/* Trạng thái phản hồi hiện tại của phiếu khám này */}
        {activeReply && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-primary uppercase tracking-wide">
                Chỉ dẫn đã gửi tới Kiosk ({activeReply.replied_at}):
              </span>
              {patientAck ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/20 px-2 py-0.5 font-bold text-success text-[11px]">
                  <CheckCircle2 className="size-3" />
                  BỆNH NHÂN ĐÃ PHẢN HỒI
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 font-bold text-amber-600 dark:text-amber-400 text-[11px] animate-pulse">
                  <Clock className="size-3" />
                  ĐANG ĐỢI BỆNH NHÂN XÁC NHẬN...
                </span>
              )}
            </div>

            <p className="text-sm font-medium italic text-foreground">
              “{activeReply.message}”
            </p>

            {/* Khối phản hồi ngược từ người bệnh tại Kiosk */}
            {patientAck && (
              <div className="flex items-center gap-2 rounded-lg bg-background p-2.5 border border-success/40 text-xs">
                {patientAck.action === "understood" && <ThumbsUp className="size-4 text-success" />}
                {patientAck.action === "yes" && <Check className="size-4 text-success" />}
                {patientAck.action === "no" && <X className="size-4 text-destructive" />}
                {patientAck.action === "need_help" && <AlertTriangle className="size-4 text-warning" />}
                <span>
                  Phản hồi từ Kiosk: <strong className="text-foreground">{patientAck.note}</strong>
                  <span className="ml-1 text-muted-foreground tabular-nums">({patientAck.acked_at})</span>
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <MessageSquarePlus className="size-4 text-primary" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Gửi Phản Hồi Trực Quan 1 Chạm Tới Màn Hình Kiosk Người Thăm Khám
          </p>
        </div>

        {/* Nút phản hồi nhanh có phân loại biểu tượng */}
        <div className="flex flex-wrap gap-2">
          {contextQuickReplies.map((reply) => {
            const lower = reply.toLowerCase()
            return (
              <Button
                key={reply}
                variant="secondary"
                size="sm"
                disabled={isReplying}
                onClick={() => onSendQuickReply(selectedCase.ticket_number, reply)}
                className="text-xs gap-1.5"
              >
                {lower.includes("bhyt") || lower.includes("cccd") ? (
                  <CreditCard className="size-3.5 text-amber-500" />
                ) : lower.includes("bàn") || lower.includes("phòng") ? (
                  <ArrowRightCircle className="size-3.5 text-sky-500" />
                ) : lower.includes("huyết áp") || lower.includes("thở") ? (
                  <HeartPulse className="size-3.5 text-rose-500" />
                ) : lower.includes("?") || lower.includes("không") ? (
                  <HelpCircle className="size-3.5 text-violet-500" />
                ) : (
                  <Send className="size-3" />
                )}
                {reply}
              </Button>
            )
          })}
        </div>

        {/* Form gửi chỉ dẫn tùy chỉnh */}
        <form onSubmit={handleCustomSubmit} className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={customReply}
            onChange={(e) => setCustomReply(e.target.value)}
            placeholder="Gõ hướng dẫn trực tiếp cho người thăm khám..."
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
