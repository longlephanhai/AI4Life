import * as React from "react"
import {
  AlertTriangle,
  ArrowRightCircle,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Hand,
  HeartPulse,
  HelpCircle,
  MessageSquare,
  RotateCcw,
  Send,
  Stethoscope,
  ThumbsUp,
  Ticket,
  UserCheck,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CameraStage } from "@/components/kiosk/camera-stage"
import { VslSkeletonPlayer } from "@/components/kiosk/vsl-skeleton-player"
import {
  InteractiveBodyMap,
  type BodyRegion,
} from "@/components/kiosk/interactive-body-map"
import { useSynthesizeVsl } from "@/hooks/use-signbridge"
import type {
  DialogueMessage,
  DoctorReply,
  RecognizeResponse,
  VslSynthesizeResponse,
} from "@/lib/types"

const QUICK_DURATION_CHIPS = [
  "Mới bị hôm nay",
  "Khoảng 2–3 ngày nay",
  "Hơn 1 tuần rồi",
  "Không bị dị ứng thuốc",
  "Có dị ứng thuốc",
]

interface DialogueSessionProps {
  ticketNumber: string
  messages: DialogueMessage[]
  doctorReply: DoctorReply | null
  isAcking: boolean
  isSendingMessage: boolean
  isAnalyzingVideo: boolean
  onAcknowledge: (
    action: "understood" | "yes" | "no" | "need_help",
    note?: string,
  ) => void
  onSendPatientMessage: (payload: {
    text: string
    source: "vsl" | "body_map" | "quick_reply" | "text"
    gloss_sequence?: string[]
  }) => void
  onRecognizeVideo: (file: File) => Promise<RecognizeResponse>
  onResetKiosk: () => void
}

export function DialogueSession({
  ticketNumber,
  messages,
  doctorReply,
  isAcking,
  isSendingMessage,
  isAnalyzingVideo,
  onAcknowledge,
  onSendPatientMessage,
  onRecognizeVideo,
  onResetKiosk,
}: DialogueSessionProps) {
  const synthesizeVslMutation = useSynthesizeVsl()
  const [replyMode, setReplyMode] = React.useState<
    "none" | "camera" | "body_map"
  >("none")
  const [selectedRegion, setSelectedRegion] = React.useState<BodyRegion | null>(
    null,
  )
  const [vslDraft, setVslDraft] = React.useState<RecognizeResponse | null>(null)
  const [synthesizedVsl, setSynthesizedVsl] =
    React.useState<VslSynthesizeResponse | null>(null)
  const [customText, setCustomText] = React.useState("")
  const threadEndRef = React.useRef<HTMLDivElement | null>(null)
  const lastSynthesizedPromptRef = React.useRef<string>("")

  React.useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  const latestClinicianMsg = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender === "clinician") return messages[i]
    }
    return null
  }, [messages])

  const activePrompt = doctorReply?.message || latestClinicianMsg?.text || null
  const activeCategory =
    doctorReply?.category || latestClinicianMsg?.category || "general"
  const activeSendVsl =
    doctorReply?.send_vsl ?? latestClinicianMsg?.send_vsl ?? true
  const activeApprovedGlosses =
    doctorReply?.vsl_glosses ?? latestClinicianMsg?.vsl_glosses
  const activeMissingTerms =
    doctorReply?.missing_terms ?? latestClinicianMsg?.missing_terms ?? []
  const activeVslMode = doctorReply?.vsl_mode ?? latestClinicianMsg?.vsl_mode
  const activePromptKey = `${doctorReply?.replied_at ?? latestClinicianMsg?.timestamp ?? ""}:${activePrompt ?? ""}:${activeSendVsl}:${(activeApprovedGlosses ?? []).join(",")}:${activeMissingTerms.join(",")}`

  // Tự động tổng hợp & phát hoạt ảnh VSL đúng theo chuỗi Gloss đã được nhân viên xác nhận
  React.useEffect(() => {
    if (!activePrompt || lastSynthesizedPromptRef.current === activePromptKey) {
      return
    }
    lastSynthesizedPromptRef.current = activePromptKey
    if (!activeSendVsl) {
      setSynthesizedVsl(null)
      return
    }
    const inheritedMissing = activeMissingTerms
    synthesizeVslMutation.mutate(
      {
        text: activePrompt,
        overrideGlosses:
          activeVslMode === "stitched" ? activeApprovedGlosses : undefined,
      },
      {
        onSuccess: (res) => {
          setSynthesizedVsl({
            ...res,
            missing_terms:
              res.missing_terms.length > 0 ? res.missing_terms : inheritedMissing,
          })
        },
      },
    )
  }, [activePrompt, activePromptKey, activeSendVsl, activeVslMode, activeApprovedGlosses, activeMissingTerms])

  const handleVideoCaptured = async (file: File) => {
    setVslDraft(null)
    const res = await onRecognizeVideo(file)
    setVslDraft(res)
  }

  const handleConfirmVslDraft = () => {
    if (!vslDraft?.translation) return
    onSendPatientMessage({
      text: vslDraft.translation,
      source: "vsl",
      gloss_sequence: vslDraft.gloss_sequence,
    })
    setVslDraft(null)
    setReplyMode("none")
  }

  const handleSendRegion = () => {
    if (!selectedRegion) return
    onSendPatientMessage({
      text: selectedRegion.phrase,
      source: "body_map",
    })
    setSelectedRegion(null)
    setReplyMode("none")
  }

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = customText.trim()
    if (!trimmed) return
    onSendPatientMessage({ text: trimmed, source: "text" })
    setCustomText("")
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 py-2">
      {/* 1. Thanh tiêu đề phiên đối thoại trực tiếp */}
      <Card className="flex flex-wrap items-center justify-between gap-3 border-success/40 bg-success/10 px-5 py-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-success text-success-foreground shadow-sm">
            <Ticket className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-extrabold tabular-nums">
                Phiếu {ticketNumber}
              </span>
              <Badge variant="success" className="text-[11px] font-bold">
                ĐANG ĐỐI THOẠI TRỰC TIẾP
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Bạn có thể xem câu hỏi của nhân viên y tế và trả lời bằng nút bấm, Camera VSL hoặc Sơ đồ cơ thể.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onResetKiosk}
          className="gap-1.5 font-semibold"
        >
          <RotateCcw className="size-3.5" />
          Hoàn tất lượt khám
        </Button>
      </Card>

      {/* 2. Thẻ hiển thị chỉ dẫn / câu hỏi mới nhất từ nhân viên y tế (Chữ lớn + Icon + VSL mẫu) */}
      <Card
        className={`p-5 shadow-md border-2 ${
          activePrompt
            ? activeCategory === "emergency"
              ? "border-destructive bg-destructive/10"
              : "border-primary bg-primary/5"
            : "border-border bg-card"
        }`}
      >
        {activePrompt ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  {activeCategory === "insurance" && <CreditCard className="size-5" />}
                  {activeCategory === "direction" && <ArrowRightCircle className="size-5" />}
                  {activeCategory === "vital_signs" && <HeartPulse className="size-5" />}
                  {activeCategory === "question_yes_no" && <HelpCircle className="size-5" />}
                  {activeCategory === "emergency" && <AlertTriangle className="size-5" />}
                  {(activeCategory === "general" || !activeCategory) && (
                    <Stethoscope className="size-5" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    Nhân viên y tế đang hỏi / hướng dẫn bạn:
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {doctorReply?.clinician_name ?? "NV. Bàn Tiếp Nhận"} •{" "}
                    {doctorReply?.replied_at ?? latestClinicianMsg?.timestamp}
                  </p>
                </div>
              </div>
            </div>

            <p className="font-display text-2xl font-bold leading-snug text-foreground">
              “{activePrompt}”
            </p>

            <VslSkeletonPlayer
              data={synthesizedVsl}
              isLoading={synthesizeVslMutation.isPending}
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Clock className="size-5 animate-pulse text-primary" />
            <span>
              Đã gửi thông tin tới Bàn Tiếp Nhận. Đang chờ nhân viên y tế phản hồi hoặc hỏi thêm...
            </span>
          </div>
        )}
      </Card>

      {/* 3. Lịch sử hội thoại 2 chiều nhiều lượt */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <MessageSquare className="size-3.5 text-primary" />
          <span>Luồng đối thoại ({messages.length} lượt)</span>
        </div>

        <div className="max-h-60 space-y-2.5 overflow-y-auto pr-1">
          {messages.map((m) => {
            const isPatient = m.sender === "patient"
            return (
              <div
                key={m.id}
                className={`flex flex-col gap-1 rounded-xl px-3.5 py-2.5 text-sm ${
                  isPatient
                    ? "ml-8 border border-success/30 bg-success/10"
                    : "mr-8 border border-primary/30 bg-primary/10"
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold">
                    {isPatient ? "Bạn (Bệnh nhân)" : m.sender_name || "Nhân viên y tế"}
                    {isPatient && m.source && (
                      <span className="ml-1.5 rounded bg-background/80 px-1.5 py-0.5 text-[10px] uppercase">
                        {m.source === "vsl"
                          ? "Camera VSL"
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
                <p className="font-medium text-foreground">{m.text}</p>
              </div>
            )
          })}
          <div ref={threadEndRef} />
        </div>
      </Card>

      {/* 4. Khu vực trả lời đa phương thức của Bệnh nhân (luôn mở ở mọi lượt) */}
      <Card className="p-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Chọn cách bạn muốn trả lời lại nhân viên y tế:
        </p>

        {/* Nút 1 chạm */}
        <div className="flex flex-wrap gap-2.5">
          {activeCategory === "question_yes_no" && (
            <>
              <Button
                size="lg"
                variant="success"
                disabled={isAcking}
                onClick={() => onAcknowledge("yes", "CÓ / ĐÚNG")}
                className="gap-2 font-bold"
              >
                <Check className="size-4" />
                CÓ / ĐÚNG
              </Button>
              <Button
                size="lg"
                variant="destructive"
                disabled={isAcking}
                onClick={() => onAcknowledge("no", "KHÔNG")}
                className="gap-2 font-bold"
              >
                <X className="size-4" />
                KHÔNG
              </Button>
            </>
          )}
          <Button
            size="lg"
            variant="default"
            disabled={isAcking}
            onClick={() =>
              onAcknowledge("understood", "Đã hiểu & Đang thực hiện")
            }
            className="gap-2 font-bold"
          >
            <ThumbsUp className="size-4" />
            Đã hiểu
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={isAcking}
            onClick={() =>
              onAcknowledge("need_help", "Chưa hiểu — Cần người hỗ trợ trực tiếp")
            }
            className="gap-2 font-semibold border-warning/60 text-warning-foreground"
          >
            <UserCheck className="size-4" />
            Cần người hỗ trợ
          </Button>
        </div>

        {/* Nút mở Camera VSL hoặc Sơ đồ cơ thể để trả lời câu hỏi mở */}
        <div className="flex flex-wrap items-center gap-2.5 border-t pt-3">
          <Button
            type="button"
            variant={replyMode === "camera" ? "default" : "secondary"}
            onClick={() => {
              setVslDraft(null)
              setReplyMode((m) => (m === "camera" ? "none" : "camera"))
            }}
            className="gap-2 font-semibold"
          >
            <Camera className="size-4" />
            {replyMode === "camera"
              ? "Đóng Camera VSL"
              : "Trả lời bằng Camera VSL"}
          </Button>
          <Button
            type="button"
            variant={replyMode === "body_map" ? "default" : "secondary"}
            onClick={() =>
              setReplyMode((m) => (m === "body_map" ? "none" : "body_map"))
            }
            className="gap-2 font-semibold"
          >
            <Hand className="size-4" />
            {replyMode === "body_map"
              ? "Đóng Sơ đồ cơ thể"
              : "Chỉ lại trên Sơ đồ cơ thể"}
          </Button>
        </div>

        {/* Gợi ý nhanh thời gian / dị ứng */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_DURATION_CHIPS.map((chip) => (
            <Button
              key={chip}
              type="button"
              size="sm"
              variant="outline"
              disabled={isSendingMessage}
              onClick={() =>
                onSendPatientMessage({ text: chip, source: "quick_reply" })
              }
              className="h-8 text-xs"
            >
              {chip}
            </Button>
          ))}
        </div>

        {/* Khung Camera VSL trả lời trực tiếp */}
        {replyMode === "camera" && (
          <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <CameraStage
              isAnalyzing={isAnalyzingVideo}
              activeVideoName={null}
              samplePlaybackData={null}
              onUploadVideo={(file) => {
                void handleVideoCaptured(file)
              }}
              onCameraActivated={() => {}}
            />

            {vslDraft && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    {vslDraft.is_recognized !== false
                      ? "Hệ thống nhận diện câu trả lời:"
                      : "Chưa nhận diện rõ ký hiệu"}
                  </p>
                  <p className="text-base font-bold text-foreground">
                    {vslDraft.translation || vslDraft.fallback_message}
                  </p>
                </div>
                {vslDraft.is_recognized !== false && vslDraft.translation && (
                  <Button
                    type="button"
                    variant="success"
                    disabled={isSendingMessage}
                    onClick={handleConfirmVslDraft}
                    className="gap-1.5 font-bold"
                  >
                    <CheckCircle2 className="size-4" />
                    Gửi câu trả lời này
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Khung Sơ đồ cơ thể trả lời trực tiếp */}
        {replyMode === "body_map" && (
          <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <InteractiveBodyMap
              selectedRegionId={selectedRegion?.id ?? ""}
              onSelectRegion={setSelectedRegion}
            />
            {selectedRegion && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3">
                <p className="text-sm font-semibold">
                  Đã chọn: <span className="text-primary">{selectedRegion.phrase}</span>
                </p>
                <Button
                  type="button"
                  variant="success"
                  disabled={isSendingMessage}
                  onClick={handleSendRegion}
                  className="gap-1.5 font-bold"
                >
                  <Send className="size-4" />
                  Gửi vị trí này
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Nhập chữ dự phòng nếu cần */}
        <form onSubmit={handleCustomSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Hoặc gõ thêm câu trả lời ngắn nếu cần..."
            className="h-10 flex-1 rounded-md border bg-background px-3 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
          />
          <Button
            type="submit"
            disabled={isSendingMessage || !customText.trim()}
            className="h-10 gap-1.5"
          >
            <Send className="size-4" />
            Gửi
          </Button>
        </form>
      </Card>
    </div>
  )
}
