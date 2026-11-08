import {
  AlertTriangle,
  ArrowRightCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit3,
  HeartPulse,
  HelpCircle,
  MessageSquareHeart,
  Send,
  ThumbsUp,
  X,
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
  onAcknowledge?: (action: "understood" | "yes" | "no" | "need_help", note?: string) => void
  isAcking?: boolean
}

type QuestionCategory = "time" | "severity" | "yes_no" | "instruction"

export function ConfirmationBanner({
  frame,
  translation,
  isSending,
  activeTicket,
  doctorReply,
  onConfirm,
  onOpenEdit,
  onRequestHumanHelp,
  onAcknowledge,
  isAcking = false,
}: ConfirmationBannerProps) {
  const confirmationPrompt =
    frame?.patient_confirmation_text ??
    (translation
      ? `Ý của bạn là: "${translation}" — Có đúng không?`
      : "Vui lòng kiểm tra thông tin trước khi xác nhận gửi đến Bàn Tiếp Nhận.")

  // Xác định Icon, chủ đề và loại câu hỏi thông minh dựa trên nội dung bác sĩ gửi
  const getVisualReplyMeta = (reply: DoctorReply) => {
    const cat = reply.category || ""
    const msg = reply.message.toLowerCase()

    // 1. Câu hỏi về thời gian / khởi phát: "khi nào", "bao lâu", "mấy ngày", "từ lúc nào", "thời gian"
    const isTime =
      msg.includes("khi nào") ||
      msg.includes("bao lâu") ||
      msg.includes("từ lúc nào") ||
      msg.includes("mấy ngày") ||
      msg.includes("thời gian") ||
      msg.includes("từ khi")

    // 2. Câu hỏi về mức độ đau: "nhiều hay ít", "mức độ", "đau nhiều không", "nặng hay nhẹ"
    const isSeverity =
      msg.includes("nhiều hay") ||
      msg.includes("mức độ") ||
      msg.includes("đau nhiều") ||
      msg.includes("nặng hay")

    // 3. Câu hỏi Có/Không thông thường
    const isYesNo =
      !isTime &&
      !isSeverity &&
      (msg.includes("?") ||
        msg.includes("không") ||
        msg.includes("chưa") ||
        cat === "question_yes_no")

    let questionType: QuestionCategory = "instruction"
    if (isTime) questionType = "time"
    else if (isSeverity) questionType = "severity"
    else if (isYesNo) questionType = "yes_no"

    if (cat === "insurance" || msg.includes("bhyt") || msg.includes("cccd") || msg.includes("thẻ")) {
      return {
        icon: CreditCard,
        tag: "XUẤT TRÌNH GIẤY TỜ / BHYT",
        color: "text-amber-600 dark:text-amber-400",
        border: "border-amber-500/40 bg-amber-500/10",
        badgeVariant: "warning" as const,
        questionType,
      }
    }
    if (cat === "vital_signs" || msg.includes("huyết áp") || msg.includes("thở") || msg.includes("nhiệt độ")) {
      return {
        icon: HeartPulse,
        tag: "ĐO SINH HIỆU / HUYẾT ÁP",
        color: "text-rose-600 dark:text-rose-400",
        border: "border-rose-500/40 bg-rose-500/10",
        badgeVariant: "destructive" as const,
        questionType,
      }
    }
    if (cat === "direction" || msg.includes("bàn") || msg.includes("phòng") || msg.includes("đến")) {
      return {
        icon: ArrowRightCircle,
        tag: "HƯỚNG DẪN DI CHUYỂN",
        color: "text-sky-600 dark:text-sky-400",
        border: "border-sky-500/40 bg-sky-500/10",
        badgeVariant: "accent" as const,
        questionType,
      }
    }
    if (cat === "emergency" || msg.includes("cấp cứu") || msg.includes("hỗ trợ ngay")) {
      return {
        icon: AlertTriangle,
        tag: "Y TÁ ĐANG ĐẾN HỖ TRỢ",
        color: "text-red-600 dark:text-red-400",
        border: "border-red-500/50 bg-red-500/15 animate-pulse",
        badgeVariant: "destructive" as const,
        questionType,
      }
    }
    if (questionType === "time") {
      return {
        icon: Calendar,
        tag: "CÂU HỎI THỜI GIAN KHỞI PHÁT",
        color: "text-indigo-600 dark:text-indigo-400",
        border: "border-indigo-500/40 bg-indigo-500/10",
        badgeVariant: "default" as const,
        questionType,
      }
    }
    if (questionType === "severity") {
      return {
        icon: HeartPulse,
        tag: "CÂU HỎI MỨC ĐỘ ĐAU",
        color: "text-orange-600 dark:text-orange-400",
        border: "border-orange-500/40 bg-orange-500/10",
        badgeVariant: "warning" as const,
        questionType,
      }
    }
    if (questionType === "yes_no") {
      return {
        icon: HelpCircle,
        tag: "CÂU HỎI XÁC MINH (CÓ / KHÔNG)",
        color: "text-violet-600 dark:text-violet-400",
        border: "border-violet-500/40 bg-violet-500/10",
        badgeVariant: "default" as const,
        questionType,
      }
    }
    return {
      icon: MessageSquareHeart,
      tag: "HƯỚNG DẪN TỪ BÀN TIẾP NHẬN",
      color: "text-primary",
      border: "border-primary/40 bg-primary/10",
      badgeVariant: "default" as const,
      questionType,
    }
  }

  const replyMeta = doctorReply ? getVisualReplyMeta(doctorReply) : null
  const hasAcked = Boolean(doctorReply?.patient_ack)

  return (
    <div className="flex flex-col gap-3">
      {/* 
        CHỈ HIỂN THỊ KHỐI XÁC NHẬN GỬI ĐI KHI CHƯA CÓ VÉ (activeTicket === null).
        Khi đã có vé, chỉ tập trung hiển thị Số phiếu và Khối hội thoại với bác sĩ!
      */}
      {!activeTicket && (
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
              className="sm:col-span-2 font-bold text-sm"
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
      )}

      {/* MÀN HÌNH ĐỐI THOẠI SAU KHI ĐÃ CẤP SỐ THỨ TỰ */}
      <AnimatePresence initial={false}>
        {activeTicket && (
          <motion.div
            key={activeTicket}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            aria-live="polite"
            className="flex flex-col gap-4"
          >
            {/* Chiều ngược: Phản hồi từ Bàn Tiếp Nhận tới Kiosk người thăm khám */}
            {doctorReply && replyMeta ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className={`relative flex flex-col gap-3 rounded-2xl border-2 p-5 shadow-md ${replyMeta.border} ${
                  !hasAcked ? "ring-4 ring-primary/20" : ""
                }`}
              >
                {/* Visual cue: Đồ họa trực quan & tiêu đề lớn */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-card shadow-sm border">
                      <replyMeta.icon className={`size-6 ${replyMeta.color}`} aria-hidden />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={replyMeta.badgeVariant}>{replyMeta.tag}</Badge>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {doctorReply.replied_at}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                        Từ: {doctorReply.clinician_name}
                      </p>
                    </div>
                  </div>

                  {!hasAcked && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-2.5 py-1 text-[11px] font-bold text-primary animate-pulse">
                      <span className="size-2 rounded-full bg-primary" />
                      CẦN BẠN XÁC NHẬN
                    </span>
                  )}
                </div>

                {/* Nội dung thông điệp chữ lớn, dễ đọc */}
                <div className="rounded-xl bg-card/90 p-4 border shadow-inner">
                  <p className="font-display text-xl font-bold text-foreground leading-snug">
                    “{doctorReply.message}”
                  </p>
                </div>

                {/* Phản hồi thông minh theo đúng loại câu hỏi từ bác sĩ */}
                {hasAcked ? (
                  <div className="flex items-center justify-between rounded-xl border border-success/40 bg-success/15 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Check className="size-4 text-success" />
                      <span className="text-xs font-semibold text-success-foreground">
                        Bạn đã gửi phản hồi: <strong className="underline">{doctorReply.patient_ack?.note}</strong>
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {doctorReply.patient_ack?.acked_at}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Bấm nút bên dưới để trả lời ngay cho nhân viên y tế:
                    </p>

                    {/* TRƯỜNG HỢP 1: CÂU HỎI THỜI GIAN ("Khi nào?", "Bao lâu?") */}
                    {replyMeta.questionType === "time" && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <Button
                            size="lg"
                            variant="secondary"
                            loading={isAcking}
                            onClick={() => onAcknowledge?.("understood", "Vừa mới xuất hiện hôm nay")}
                            className="text-xs font-bold gap-1.5 border"
                          >
                            <Clock className="size-3.5" />
                            Vừa mới hôm nay
                          </Button>
                          <Button
                            size="lg"
                            variant="secondary"
                            loading={isAcking}
                            onClick={() => onAcknowledge?.("understood", "Bắt đầu từ hôm qua")}
                            className="text-xs font-bold gap-1.5 border"
                          >
                            <Calendar className="size-3.5" />
                            Từ hôm qua
                          </Button>
                          <Button
                            size="lg"
                            variant="secondary"
                            loading={isAcking}
                            onClick={() => onAcknowledge?.("understood", "Đã bị 2–3 ngày nay")}
                            className="text-xs font-bold gap-1.5 border"
                          >
                            <Calendar className="size-3.5" />
                            2–3 ngày nay
                          </Button>
                          <Button
                            size="lg"
                            variant="secondary"
                            loading={isAcking}
                            onClick={() => onAcknowledge?.("understood", "Kéo dài hơn 1 tuần nay")}
                            className="text-xs font-bold gap-1.5 border"
                          >
                            <Calendar className="size-3.5" />
                            Hơn 1 tuần
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={isAcking}
                          onClick={() => onAcknowledge?.("need_help", "Cần phiên dịch viên hỗ trợ")}
                          className="w-full text-xs text-muted-foreground"
                        >
                          <HelpCircle className="size-3.5 mr-1" />
                          Không chắc chắn? Bấm để gọi người giải thích
                        </Button>
                      </div>
                    )}

                    {/* TRƯỜNG HỢP 2: CÂU HỎI MỨC ĐỘ ĐAU ("Nhiều hay ít?", "Mức độ nào?") */}
                    {replyMeta.questionType === "severity" && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <Button
                            size="lg"
                            variant="secondary"
                            loading={isAcking}
                            onClick={() => onAcknowledge?.("understood", "Đau mức độ nhẹ (1–3)")}
                            className="text-xs font-bold border"
                          >
                            Đau nhẹ (1–3)
                          </Button>
                          <Button
                            size="lg"
                            variant="secondary"
                            loading={isAcking}
                            onClick={() => onAcknowledge?.("understood", "Đau mức độ vừa (4–6)")}
                            className="text-xs font-bold border border-amber-400 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          >
                            Đau vừa (4–6)
                          </Button>
                          <Button
                            size="lg"
                            variant="destructive"
                            loading={isAcking}
                            onClick={() => onAcknowledge?.("understood", "Đau dữ dội / Rất nặng (7–10)")}
                            className="text-xs font-bold shadow-sm"
                          >
                            Rất dữ dội (7–10)
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={isAcking}
                          onClick={() => onAcknowledge?.("need_help", "Cần hỗ trợ đánh giá mức độ")}
                          className="w-full text-xs text-muted-foreground"
                        >
                          <HelpCircle className="size-3.5 mr-1" />
                          Cần nhân viên hỗ trợ trực tiếp
                        </Button>
                      </div>
                    )}

                    {/* TRƯỜNG HỢP 3: CÂU HỎI CÓ / KHÔNG ("Có dị ứng không?", "Có mang BHYT không?") */}
                    {replyMeta.questionType === "yes_no" && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <Button
                          size="lg"
                          variant="success"
                          loading={isAcking}
                          onClick={() => onAcknowledge?.("yes", "CÓ / ĐÚNG VẬY")}
                          className="font-bold text-sm"
                        >
                          <Check className="size-4" />
                          CÓ / ĐÚNG VẬY
                        </Button>
                        <Button
                          size="lg"
                          variant="destructive"
                          loading={isAcking}
                          onClick={() => onAcknowledge?.("no", "KHÔNG PHẢI")}
                          className="font-bold text-sm"
                        >
                          <X className="size-4" />
                          KHÔNG PHẢI
                        </Button>
                        <Button
                          size="lg"
                          variant="secondary"
                          loading={isAcking}
                          onClick={() => onAcknowledge?.("need_help", "Cần phiên dịch viên giải thích")}
                          className="col-span-2 sm:col-span-1 text-xs"
                        >
                          <HelpCircle className="size-4" />
                          Cần người hỗ trợ
                        </Button>
                      </div>
                    )}

                    {/* TRƯỜNG HỢP 4: CHỈ DẪN / ĐIỀU PHỐI ("Mời bạn qua Bàn số 1") */}
                    {replyMeta.questionType === "instruction" && (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <Button
                          size="lg"
                          variant="success"
                          loading={isAcking}
                          onClick={() => onAcknowledge?.("understood", "Đã hiểu 👍 & Đang đến")}
                          className="sm:col-span-2 font-bold text-base shadow-sm"
                        >
                          <ThumbsUp className="size-5" />
                          TÔI ĐÃ HIỂU 👍
                        </Button>
                        <Button
                          size="lg"
                          variant="outline"
                          loading={isAcking}
                          onClick={() => onAcknowledge?.("need_help", "Chưa rõ — Cần hướng dẫn trực tiếp")}
                          className="text-xs"
                        >
                          <HelpCircle className="size-4" />
                          Chưa rõ, cần giúp
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-card/60 p-5 text-center text-muted-foreground shadow-sm">
                <span className="size-2.5 rounded-full bg-primary animate-ping" />
                <p className="text-sm font-medium">
                  Đang kết nối với Bàn Tiếp Nhận. Vui lòng chờ nhân viên y tế phản hồi hoặc gọi số...
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
