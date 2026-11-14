import * as React from "react"
import {
  AlertCircle,
  ArrowRightCircle,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  CreditCard,
  Eye,
  Hand,
  HeartPulse,
  HelpCircle,
  MessageSquarePlus,
  Plus,
  Send,
  Siren,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { VslSkeletonPlayer } from "@/components/kiosk/vsl-skeleton-player"
import {
  usePreviewVsl,
  useSynthesizeVsl,
  useVslGlosses,
} from "@/hooks/use-signbridge"
import type { QueueCase, VslSynthesizeResponse } from "@/lib/types"

interface ClinicalDetailPanelProps {
  selectedCase: QueueCase | null
  isReplying: boolean
  isServing: boolean
  onSendQuickReply: (
    ticketNumber: string,
    message: string,
    options?: { overrideGlosses?: string[]; sendVsl?: boolean },
  ) => void
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
  const [draftGlosses, setDraftGlosses] = React.useState<string[]>([])
  const [missingTerms, setMissingTerms] = React.useState<string[]>([])
  const [previewMode, setPreviewMode] = React.useState<
    "full_sentence" | "stitched" | "text_only"
  >("text_only")
  const [isGlossEdited, setIsGlossEdited] = React.useState(false)
  const [glossToAdd, setGlossToAdd] = React.useState("")
  const [previewAnimation, setPreviewAnimation] =
    React.useState<VslSynthesizeResponse | null>(null)

  const glossListQuery = useVslGlosses()
  const previewVslMutation = usePreviewVsl()
  const synthesizePreviewMutation = useSynthesizeVsl()

  // Tự động xem trước chuỗi Gloss VSL khi nhân viên gõ hoặc chọn mẫu câu
  React.useEffect(() => {
    const trimmed = customReply.trim()
    setPreviewAnimation(null)
    if (!trimmed) {
      setDraftGlosses([])
      setMissingTerms([])
      setPreviewMode("text_only")
      setIsGlossEdited(false)
      return
    }

    const timer = window.setTimeout(() => {
      previewVslMutation.mutate(trimmed, {
        onSuccess: (res) => {
          setDraftGlosses(res.vsl_glosses)
          setMissingTerms(res.missing_terms)
          setPreviewMode(res.mode)
          setIsGlossEdited(false)
        },
      })
    }, 250)

    return () => window.clearTimeout(timer)
  }, [customReply])

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

  const handleConfirmSend = (sendVsl: boolean) => {
    const trimmed = customReply.trim()
    if (!trimmed) return
    onSendQuickReply(selectedCase.ticket_number, trimmed, {
      sendVsl,
      overrideGlosses:
        sendVsl && isGlossEdited ? draftGlosses : undefined,
    })
    setCustomReply("")
    setPreviewAnimation(null)
  }

  const handleRemoveGloss = (idx: number) => {
    setDraftGlosses((prev) => prev.filter((_, i) => i !== idx))
    setIsGlossEdited(true)
    setPreviewAnimation(null)
  }

  const handleAddGloss = () => {
    const g = glossToAdd.trim().toUpperCase()
    if (!g) return
    setDraftGlosses((prev) => [...prev, g])
    setGlossToAdd("")
    setIsGlossEdited(true)
    setPreviewAnimation(null)
  }

  const handlePreviewSkeleton = () => {
    const trimmed = customReply.trim()
    if (!trimmed) return
    synthesizePreviewMutation.mutate(
      {
        text: trimmed,
        overrideGlosses: isGlossEdited ? draftGlosses : undefined,
      },
      {
        onSuccess: (res) => {
          setPreviewAnimation(res)
        },
      },
    )
  }

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleConfirmSend(true)
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

      {/* KHU VỰC PHẢN HỒI NGƯỢC 2 CHIỀU & LỊCH SỬ HỘI THOẠI NHIỀU LƯỢT */}
      <div className="space-y-3.5 border-t pt-4">
        {selectedCase.messages && selectedCase.messages.length > 0 && (
          <div className="rounded-xl border bg-muted/20 p-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                Lịch sử đối thoại 2 chiều ({selectedCase.messages.length} lượt)
              </span>
              {activeReply && (
                patientAck ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/20 px-2 py-0.5 font-bold text-success text-[11px]">
                    <CheckCircle2 className="size-3" />
                    BỆNH NHÂN ĐÃ PHẢN HỒI
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 font-bold text-amber-600 dark:text-amber-400 text-[11px] animate-pulse">
                    <Clock className="size-3" />
                    ĐANG ĐỢI BỆNH NHÂN PHẢN HỒI...
                  </span>
                )
              )}
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {selectedCase.messages.map((m) => {
                const isClinician = m.sender === "clinician"
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col gap-0.5 rounded-lg px-3 py-2 text-xs ${
                      isClinician
                        ? "ml-6 border border-primary/30 bg-primary/10 text-foreground"
                        : "mr-6 border bg-background text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="font-semibold">
                        {isClinician ? (m.sender_name || "Nhân viên y tế") : "Bệnh nhân"}
                        {!isClinician && m.source && (
                          <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                            {m.source === "vsl"
                              ? "Ký hiệu VSL"
                              : m.source === "body_map"
                                ? "Sơ đồ cơ thể"
                                : m.source === "ack"
                                  ? "1 chạm"
                                  : m.source}
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums">{m.timestamp}</span>
                    </div>
                    <p className="text-sm font-medium">{m.text}</p>
                    {isClinician && m.vsl_glosses && m.vsl_glosses.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                        <span className="text-primary font-semibold">VSL đang phát:</span>
                        {m.vsl_glosses.map((g, idx) => (
                          <span
                            key={`${g}-${idx}`}
                            className="rounded bg-primary/15 px-1.5 py-0.5 font-semibold text-primary"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <MessageSquarePlus className="size-4 text-primary" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Gửi Phản Hồi Trực Quan 1 Chạm Tới Màn Hình Kiosk Người Thăm Khám
          </p>
        </div>

        {/* Nút phản hồi nhanh: nạp vào khung xác nhận VSL trước khi gửi */}
        <div className="flex flex-wrap gap-2">
          {contextQuickReplies.map((reply) => {
            const lower = reply.toLowerCase()
            const isSelected = customReply.trim() === reply.trim()
            return (
              <Button
                key={reply}
                type="button"
                variant={isSelected ? "default" : "secondary"}
                size="sm"
                disabled={isReplying}
                onClick={() => setCustomReply(reply)}
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

        {/* Ô nhập hướng dẫn & Khung xác nhận chuỗi VSL trước khi gửi */}
        <form onSubmit={handleCustomSubmit} className="space-y-3 pt-1">
          <input
            type="text"
            value={customReply}
            onChange={(e) => setCustomReply(e.target.value)}
            placeholder="Chọn mẫu trên hoặc gõ câu hỏi / hướng dẫn cho người thăm khám..."
            className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
          />

          {customReply.trim() && (
            <div className="rounded-xl border-2 border-primary/35 bg-primary/5 p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
                  <Hand className="size-4" />
                  <span>Xác nhận chuỗi ký hiệu VSL trước khi gửi</span>
                  {previewMode === "full_sentence" && !isGlossEdited && (
                    <Badge variant="success" className="text-[10px]">
                      Khớp nguyên câu VSL-GH
                    </Badge>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    synthesizePreviewMutation.isPending ||
                    draftGlosses.length === 0
                  }
                  onClick={handlePreviewSkeleton}
                  className="h-7 gap-1.5 text-xs"
                >
                  <Eye className="size-3.5" />
                  {previewAnimation ? "Cập nhật xem thử" : "Xem thử khung xương VSL"}
                </Button>
              </div>

              {/* Chuỗi Gloss có thể chỉnh sửa (xóa / thêm) */}
              <div className="flex flex-wrap items-center gap-1.5">
                {draftGlosses.length > 0 ? (
                  draftGlosses.map((g, idx) => (
                    <span
                      key={`${g}-${idx}`}
                      className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-background px-2 py-1 text-xs font-bold text-foreground"
                    >
                      {g}
                      <button
                        type="button"
                        aria-label={`Bỏ ${g}`}
                        onClick={() => handleRemoveGloss(idx)}
                        className="rounded p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-xs italic text-muted-foreground">
                    {previewVslMutation.isPending
                      ? "Đang phân tích chuỗi ký hiệu VSL..."
                      : "Chưa tìm thấy ký hiệu tương ứng — bạn có thể thêm Gloss thủ công hoặc gửi dạng chữ lớn."}
                  </span>
                )}
              </div>

              {/* Thêm Gloss từ danh sách 368 gloss thật */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  list="vsl-available-glosses"
                  value={glossToAdd}
                  onChange={(e) => setGlossToAdd(e.target.value)}
                  placeholder="Thêm Gloss (VD: ĐAU, NHIỀU, ÂM-Ỉ, CÓ-KHÔNG)..."
                  className="h-8 flex-1 min-w-48 rounded-md border bg-background px-2.5 text-xs focus:ring-2 focus:ring-ring focus:outline-none"
                />
                <datalist id="vsl-available-glosses">
                  {(glossListQuery.data?.glosses ?? []).map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!glossToAdd.trim()}
                  onClick={handleAddGloss}
                  className="h-8 gap-1 text-xs"
                >
                  <Plus className="size-3.5" />
                  Thêm Gloss
                </Button>
              </div>

              {missingTerms.length > 0 && !isGlossEdited && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Các từ ngoài 368 ký hiệu sẽ hiện chữ nổi bật song song:{" "}
                  <strong>{missingTerms.join(" • ")}</strong>
                </p>
              )}

              {previewAnimation && (
                <VslSkeletonPlayer
                  data={previewAnimation}
                  isLoading={synthesizePreviewMutation.isPending}
                />
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-2.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isReplying}
                  onClick={() => handleConfirmSend(false)}
                  className="text-xs"
                >
                  Chỉ gửi chữ lớn (không phát VSL)
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="success"
                  loading={isReplying}
                  disabled={!customReply.trim() || draftGlosses.length === 0}
                  className="gap-1.5 font-semibold"
                >
                  <CheckCircle2 className="size-4" />
                  Xác nhận &amp; Phát VSL tới Kiosk
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>
    </Card>
  )
}
