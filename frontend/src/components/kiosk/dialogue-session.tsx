import * as React from "react"
import {
  AlertTriangle,
  ArrowRightCircle,
  BellRing,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  DoorOpen,
  ExternalLink,
  Hand,
  HeartPulse,
  HelpCircle,
  MapPin,
  MessageSquare,
  Plus,
  QrCode,
  RotateCcw,
  Send,
  Smartphone,
  Stethoscope,
  ThumbsUp,
  Ticket,
  UserCheck,
  X,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CameraStage } from "@/components/kiosk/camera-stage"
import { VslSkeletonPlayer } from "@/components/kiosk/vsl-skeleton-player"
import {
  InteractiveBodyMap,
  type BodyRegion,
} from "@/components/kiosk/interactive-body-map"
import { useNetworkInfo, useSynthesizeVsl } from "@/hooks/use-signbridge"
import type {
  CallStatus,
  DialogueMessage,
  DoctorReply,
  QuickReplyItem,
  RecognizeResponse,
  VslSynthesizeResponse,
} from "@/lib/types"
import {
  formatGlossTokenReadable,
  formatVslChunksReadable,
  mergeCapturedClauses,
  resolveVslDisplayText,
  type CapturedVslClause,
} from "@/lib/vsl-format"

const QUICK_DURATION_CHIPS: QuickReplyItem[] = [
  { text: "Mới bị hôm nay", vsl_text: "Hôm nay · mới bị" },
  { text: "Khoảng 2–3 ngày nay", vsl_text: "2–3 ngày · rồi" },
  { text: "Hơn 1 tuần rồi", vsl_text: "Hơn 1 tuần · rồi" },
  { text: "Không bị dị ứng thuốc", vsl_text: "Tôi · dị ứng thuốc · không" },
  { text: "Có dị ứng thuốc", vsl_text: "Tôi · dị ứng thuốc · có" },
]

interface DialogueSessionProps {
  ticketNumber: string
  messages: DialogueMessage[]
  doctorReply: DoctorReply | null
  qrPassEnabled?: boolean
  callStatus?: CallStatus
  assignedRoom?: string | null
  callVslText?: string | null
  showVslOrder?: boolean
  isAcking: boolean
  isConfirmingOnTheWay?: boolean
  isSendingMessage: boolean
  isAnalyzingVideo: boolean
  onAcknowledge: (
    action: "understood" | "yes" | "no" | "need_help",
    note?: string,
  ) => void
  onConfirmOnTheWay?: () => void
  onSendPatientMessage: (payload: {
    text: string
    source: "vsl" | "body_map" | "quick_reply" | "text"
    gloss_sequence?: string[]
    vsl_text?: string | null
  }) => void
  onRecognizeVideo: (file: File) => Promise<RecognizeResponse>
  onResetKiosk: () => void
}

export function DialogueSession({
  ticketNumber,
  messages,
  doctorReply,
  qrPassEnabled = false,
  callStatus = "waiting",
  assignedRoom = null,
  callVslText = null,
  showVslOrder = true,
  isAcking,
  isConfirmingOnTheWay = false,
  isSendingMessage,
  isAnalyzingVideo,
  onAcknowledge,
  onConfirmOnTheWay,
  onSendPatientMessage,
  onRecognizeVideo,
  onResetKiosk,
}: DialogueSessionProps) {
  const synthesizeVslMutation = useSynthesizeVsl()
  const networkInfoQuery = useNetworkInfo()
  const [customQrOrigin, setCustomQrOrigin] = React.useState<string>(() => {
    try {
      return localStorage.getItem("signbridge_qr_origin") || ""
    } catch {
      return ""
    }
  })

  const lanQrOrigin = React.useMemo(() => {
    if (typeof window === "undefined") return ""
    const { protocol, hostname, port, origin } = window.location
    const lanIp = networkInfoQuery.data?.lan_ip
    if ((hostname === "localhost" || hostname === "127.0.0.1") && lanIp) {
      return `${protocol}//${lanIp}${port ? `:${port}` : ""}`
    }
    return origin
  }, [networkInfoQuery.data?.lan_ip])

  const resolvedQrOrigin = (customQrOrigin.trim() || lanQrOrigin).replace(/\/+$/, "")
  const qrTicketUrl = `${resolvedQrOrigin}/?ticket=${encodeURIComponent(ticketNumber)}`

  const handleUpdateQrOrigin = (nextVal: string) => {
    setCustomQrOrigin(nextVal)
    try {
      if (nextVal.trim()) {
        localStorage.setItem("signbridge_qr_origin", nextVal.trim())
      } else {
        localStorage.removeItem("signbridge_qr_origin")
      }
    } catch {
      // ignore storage failure
    }
  }
  const [replyMode, setReplyMode] = React.useState<
    "none" | "camera" | "body_map"
  >("none")
  const [selectedRegion, setSelectedRegion] = React.useState<BodyRegion | null>(
    null,
  )
  const [vslDraft, setVslDraft] = React.useState<RecognizeResponse | null>(null)
  const [vslClauses, setVslClauses] = React.useState<CapturedVslClause[]>([])
  const [isAppendingVslClause, setIsAppendingVslClause] = React.useState(false)
  const [vslAppendNotice, setVslAppendNotice] = React.useState<string | null>(null)
  const [synthesizedVsl, setSynthesizedVsl] =
    React.useState<VslSynthesizeResponse | null>(null)
  const [activePlayerGloss, setActivePlayerGloss] = React.useState<string | null>(null)
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
  const activeVslText =
    doctorReply?.vsl_text ?? latestClinicianMsg?.vsl_text ?? null
  const activeCategory =
    doctorReply?.category || latestClinicianMsg?.category || "general"
  const activeSendVsl =
    doctorReply?.send_vsl ?? latestClinicianMsg?.send_vsl ?? true
  const activeApprovedGlosses =
    doctorReply?.vsl_glosses ?? latestClinicianMsg?.vsl_glosses
  const activeMissingTerms = React.useMemo(
    () =>
      doctorReply?.missing_terms ?? latestClinicianMsg?.missing_terms ?? [],
    [doctorReply?.missing_terms, latestClinicianMsg?.missing_terms],
  )
  const activeVslMode = doctorReply?.vsl_mode ?? latestClinicianMsg?.vsl_mode

  const dynamicQuickReplyItems: QuickReplyItem[] = React.useMemo(() => {
    const rich =
      doctorReply?.patient_quick_reply_items ??
      latestClinicianMsg?.patient_quick_reply_items
    if (rich && rich.length > 0) return rich
    const plain =
      doctorReply?.patient_quick_replies ??
      latestClinicianMsg?.patient_quick_replies ??
      []
    return plain.map((text) => ({
      text,
      vsl_text:
        resolveVslDisplayText({ vietnameseText: text }) ?? text,
    }))
  }, [doctorReply, latestClinicianMsg])

  const activePromptKey = `${doctorReply?.replied_at ?? latestClinicianMsg?.timestamp ?? ""}:${activePrompt ?? ""}:${activeSendVsl}:${(activeApprovedGlosses ?? []).join(",")}:${activeMissingTerms.join(",")}`

  // Tự động tổng hợp & phát hoạt ảnh VSL đúng theo chuỗi Gloss đã được nhân viên xác nhận
  React.useEffect(() => {
    if (!activePrompt || lastSynthesizedPromptRef.current === activePromptKey) {
      return
    }
    lastSynthesizedPromptRef.current = activePromptKey
    setActivePlayerGloss(null)
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

  const activeReadableVslTokens = React.useMemo(() => {
    const rawGlosses =
      synthesizedVsl?.gloss_sequence?.length
        ? synthesizedVsl.gloss_sequence
        : activeApprovedGlosses ?? []
    const chunks = formatVslChunksReadable(rawGlosses, activeMissingTerms)
    if (chunks.length > 0) {
      return { chunks, rawGlosses }
    }
    const fallbackText = resolveVslDisplayText({
      vslText: activeVslText,
      glosses: rawGlosses,
      missingTerms: activeMissingTerms,
      vietnameseText: activePrompt,
    })
    return {
      chunks: fallbackText ? fallbackText.split(" · ").filter(Boolean) : [],
      rawGlosses: [] as string[],
    }
  }, [synthesizedVsl?.gloss_sequence, activeApprovedGlosses, activeMissingTerms, activeVslText, activePrompt])

  const activeReadableHighlight = React.useMemo(
    () => (activePlayerGloss ? formatGlossTokenReadable(activePlayerGloss).toLowerCase() : ""),
    [activePlayerGloss],
  )

  const syncMergedVslClauses = React.useCallback(
    (nextClauses: CapturedVslClause[], baseRes?: RecognizeResponse) => {
      setVslClauses(nextClauses)
      if (nextClauses.length === 0) {
        setVslDraft(null)
        return
      }
      const { mergedText, mergedGlosses, mergedVslText, avgConfidence } =
        mergeCapturedClauses(nextClauses)

      setVslDraft((prev) => {
        const template = baseRes ?? prev
        if (!template) return null
        return {
          ...template,
          is_recognized: true,
          recognition_status: "recognized",
          fallback_message: null,
          translation: mergedText,
          gloss_sequence: mergedGlosses,
          vsl_text: mergedVslText,
          confidence: avgConfidence,
        }
      })
    },
    [],
  )

  const handleVideoCaptured = async (file: File) => {
    setVslAppendNotice(null)
    const res = await onRecognizeVideo(file)
    const recognized = res.is_recognized !== false && Boolean(res.translation)

    if (recognized) {
      const newClause: CapturedVslClause = {
        translation: res.translation,
        glosses: res.gloss_sequence,
        confidence: res.confidence,
        vslText: res.vsl_text,
      }
      if (isAppendingVslClause && vslClauses.length > 0) {
        setIsAppendingVslClause(false)
        syncMergedVslClauses([...vslClauses, newClause], res)
      } else {
        setIsAppendingVslClause(false)
        setVslClauses([newClause])
        setVslDraft(res)
      }
      return
    }

    if (isAppendingVslClause && vslClauses.length > 0) {
      setIsAppendingVslClause(false)
      setVslAppendNotice(
        res.fallback_message ||
          "Chưa nhận diện rõ ý vừa quay thêm — các ý trước đó vẫn được giữ nguyên.",
      )
      return
    }

    setIsAppendingVslClause(false)
    setVslClauses([])
    setVslDraft(res)
  }

  const handleConfirmVslDraft = () => {
    if (!vslDraft?.translation) return
    onSendPatientMessage({
      text: vslDraft.translation,
      source: "vsl",
      gloss_sequence: vslDraft.gloss_sequence,
      vsl_text:
        vslDraft.vsl_text ??
        resolveVslDisplayText({
          glosses: vslDraft.gloss_sequence,
          vietnameseText: vslDraft.translation,
        }),
    })
    setVslDraft(null)
    setVslClauses([])
    setIsAppendingVslClause(false)
    setVslAppendNotice(null)
    setReplyMode("none")
  }

  const handleSendRegion = () => {
    if (!selectedRegion) return
    const vslText = `Tôi · ${selectedRegion.label.toLowerCase()} · đau`
    onSendPatientMessage({
      text: selectedRegion.phrase,
      source: "body_map",
      vsl_text: vslText,
    })
    setSelectedRegion(null)
    setReplyMode("none")
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

      {/* 1b. Cảnh báo gọi lượt ngay trên Kiosk nếu bệnh nhân vẫn đang ở Kiosk */}
      {callStatus === "calling" && (
        <Card className="border-2 border-emerald-500 bg-emerald-500/15 p-5 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm animate-bounce">
                <BellRing className="size-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  ĐẾN LƯỢT CỦA BẠN — MỜI VÀO PHÒNG!
                </p>
                <p className="flex items-center gap-1.5 font-display text-2xl font-extrabold text-foreground">
                  <MapPin className="size-5 text-emerald-600" />
                  {assignedRoom || "Phòng Tiếp Nhận"}
                </p>
                {callVslText && (
                  <p className="text-sm font-semibold text-muted-foreground">
                    VSL: <span className="text-foreground">{callVslText}</span>
                  </p>
                )}
              </div>
            </div>

            {onConfirmOnTheWay && (
              <Button
                type="button"
                size="lg"
                variant="success"
                loading={isConfirmingOnTheWay}
                onClick={onConfirmOnTheWay}
                className="gap-2 font-extrabold shadow-sm"
              >
                <DoorOpen className="size-5" />
                Tôi đã thấy — Đang vào phòng
              </Button>
            )}
          </div>
        </Card>
      )}

      {callStatus === "on_the_way" && (
        <Card className="flex items-center justify-between gap-3 border-emerald-500/40 bg-emerald-500/10 px-5 py-3">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-5 shrink-0" />
            <span>
              Đã báo bác sĩ bạn đang di chuyển vào{" "}
              <strong>{assignedRoom || "phòng khám"}</strong>.
            </span>
          </div>
        </Card>
      )}

      {/* 1c. Thẻ Chờ Di Động QR — CHỈ HIỆN khi nhân viên tiếp nhận bấm cấp/cho phép hiện */}
      {qrPassEnabled && (
        <Card className="flex flex-col gap-3 border-2 border-primary/40 bg-primary/5 px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="rounded-xl border bg-white p-2 shadow-xs">
                <QRCodeSVG value={qrTicketUrl} size={96} level="M" />
              </div>
              <div className="space-y-1.5 max-w-xl">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                  <QrCode className="size-4" />
                  <span>Thẻ Chờ Di Động — Quét QR để không bỏ lỡ lượt gọi</span>
                  <Badge variant="success" className="text-[10px]">
                    Nhân viên đã bật cho bạn
                  </Badge>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Dùng điện thoại cùng Wi-Fi quét mã QR để mang theo số thứ tự ra ghế chờ. Khi được gọi vào phòng, điện thoại sẽ{" "}
                  <strong className="text-foreground">tự rung + nháy màn hình + chỉ tên phòng</strong>.
                </p>
                <p className="font-mono text-[11px] text-primary break-all">
                  {qrTicketUrl}
                </p>
              </div>
            </div>

            <a
              href={qrTicketUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "gap-1.5 shrink-0",
              })}
            >
              <Smartphone className="size-4 text-primary" />
              Mở Thẻ Chờ trên tab mới
              <ExternalLink className="size-3.5" />
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-primary/15 pt-2.5 text-[11px]">
            <span className="font-medium text-muted-foreground">Địa chỉ QR:</span>
            <button
              type="button"
              onClick={() => handleUpdateQrOrigin("")}
              className={`cursor-pointer rounded border px-2 py-0.5 font-medium ${
                !customQrOrigin.trim()
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              Tự động Wi-Fi LAN ({networkInfoQuery.data?.lan_ip || "local"})
            </button>
            <button
              type="button"
              onClick={() =>
                handleUpdateQrOrigin(
                  typeof window !== "undefined" ? window.location.origin : "http://localhost:5173",
                )
              }
              className={`cursor-pointer rounded border px-2 py-0.5 font-medium ${
                customQrOrigin.trim() ===
                (typeof window !== "undefined" ? window.location.origin : "")
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              Localhost (USB adb reverse)
            </button>
            <input
              type="url"
              value={customQrOrigin}
              onChange={(e) => handleUpdateQrOrigin(e.target.value)}
              placeholder="Hoặc dán link HTTPS tunnel (vd: https://xxx.trycloudflare.com)"
              className="h-7 min-w-56 flex-1 rounded border bg-background px-2 font-mono text-[11px] focus:ring-1 focus:ring-ring focus:outline-none"
            />
          </div>
        </Card>
      )}

      {/* 2. Thẻ hiển thị chỉ dẫn / câu hỏi mới nhất từ nhân viên y tế (Chữ lớn + Trật tự VSL + Khung xương) */}
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

            <div className="space-y-2.5">
              <p className="font-display text-2xl font-bold leading-snug text-foreground">
                “{activePrompt}”
              </p>

              {showVslOrder && activeReadableVslTokens.chunks.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-background/85 px-3.5 py-2.5">
                  <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                    Ngữ pháp VSL
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {activeReadableVslTokens.chunks.map((chunk, idx) => {
                      const isHighlighted =
                        Boolean(activeReadableHighlight) &&
                        chunk.toLowerCase() === activeReadableHighlight
                      return (
                        <React.Fragment key={`${chunk}-${idx}`}>
                          {idx > 0 && (
                            <span className="text-muted-foreground/60 font-bold" aria-hidden>
                              ·
                            </span>
                          )}
                          <span
                            className={`rounded-md px-2 py-0.5 text-sm font-semibold transition-colors ${
                              isHighlighted
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "bg-muted/70 text-foreground"
                            }`}
                          >
                            {chunk}
                          </span>
                        </React.Fragment>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <VslSkeletonPlayer
              data={synthesizedVsl}
              isLoading={synthesizeVslMutation.isPending}
              onActiveGlossChange={setActivePlayerGloss}
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
            const msgVsl = showVslOrder
              ? resolveVslDisplayText({
                  vslText: m.vsl_text,
                  glosses: m.vsl_glosses ?? m.gloss_sequence,
                  missingTerms: m.missing_terms,
                  vietnameseText: m.text,
                })
              : null
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
                {msgVsl && (
                  <p className="text-xs font-medium text-primary/90">
                    <span className="mr-1 rounded bg-background/80 px-1 py-0.5 text-[10px] font-bold uppercase text-primary">
                      VSL
                    </span>
                    {msgVsl}
                  </p>
                )}
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

        {/* Nút trả lời nhanh ĐỘNG khớp đúng câu hỏi của nhân viên y tế (Song ngữ Việt + VSL) */}
        {dynamicQuickReplyItems.length > 0 && (
          <div className="space-y-2 rounded-xl border border-primary/25 bg-primary/5 p-3.5">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              Chạm để trả lời nhanh câu hỏi trên:
            </p>
            <div className="flex flex-wrap gap-2.5">
              {dynamicQuickReplyItems.map((item) => (
                <Button
                  key={item.text}
                  type="button"
                  size="lg"
                  variant="secondary"
                  disabled={isSendingMessage}
                  onClick={() =>
                    onSendPatientMessage({
                      text: item.text,
                      vsl_text: item.vsl_text,
                      source: "quick_reply",
                    })
                  }
                  className="group h-auto min-h-12 flex-col items-start gap-0.5 px-4 py-2.5 text-left border border-primary/20 bg-background hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <span className="text-sm font-bold leading-snug">{item.text}</span>
                  {showVslOrder && item.vsl_text && (
                    <span className="text-xs font-medium text-primary group-hover:text-primary-foreground/90">
                      VSL: {item.vsl_text}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Nút 1 chạm */}
        <div className="flex flex-wrap gap-2.5">
          {activeCategory === "question_yes_no" && (
            <>
              <Button
                size="lg"
                variant="success"
                disabled={isAcking}
                onClick={() => onAcknowledge("yes", "CÓ / ĐÚNG")}
                className="h-auto min-h-11 gap-2 py-2 font-bold"
              >
                <Check className="size-4 shrink-0" />
                <span className="flex flex-col items-start leading-tight">
                  <span>CÓ / ĐÚNG</span>
                  {showVslOrder && (
                    <span className="text-[11px] font-medium opacity-85">VSL: Có / Đúng</span>
                  )}
                </span>
              </Button>
              <Button
                size="lg"
                variant="destructive"
                disabled={isAcking}
                onClick={() => onAcknowledge("no", "KHÔNG")}
                className="h-auto min-h-11 gap-2 py-2 font-bold"
              >
                <X className="size-4 shrink-0" />
                <span className="flex flex-col items-start leading-tight">
                  <span>KHÔNG</span>
                  {showVslOrder && (
                    <span className="text-[11px] font-medium opacity-85">VSL: Không</span>
                  )}
                </span>
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
            className="h-auto min-h-11 gap-2 py-2 font-bold"
          >
            <ThumbsUp className="size-4 shrink-0" />
            <span className="flex flex-col items-start leading-tight">
              <span>Đã hiểu</span>
              {showVslOrder && (
                <span className="text-[11px] font-medium opacity-85">
                  VSL: Tôi · hiểu rồi
                </span>
              )}
            </span>
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={isAcking}
            onClick={() =>
              onAcknowledge("need_help", "Chưa hiểu — Cần người hỗ trợ trực tiếp")
            }
            className="h-auto min-h-11 gap-2 py-2 font-semibold border-warning/60 text-warning-foreground"
          >
            <UserCheck className="size-4 shrink-0" />
            <span className="flex flex-col items-start leading-tight">
              <span>Cần người hỗ trợ</span>
              {showVslOrder && (
                <span className="text-[11px] font-medium text-muted-foreground">
                  VSL: Tôi · cần giúp
                </span>
              )}
            </span>
          </Button>
        </div>

        {/* Nút mở Camera VSL hoặc Sơ đồ cơ thể để trả lời câu hỏi mở */}
        <div className="flex flex-wrap items-center gap-2.5 border-t pt-3">
          <Button
            type="button"
            variant={replyMode === "camera" ? "default" : "secondary"}
            onClick={() => {
              setVslDraft(null)
              setVslClauses([])
              setIsAppendingVslClause(false)
              setVslAppendNotice(null)
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
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Hoặc chạm nhanh thông tin thời gian / dị ứng:
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_DURATION_CHIPS.map((chip) => (
              <Button
                key={chip.text}
                type="button"
                size="sm"
                variant="outline"
                disabled={isSendingMessage}
                onClick={() =>
                  onSendPatientMessage({
                    text: chip.text,
                    vsl_text: chip.vsl_text,
                    source: "quick_reply",
                  })
                }
                className="h-auto min-h-10 flex-col items-start gap-0.5 px-3 py-1.5 text-left"
              >
                <span className="text-xs font-semibold leading-tight">{chip.text}</span>
                {showVslOrder && (
                  <span className="text-[11px] font-medium text-primary leading-tight">
                    VSL: {chip.vsl_text}
                  </span>
                )}
              </Button>
            ))}
          </div>
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

            {vslAppendNotice && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-medium text-warning-foreground">
                ⚠️ {vslAppendNotice}
              </div>
            )}

            {vslClauses.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background/80 px-3 py-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  Các ý đã ghép ({vslClauses.length}):
                </span>
                {vslClauses.map((clause, idx) => (
                  <Badge
                    key={`${clause.translation}-${idx}`}
                    variant="secondary"
                    className="gap-1.5 pr-1.5 text-xs"
                  >
                    <span>{clause.translation}</span>
                    <button
                      type="button"
                      aria-label={`Xóa ý ${idx + 1}`}
                      onClick={() =>
                        syncMergedVslClauses(
                          vslClauses.filter((_, i) => i !== idx),
                        )
                      }
                      className="cursor-pointer rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {vslDraft && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3.5">
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    {vslDraft.is_recognized !== false
                      ? "Hệ thống nhận diện câu trả lời:"
                      : "Chưa nhận diện rõ ký hiệu"}
                  </p>
                  <p className="text-base font-bold text-foreground">
                    {vslDraft.translation || vslDraft.fallback_message}
                  </p>
                  {showVslOrder &&
                    vslDraft.is_recognized !== false &&
                    resolveVslDisplayText({
                      vslText: vslDraft.vsl_text,
                      glosses: vslDraft.gloss_sequence,
                      vietnameseText: vslDraft.translation,
                    }) && (
                      <p className="text-xs font-semibold text-primary">
                        Ngữ pháp VSL:{" "}
                        {resolveVslDisplayText({
                          vslText: vslDraft.vsl_text,
                          glosses: vslDraft.gloss_sequence,
                          vietnameseText: vslDraft.translation,
                        })}
                      </p>
                    )}
                </div>
                {vslDraft.is_recognized !== false && vslDraft.translation && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant={isAppendingVslClause ? "default" : "secondary"}
                      disabled={isSendingMessage || isAnalyzingVideo}
                      onClick={() => {
                        setVslAppendNotice(null)
                        setIsAppendingVslClause((prev) => !prev)
                      }}
                      className="gap-1.5 font-semibold"
                    >
                      <Plus className="size-4" />
                      {isAppendingVslClause
                        ? "Đang chờ quay thêm ý (Bấm để hủy)"
                        : "Quay thêm ý / nối câu"}
                    </Button>
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
                  </div>
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
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold">
                    Đã chọn: <span className="text-primary">{selectedRegion.phrase}</span>
                  </p>
                  {showVslOrder && (
                    <p className="text-xs font-medium text-primary">
                      Ngữ pháp VSL: Tôi · {selectedRegion.label.toLowerCase()} · đau
                    </p>
                  )}
                </div>
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
      </Card>
    </div>
  )
}
