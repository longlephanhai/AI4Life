import {
  CheckCircle2,
  Edit3,
  HelpCircle,
  MessageSquareHeart,
  Send,
  Ticket,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { DoctorReply, SemanticFrame } from "@/lib/types"

interface ConfirmationBannerProps {
  frame: SemanticFrame | null
  translation: string
  isSending: boolean
  activeTicket: string | null
  doctorReply: DoctorReply | null
  onConfirm: () => void
  onOpenEdit: () => void
  onRequestHumanHelp: () => void
}

export function ConfirmationBanner({
  frame,
  translation,
  isSending,
  activeTicket,
  doctorReply,
  onConfirm,
  onOpenEdit,
  onRequestHumanHelp,
}: ConfirmationBannerProps) {
  const confirmationPrompt =
    frame?.patient_confirmation_text ??
    (translation
      ? `Ý của bạn là: "${translation}" — Có đúng không?`
      : "Vui lòng kiểm tra thông tin trước khi xác nhận gửi đến Bàn Tiếp Nhận.")

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-3 border-2 border-primary/50 bg-accent/20 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CheckCircle2 className="size-5" aria-hidden />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-base font-semibold">Xác Nhận 2 Chiều (An Toàn Y Khoa)</h3>
            <p className="text-xs text-muted-foreground">{confirmationPrompt}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <Button
            size="lg"
            variant="default"
            loading={isSending}
            disabled={!frame || !translation}
            onClick={onConfirm}
            className="sm:col-span-2"
          >
            <Send />
            ĐÚNG, GỬI BÀN TIẾP NHẬN
          </Button>

          <Button
            size="lg"
            variant="outline"
            disabled={!translation}
            onClick={onOpenEdit}
          >
            <Edit3 />
            Sửa Lại
          </Button>
        </div>

        <div className="flex items-center justify-between border-t pt-2.5">
          <button
            type="button"
            onClick={onRequestHumanHelp}
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <HelpCircle className="size-3.5" aria-hidden />
            Không diễn đạt được? Nhấn để gọi Phiên dịch viên hỗ trợ trực tiếp
          </button>
        </div>
      </Card>

      <AnimatePresence initial={false}>
        {activeTicket && (
          <motion.div
            key={activeTicket}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            aria-live="polite"
            className="flex flex-col gap-3 rounded-xl border border-success/40 bg-success/10 p-6"
          >
            <div className="flex items-center gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-success text-success-foreground shadow-sm">
                <Ticket className="size-7" aria-hidden />
              </div>
              <div className="space-y-0.5">
                <Badge variant="success">Đã ghi nhận vào hàng đợi</Badge>
                <p className="font-display text-2xl font-bold tracking-tight tabular-nums">
                  Số Thứ Tự Khám: {activeTicket}
                </p>
                <p className="text-sm text-muted-foreground">
                  Mời bạn quan sát màn hình hoặc chờ hướng dẫn từ Bàn Tiếp Nhận bên dưới.
                </p>
              </div>
            </div>

            {doctorReply && (
              <div className="mt-2 flex items-start gap-3 rounded-xl border border-primary/30 bg-card p-4 shadow-sm">
                <MessageSquareHeart className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                      Hướng dẫn từ {doctorReply.clinician_name}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      • {doctorReply.replied_at}
                    </span>
                  </div>
                  <p className="font-display text-lg font-semibold text-foreground">
                    “{doctorReply.message}”
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
