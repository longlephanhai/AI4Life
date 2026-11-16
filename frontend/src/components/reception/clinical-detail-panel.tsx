import * as React from "react"
import {
  AlertTriangle,
  ArrowRightCircle,
  BellRing,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  CreditCard,
  DoorOpen,
  Eye,
  Hand,
  HeartPulse,
  HelpCircle,
  MessageSquarePlus,
  Plus,
  QrCode,
  Send,
  Siren,
  Vibrate,
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

const DEFAULT_ROOM_OPTIONS = [
  "Phòng Tiếp Nhận 1",
  "Phòng Khám Nội 1 - Tầng 1",
  "Phòng Khám Nội 2 - Tầng 1",
  "Phòng Tai Mũi Họng - Tầng 2",
  "Phòng Răng Hàm Mặt - Tầng 2",
  "Phòng Mắt - Tầng 2",
  "Phòng Cấp Cứu",
  "Quầy Thu Ngân / BHYT",
]

interface ClinicalDetailPanelProps {
  selectedCase: QueueCase | null
  isReplying: boolean
  isTogglingQrPass: boolean
  isCalling: boolean
  isServing: boolean
  onSendQuickReply: (
    ticketNumber: string,
    message: string,
    options?: { overrideGlosses?: string[]; sendVsl?: boolean },
  ) => void
  onToggleQrPass: (ticketNumber: string, enabled: boolean) => void
  onCallPatient: (
    ticketNumber: string,
    roomName: string,
    mode?: "pre_alert" | "calling",
  ) => void
  onServeCase: (ticketNumber: string) => void
}

export function ClinicalDetailPanel({
  selectedCase,
  isReplying,
  isTogglingQrPass,
  isCalling,
  isServing,
  onSendQuickReply,
  onToggleQrPass,
  onCallPatient,
  onServeCase,
}: ClinicalDetailPanelProps) {
  const [customReply, setCustomReply] = React.useState("")
  const [draftGlosses, setDraftGlosses] = React.useState<string[]>([])
  const [missingTerms, setMissingTerms] = React.useState<string[]>([])
  const [previewMode, setPreviewMode] = React.useState<
    "full_sentence" | "stitched" | "text_only"
  >("text_only")
  const [translationSource, setTranslationSource] = React.useState<string>("")
  const [isGlossEdited, setIsGlossEdited] = React.useState(false)
  const [glossToAdd, setGlossToAdd] = React.useState("")
  const [previewAnimation, setPreviewAnimation] =
    React.useState<VslSynthesizeResponse | null>(null)
  const [selectedRoom, setSelectedRoom] = React.useState("Phòng Tiếp Nhận 1")
  const [elapsedSinceCallSec, setElapsedSinceCallSec] = React.useState(0)

  const glossListQuery = useVslGlosses()
  const previewVslMutation = usePreviewVsl()
  const synthesizePreviewMutation = useSynthesizeVsl()
  const latestReplyRef = React.useRef("")
  const previewSeqRef = React.useRef(0)

  // Gợi ý tên phòng mặc định theo chuyên khoa hoặc phòng đã gọi gần nhất của ca đang chọn
  React.useEffect(() => {
    if (!selectedCase) return
    if (selectedCase.assigned_room) {
      setSelectedRoom(selectedCase.assigned_room)
      return
    }
    const spec = selectedCase.semantic_frame.specialty
    if (selectedCase.semantic_frame.intent === "emergency") {
      setSelectedRoom("Phòng Cấp Cứu")
    } else if (spec && spec !== "Tiếp nhận chung") {
      setSelectedRoom(`Phòng Khám ${spec}`)
    } else {
      setSelectedRoom("Phòng Tiếp Nhận 1")
    }
  }, [selectedCase?.ticket_number, selectedCase?.assigned_room, selectedCase?.semantic_frame.intent, selectedCase?.semantic_frame.specialty])

  // Đếm giây chờ phản hồi khi đang gọi bệnh nhân vào phòng
  React.useEffect(() => {
    if (selectedCase?.call_status !== "calling" || !selectedCase.called_at_ts) {
      setElapsedSinceCallSec(0)
      return
    }
    const updateElapsed = () => {
      const diff = Math.max(
        0,
        Math.floor(Date.now() / 1000 - (selectedCase.called_at_ts ?? Date.now() / 1000)),
      )
      setElapsedSinceCallSec(diff)
    }
    updateElapsed()
    const timer = window.setInterval(updateElapsed, 1000)
    return () => window.clearInterval(timer)
  }, [selectedCase?.call_status, selectedCase?.called_at_ts])

  // Tự động xem trước chuỗi Gloss VSL khi nhân viên gõ hoặc chọn mẫu câu
  React.useEffect(() => {
    const trimmed = customReply.trim()
    latestReplyRef.current = trimmed
    const seq = ++previewSeqRef.current
    setPreviewAnimation(null)
    setDraftGlosses([])
    setMissingTerms([])
    setTranslationSource("")
    setIsGlossEdited(false)

    if (!trimmed) {
      setPreviewMode("text_only")
      return
    }

    const timer = window.setTimeout(() => {
      previewVslMutation.mutate(trimmed, {
        onSuccess: (res) => {
          // Chặn response của request cũ (lúc đang gõ dở) ghi đè kết quả mới nhất
          if (seq !== previewSeqRef.current || trimmed !== latestReplyRef.current) {
            return
          }
          setDraftGlosses(res.vsl_glosses)
          setMissingTerms(res.missing_terms)
          setPreviewMode(res.mode)
          setTranslationSource(res.translation_source || "")
          setIsGlossEdited(false)
        },
      })
    }, 450)

    return () => window.clearTimeout(timer)
  }, [customReply])

  if (!selectedCase) {
    return (
      <Card className="flex min-h-112 flex-col items-center justify-center gap-3 p-10 text-center">
        <ClipboardList className="size-8 text-muted-foreground" aria-hidden />
        <div className="max-w-sm space-y-1">
          <h3 className="text-base font-semibold">Chưa chọn hồ sơ người thăm khám</h3>
          <p className="text-sm text-muted-foreground">
            Chọn một phiếu từ danh sách hàng đợi bên trái để xem nội dung người thăm khám đã gửi, tự đánh giá tiếp nhận và gửi hướng dẫn 1 chạm đến Kiosk.
          </p>
        </div>
      </Card>
    )
  }

  const { semantic_frame: frame } = selectedCase
  const isEmergency = frame.intent === "emergency"

  // Gợi ý phản hồi thông minh theo từng tình huống ca bệnh từ backend (KB / Semantic Parser)
  const contextQuickReplies = frame.doctor_quick_responses ?? []

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
              Thông Tin Tiếp Nhận Từ Kiosk
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

        {/* KHU VỰC GỌI LƯỢT KHÔNG ÂM THANH (TRÁNH BỎ LỠ LOA GỌI SỐ) */}
        <div
          className={`rounded-xl border-2 p-4 space-y-3 ${
            selectedCase.call_status === "calling"
              ? "border-amber-500/70 bg-amber-500/10"
              : selectedCase.call_status === "on_the_way"
                ? "border-emerald-500/60 bg-emerald-500/10"
                : "border-primary/25 bg-primary/5"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Vibrate className="size-4 text-primary" aria-hidden />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Thẻ Chờ QR &amp; Gọi Lượt Không Âm Thanh
              </span>
            </div>

            {selectedCase.call_status === "calling" && (
              <Badge variant="warning" className="tabular-nums animate-pulse">
                Đang gọi ({elapsedSinceCallSec}s chưa xác nhận)
              </Badge>
            )}
            {selectedCase.call_status === "on_the_way" && (
              <Badge variant="success" className="gap-1">
                <DoorOpen className="size-3.5" />
                Đã thấy lúc {selectedCase.on_the_way_at} — Đang vào!
              </Badge>
            )}
            {selectedCase.call_status === "pre_alert" && (
              <Badge variant="secondary">Đã gửi báo chuẩn bị</Badge>
            )}
          </div>

          {/* Nút cho phép nhân viên chủ động bật/tắt mã QR Thẻ Chờ trên Kiosk */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/80 px-3 py-2.5">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground">
                Hiển thị mã QR Thẻ Chờ Di Động trên Kiosk
              </p>
              <p className="text-[11px] text-muted-foreground">
                Chỉ bật khi người bệnh điếc/nặng tai cần báo rung thay loa (mặc định tắt).
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant={selectedCase.qr_pass_enabled ? "success" : "outline"}
              loading={isTogglingQrPass}
              onClick={() =>
                onToggleQrPass(
                  selectedCase.ticket_number,
                  !selectedCase.qr_pass_enabled,
                )
              }
              className="gap-1.5 font-semibold shrink-0"
            >
              <QrCode className="size-4" />
              {selectedCase.qr_pass_enabled
                ? "Đang hiện QR trên Kiosk (Bấm để ẩn)"
                : "Hiện mã QR trên Kiosk"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              list="signbridge-room-options"
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              placeholder="Nhập tên phòng khám..."
              className="h-9 min-w-52 flex-1 rounded-md border bg-background px-3 text-sm font-medium focus:ring-2 focus:ring-ring focus:outline-none"
            />
            <datalist id="signbridge-room-options">
              {DEFAULT_ROOM_OPTIONS.map((room) => (
                <option key={room} value={room} />
              ))}
            </datalist>

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isCalling || !selectedRoom.trim()}
              onClick={() =>
                onCallPatient(
                  selectedCase.ticket_number,
                  selectedRoom.trim(),
                  "pre_alert",
                )
              }
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              <Clock className="size-3.5" />
              Báo chuẩn bị
            </Button>

            <Button
              type="button"
              size="sm"
              variant="default"
              loading={isCalling}
              disabled={!selectedRoom.trim()}
              onClick={() =>
                onCallPatient(
                  selectedCase.ticket_number,
                  selectedRoom.trim(),
                  "calling",
                )
              }
              className={`h-9 gap-1.5 font-bold ${
                selectedCase.call_status === "calling"
                  ? "bg-amber-600 text-white hover:bg-amber-700"
                  : ""
              }`}
            >
              <BellRing className="size-4" />
              {selectedCase.call_status === "calling"
                ? "Rung nhắc lại"
                : "Gọi vào phòng (Rung ngay)"}
            </Button>
          </div>

          {selectedCase.call_status === "calling" && elapsedSinceCallSec >= 45 && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Đã quá <strong>{elapsedSinceCallSec} giây</strong> bệnh nhân chưa bấm xác nhận trên Thẻ Chờ — Vui lòng bấm{" "}
                <strong>Rung nhắc lại</strong> hoặc cử nhân viên ra khu vực chờ hỗ trợ trực tiếp (tránh nhảy qua lượt).
              </span>
            </div>
          )}

          {selectedCase.call_status === "on_the_way" && (
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Bệnh nhân đã xác nhận nhận được tín hiệu gọi vào{" "}
              <strong>{selectedCase.assigned_room}</strong> — Xin vui lòng giữ lượt trong giây lát.
            </p>
          )}
        </div>

        <div className="rounded-xl border bg-muted/40 p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Nội Dung Người Thăm Khám Đã Gửi
            </p>
            <div className="flex items-center gap-2">
              {selectedCase.status === "need_help" && (
                <Badge variant="warning">Cần hỗ trợ trực tiếp</Badge>
              )}
              {selectedCase.status === "edited" && (
                <Badge variant="outline">Đã chỉnh sửa trước khi gửi</Badge>
              )}
              <span className="text-xs text-muted-foreground tabular-nums">
                {selectedCase.created_at}
              </span>
            </div>
          </div>

          <p className="text-base font-semibold leading-relaxed text-foreground">
            “{selectedCase.confirmed_text}”
          </p>

          {selectedCase.vsl_text && (
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-primary">Trật tự VSL:</span>{" "}
              {selectedCase.vsl_text}
            </p>
          )}

          {selectedCase.gloss_sequence && selectedCase.gloss_sequence.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[11px] font-medium text-muted-foreground">
                Ký hiệu đã nhận diện:
              </span>
              {selectedCase.gloss_sequence.map((gloss, idx) => (
                <Badge
                  key={`${gloss}-${idx}`}
                  variant="secondary"
                  className="text-[11px]"
                >
                  {gloss}
                </Badge>
              ))}
            </div>
          )}
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
        {contextQuickReplies.length > 0 && (
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
        )}

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
                  {translationSource === "gemini_rag" && !isGlossEdited && (
                    <Badge variant="default" className="text-[10px]">
                      Gemini Few-shot RAG
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
