import * as React from "react"
import { Video, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { CameraStage } from "@/components/kiosk/camera-stage"
import { ConfirmationBanner } from "@/components/kiosk/confirmation-banner"
import { DialogueSession } from "@/components/kiosk/dialogue-session"
import { FallbackAssistantPanel } from "@/components/kiosk/fallback-assistant-panel"
import { RecognitionPanel } from "@/components/kiosk/recognition-panel"
import { useToast } from "@/components/ui/toast"
import {
  useAcknowledgeDoctorReply,
  useConfirmCase,
  useParseSemantic,
  useQueue,
  useRecognizeVideo,
  useSampleKeypoints,
  useSendPatientMessage,
} from "@/hooks/use-signbridge"
import type {
  RecognitionStatus,
  SampleKeypointsResponse,
  SemanticFrame,
} from "@/lib/types"

export function KioskWorkspace() {
  const { pushToast } = useToast()
  const queueQuery = useQueue()
  const parseMutation = useParseSemantic()
  const recognizeMutation = useRecognizeVideo()
  const sampleKeypointsMutation = useSampleKeypoints()
  const confirmMutation = useConfirmCase()
  const ackMutation = useAcknowledgeDoctorReply()
  const sendPatientMsgMutation = useSendPatientMessage()

  const [isManuallyEdited, setIsManuallyEdited] = React.useState(false)
  const [samplePlaybackData, setSamplePlaybackData] =
    React.useState<SampleKeypointsResponse | null>(null)
  const [glosses, setGlosses] = React.useState<string[]>([])
  const [translation, setTranslation] = React.useState<string>("")
  const [confidence, setConfidence] = React.useState<number>(0)
  const [isRecognized, setIsRecognized] = React.useState<boolean>(true)
  const [recognitionStatus, setRecognitionStatus] =
    React.useState<RecognitionStatus>("recognized")
  const [fallbackMessage, setFallbackMessage] = React.useState<string | null>(null)
  const [frame, setFrame] = React.useState<SemanticFrame | null>(null)
  const [activeVideoName, setActiveVideoName] = React.useState<string | null>(null)
  const [activeTicket, setActiveTicket] = React.useState<string | null>(null)
  const [capturedClauses, setCapturedClauses] = React.useState<
    Array<{ translation: string; glosses: string[]; confidence: number }>
  >([])
  const [isAppendingClause, setIsAppendingClause] = React.useState(false)

  // Người dùng chủ động mở bảng chạm trực quan Zero-Typing (khi không thuộc ký hiệu hoặc muốn chọn lại)
  const [forceShowFallback, setForceShowFallback] = React.useState(false)

  const syncMergedClauses = React.useCallback(
    (
      nextClauses: Array<{
        translation: string
        glosses: string[]
        confidence: number
      }>,
    ) => {
      setCapturedClauses(nextClauses)
      if (nextClauses.length === 0) {
        setGlosses([])
        setTranslation("")
        setConfidence(0)
        setFrame(null)
        return
      }
      const formatClause = (txt: string) => {
        const cleaned = txt.trim().replace(/\s+([.?!,])/g, "$1")
        if (!cleaned) return ""
        return /[.?!]$/.test(cleaned) ? cleaned : `${cleaned}.`
      }
      const mergedText = nextClauses
        .map((c) => formatClause(c.translation))
        .filter(Boolean)
        .join(" ")
      const mergedGlosses = nextClauses.flatMap((c) => c.glosses)
      const avgConf =
        nextClauses.reduce((acc, c) => acc + c.confidence, 0) /
        nextClauses.length

      setGlosses(mergedGlosses)
      setTranslation(mergedText)
      setConfidence(Number(avgConf.toFixed(3)))
      parseMutation.mutate(
        { gloss_sequence: mergedGlosses, translation: mergedText },
        {
          onSuccess: (parsed) => {
            setFrame(parsed)
          },
        },
      )
    },
    [parseMutation],
  )

  React.useEffect(() => {
    if (activeTicket) {
      sessionStorage.setItem("vsl_active_ticket", activeTicket)
    }
  }, [activeTicket])

  const loadSampleKeypointsAndInfer = React.useCallback(
    (sampleId: string, showToast = false) => {
      sampleKeypointsMutation.mutate(sampleId, {
        onSuccess: (data) => {
          setIsManuallyEdited(false)
          setSamplePlaybackData(data)
          const rec = data.recognition
          const recognized = rec.is_recognized !== false
          setIsRecognized(recognized)
          setRecognitionStatus(rec.recognition_status ?? "recognized")
          setFallbackMessage(rec.fallback_message ?? null)
          setGlosses(rec.gloss_sequence)
          setTranslation(rec.translation)
          setConfidence(rec.confidence)
          setFrame(rec.semantic_frame)
          setIsAppendingClause(false)
          setCapturedClauses(
            recognized && rec.translation
              ? [
                  {
                    translation: rec.translation,
                    glosses: rec.gloss_sequence,
                    confidence: rec.confidence,
                  },
                ]
              : [],
          )
          setForceShowFallback(false)
          if (showToast) {
            pushToast({
              title: `Đang phát mẫu ${data.video_id}`,
              description: `SLTModel suy luận: "${rec.translation}" (${(rec.confidence * 100).toFixed(1)}%)`,
              tone: "success",
            })
          }
        },
      })
    },
    [pushToast, sampleKeypointsMutation],
  )

  // Phương thức 1 không nhận diện được (Out-of-vocabulary hoặc dưới ngưỡng an toàn) ➔ Kích hoạt 5 Phương án dự phòng
  const handleSimulateUnknownSign = () => {
    setIsManuallyEdited(false)
    setActiveTicket(null)
    setIsRecognized(false)
    setRecognitionStatus("out_of_vocabulary")
    setForceShowFallback(true) // Kích hoạt 5 Phương án dự phòng
    const msg =
      "Phương thức 1 (Ký hiệu) chưa nhận diện chắc chắn cử chỉ vừa rồi. Hệ thống đã kích hoạt 5 Phương án dự phòng để đảm bảo an toàn."
    setFallbackMessage(msg)
    setGlosses([])
    setTranslation("")
    setConfidence(0.34)
    setCapturedClauses([])
    setIsAppendingClause(false)
    setFrame({
      intent: "general",
      specialty: "Bàn Tiếp Nhận & Hỗ Trợ",
      visit_reason: "Ký hiệu ngoài bộ từ điển — Sử dụng 5 phương án dự phòng",
      symptoms: [],
      body_location: null,
      onset: null,
      severity: null,
      allergy_status: "not_confirmed",
      medication_status: "unknown",
      needs_human_review: true,
      review_reasons: [msg],
      summary_for_clinician:
        "Phương thức 1 không nhận diện được ký hiệu. Bệnh nhân đang sử dụng Bảng chạm trực quan Zero-Typing (Sơ đồ cơ thể / Biểu tượng triệu chứng / Câu chạm sẵn).",
      patient_confirmation_text:
        "Hệ thống chưa nhận diện được ký hiệu vừa rồi. Vui lòng chạm chọn trên bảng trực quan bên dưới (không cần gõ chữ).",
      suggested_action: "Sử dụng Sơ đồ cơ thể, Câu giao tiếp có sẵn, Nhập chữ hoặc Gọi nhân viên hỗ trợ",
      doctor_quick_responses: [
        "Mời bạn chỉ vào vị trí đau trên sơ đồ cơ thể",
        "Nhân viên y tế đang ra hỗ trợ trực tiếp",
      ],
    })
    pushToast({
      title: "Kích hoạt 5 Phương Án Dự Phòng",
      description: "Phương thức 1 không nhận diện được. Mời chọn Sơ đồ cơ thể (PA 2) hoặc Câu có sẵn (PA 3).",
      tone: "destructive",
    })
  }

  const handleUploadVideo = (file: File) => {
    setActiveVideoName(file.name)
    setIsManuallyEdited(false)
    setActiveTicket(null)

    recognizeMutation.mutate(file, {
      onSuccess: (res) => {
        const recognized = res.is_recognized !== false
        setIsRecognized(recognized)
        setRecognitionStatus(
          res.recognition_status ?? (recognized ? "recognized" : "low_confidence"),
        )
        setFallbackMessage(res.fallback_message ?? null)

        const newClause = {
          translation: res.translation,
          glosses: res.gloss_sequence,
          confidence: res.confidence,
        }

        if (recognized && isAppendingClause && capturedClauses.length > 0) {
          setIsAppendingClause(false)
          syncMergedClauses([...capturedClauses, newClause])
        } else {
          setIsAppendingClause(false)
          if (recognized && res.translation) {
            setCapturedClauses([newClause])
          } else if (!isAppendingClause) {
            setCapturedClauses([])
          }
          setGlosses(res.gloss_sequence)
          setTranslation(res.translation)
          setConfidence(res.confidence)
          setFrame(res.semantic_frame)
        }

        // Tự động phát lại khung xương chuyển động của chính video người dùng vừa gửi
        if (res.extracted_frames && res.extracted_frames.length > 0) {
          setSamplePlaybackData({
            video_id: file.name,
            sentence_id: "USER_INPUT",
            num_frames: res.extracted_frames.length,
            fps: 25,
            ground_truth_glosses: res.gloss_sequence,
            ground_truth_translation: res.translation,
            gloss_frame_boundaries: [],
            frames: res.extracted_frames,
            recognition: res,
          })
        }

        if (recognized) {
          setForceShowFallback(false)
          const diag = res.diagnostics
          pushToast({
            title: "Phương thức 1: Nhận diện thành công",
            description: `Câu dịch: "${res.translation}" (${(res.confidence * 100).toFixed(0)}%)${diag ? ` • Bắt dính 2 tay: ${diag.hand_ratio}%` : ""}`,
            tone: "success",
          })
        } else {
          // Khi nhận diện thất bại ➔ Tự động mở 5 phương án dự phòng
          setForceShowFallback(true)
          const diag = res.diagnostics
          pushToast({
            title: "Phương thức 1 chưa nhận diện được",
            description: diag
              ? `Thu nhận ${diag.num_frames} frames (${diag.duration_seconds}s). Bắt dính tay: ${diag.hand_ratio}%. Bạn có thể xem lại khung xương cử chỉ trên màn hình.`
              : "Hệ thống đã kích hoạt 5 phương án dự phòng an toàn bên cạnh.",
            tone: "destructive",
          })
        }
      },
      onError: () => {
        setForceShowFallback(true)
        pushToast({
          title: "Không thể phân tích video",
          description: "Đã mở 5 phương án dự phòng để bạn tiếp tục khai báo.",
          tone: "destructive",
        })
      },
    })
  }

  const handleConfirm = () => {
    if (!frame || !translation) return
    confirmMutation.mutate(
      {
        patient_name: "Bệnh nhân VSL",
        status: isManuallyEdited ? "edited" : "confirmed",
        confirmed_text: translation,
        gloss_sequence: glosses,
        confidence,
        semantic_frame: frame,
      },
      {
        onSuccess: (res) => {
          setActiveTicket(res.ticket_number)
          pushToast({
            title: `Đã cấp số thứ tự ${res.ticket_number}`,
            description: "Hồ sơ của bạn đã được chuyển tới Bàn Tiếp Nhận.",
            tone: "success",
          })
        },
      },
    )
  }

  // Khi bệnh nhân dùng PA 2 (Sơ đồ cơ thể), PA 3 (Câu có sẵn) hoặc PA 4 (Nhập chữ)
  const handleApplyFallbackText = (newText: string, glossLabel: string) => {
    parseMutation.mutate(
      { translation: newText },
      {
        onSuccess: (parsed) => {
          setIsManuallyEdited(true)
          setIsRecognized(true)
          setRecognitionStatus("recognized")
          setFallbackMessage(null)
          setGlosses([glossLabel])
          setTranslation(newText)
          setConfidence(1.0)
          setFrame(parsed)
          setForceShowFallback(false) // Trở về màn hình xác nhận sẵn sàng gửi
          pushToast({
            title: "Đã áp dụng nội dung dự phòng thành công",
            description: `Nội dung: "${newText}" — Bấm [ĐÚNG, GỬI BÀN TIẾP NHẬN] để lấy số khám.`,
            tone: "success",
          })
        },
      },
    )
  }

  // Phương án 5: Yêu cầu người hỗ trợ trực tiếp
  const handleRequestHumanHelp = () => {
    const helpFrame: SemanticFrame = frame ?? {
      intent: "general",
      specialty: "Quầy Hỗ Trợ & Phiên Dịch VSL",
      visit_reason: "Bệnh nhân khiếm thính yêu cầu nhân viên / phiên dịch viên hỗ trợ trực tiếp",
      symptoms: [],
      body_location: null,
      onset: null,
      severity: null,
      allergy_status: "not_confirmed",
      medication_status: "unknown",
      needs_human_review: true,
      review_reasons: ["Bệnh nhân bấm nút Gọi người hỗ trợ trực tiếp tại Kiosk (PA 5)"],
      summary_for_clinician:
        "Bệnh nhân cần nhân viên y tế hoặc phiên dịch viên ngôn ngữ ký hiệu hỗ trợ trực tiếp tại Kiosk.",
      patient_confirmation_text: "Đã gửi yêu cầu gọi người hỗ trợ.",
      suggested_action: "Điều dưỡng / Phiên dịch viên ra hỗ trợ trực tiếp tại Kiosk",
      doctor_quick_responses: [
        "Nhân viên hỗ trợ đang ra quầy Kiosk ngay",
        "Mời bạn ngồi chờ tại ghế ưu tiên số 1",
      ],
    }

    confirmMutation.mutate(
      {
        patient_name: "Bệnh nhân VSL (Cần hỗ trợ)",
        status: "need_help",
        confirmed_text:
          translation || "Tôi cần nhân viên y tế hoặc phiên dịch viên hỗ trợ trực tiếp.",
        gloss_sequence: glosses.length > 0 ? glosses : ["YÊU-CẦU-HỖ-TRỢ"],
        confidence,
        semantic_frame: helpFrame,
      },
      {
        onSuccess: (res) => {
          setActiveTicket(res.ticket_number)
          pushToast({
            title: `Đã gọi hỗ trợ — Mã phiếu ${res.ticket_number}`,
            description:
              "Yêu cầu đã chuyển tới Bàn Tiếp Nhận. Nhân viên y tế / Phiên dịch viên sẽ tới hỗ trợ bạn ngay.",
            tone: "success",
          })
        },
      },
    )
  }

  const handleAcknowledge = (
    action: "understood" | "yes" | "no" | "need_help",
    note?: string,
  ) => {
    if (!activeTicket) return
    ackMutation.mutate(
      { ticketNumber: activeTicket, action, note },
      {
        onSuccess: () => {
          pushToast({
            title: "Đã phản hồi thành công",
            description: "Bàn Tiếp Nhận đã nhận được xác nhận của bạn.",
            tone: "success",
          })
        },
      },
    )
  }

  const handleResetKiosk = () => {
    setActiveTicket(null)
    setIsManuallyEdited(false)
    setSamplePlaybackData(null)
    setGlosses([])
    setTranslation("")
    setConfidence(0)
    setFrame(null)
    setCapturedClauses([])
    setIsAppendingClause(false)
    setIsRecognized(true)
    setRecognitionStatus("recognized")
    setFallbackMessage(null)
    setForceShowFallback(false)
    sessionStorage.removeItem("vsl_active_ticket")
    pushToast({
      title: "Sẵn sàng đón lượt khám mới",
      description: "Màn hình Kiosk đã trở về chế độ Khai báo ban đầu.",
    })
  }

  const activeCase = React.useMemo(
    () =>
      activeTicket
        ? queueQuery.data?.cases.find((c) => c.ticket_number === activeTicket) ??
          null
        : null,
    [activeTicket, queueQuery.data?.cases],
  )

  const doctorReply =
    activeCase?.doctor_reply ??
    (activeTicket ? queueQuery.data?.doctor_replies?.[activeTicket] : undefined) ??
    null

  const handleSendDialogueMessage = (payload: {
    text: string
    source: "vsl" | "body_map" | "quick_reply" | "text"
    gloss_sequence?: string[]
  }) => {
    if (!activeTicket) return
    sendPatientMsgMutation.mutate(
      { ticketNumber: activeTicket, ...payload },
      {
        onSuccess: () => {
          pushToast({
            title: "Đã gửi phản hồi",
            description: "Bàn Tiếp Nhận đã nhận được câu trả lời của bạn.",
            tone: "success",
          })
        },
      },
    )
  }

  // Điều kiện kích hoạt 5 Phương án dự phòng: CHỈ KHI phương thức 1 không được HOẶC người bệnh bấm mở
  const showFallbackOptions = !isRecognized || forceShowFallback

  return (
    <div className="flex w-full flex-col gap-6">
      {/* 
        =========================================================================
        TRẠNG THÁI 1: BÀN KHAI BÁO LIỀN MẠCH (KHI CHƯA CÓ VÉ activeTicket === null)
        Phương thức 1 (Ký hiệu) là trung tâm. Chỉ khi nào không được mới mở 5 PA dự phòng!
        ========================================================================= 
      */}
      {!activeTicket && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            {/* Cột trái: Phương thức 1 — Camera & Ký hiệu VSL */}
            <div className="flex flex-col gap-4 lg:col-span-7">
              <CameraStage
                isAnalyzing={recognizeMutation.isPending}
                activeVideoName={activeVideoName}
                samplePlaybackData={samplePlaybackData}
                isLoadingSample={sampleKeypointsMutation.isPending}
                onUploadVideo={handleUploadVideo}
                onCameraActivated={() => {}}
                onSimulateUnknownSign={handleSimulateUnknownSign}
              />

              {/* Lối chuyển nhanh khi người dùng không muốn ký hiệu */}
              {!showFallbackOptions && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/30 px-5 py-3.5 text-sm text-muted-foreground">
                  <span>
                    💡 <strong>Phương thức 1:</strong> Đứng chính diện camera và làm ký hiệu hoặc tải video lên.
                  </span>
                  <button
                    type="button"
                    onClick={() => setForceShowFallback(true)}
                    className="cursor-pointer font-semibold text-primary underline underline-offset-4 hover:text-primary/80"
                  >
                    Không thuộc ký hiệu? Mở Bảng Chạm Trực Quan ➔
                  </button>
                </div>
              )}
            </div>

            {/* Cột phải: Kết quả nhận diện HOẶC Bảng Chạm Trực Quan Zero-Typing */}
            <div className="flex flex-col gap-4 lg:col-span-5">
              {/* NẾU PHƯƠNG THỨC 1 KHÔNG ĐƯỢC ➔ HIỂN THỊ BẢNG CHẠM ZERO-TYPING TẠI ĐÂY */}
              {showFallbackOptions ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-warning">
                      Chế Độ Chạm Trực Quan (Không Cần Gõ Chữ)
                    </span>
                    <button
                      type="button"
                      onClick={() => setForceShowFallback(false)}
                      className="text-xs text-muted-foreground underline hover:text-foreground"
                    >
                      Quay lại Phương thức 1 (Ký hiệu)
                    </button>
                  </div>

                  <FallbackAssistantPanel
                    isRecognized={isRecognized}
                    recognitionStatus={recognitionStatus}
                    fallbackMessage={fallbackMessage}
                    onRetryCamera={() => {
                      setForceShowFallback(false)
                      pushToast({
                        title: "Phương án 1: Thực hiện lại",
                        description: "Hãy đưa 2 bàn tay vào giữa khung hình và làm lại chậm hơn.",
                      })
                    }}
                    onPlaySampleGuide={() =>
                      loadSampleKeypointsAndInfer("SENT001", true)
                    }
                    onApplyFallbackText={handleApplyFallbackText}
                    onRequestHumanInterpreter={handleRequestHumanHelp}
                  />
                </div>
              ) : (
                /* KHI PHƯƠNG THỨC 1 HOẠT ĐỘNG BÌNH THƯỜNG */
                <div className="flex flex-col gap-4">
                  <RecognitionPanel
                    glosses={glosses}
                    translation={translation}
                    confidence={confidence}
                    isPending={
                      parseMutation.isPending ||
                      recognizeMutation.isPending ||
                      sampleKeypointsMutation.isPending
                    }
                    isRecognized={isRecognized}
                    recognitionStatus={recognitionStatus}
                    fallbackMessage={fallbackMessage}
                  />

                  {capturedClauses.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 px-3.5 py-2.5">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Các ý đã ghép ({capturedClauses.length}):
                      </span>
                      {capturedClauses.map((clause, idx) => (
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
                              syncMergedClauses(
                                capturedClauses.filter((_, i) => i !== idx),
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

                  {translation && (
                    <ConfirmationBanner
                      frame={frame}
                      translation={translation}
                      isSending={confirmMutation.isPending}
                      activeTicket={activeTicket}
                      doctorReply={doctorReply}
                      onConfirm={handleConfirm}
                      onOpenEdit={() => setForceShowFallback(true)}
                      isAppendingClause={isAppendingClause}
                      onAppendCameraClause={() => {
                        setIsAppendingClause((prev) => {
                          const next = !prev
                          if (next) {
                            pushToast({
                              title: "Chế độ quay nối tiếp",
                              description:
                                "Hãy quay hoặc tải thêm video câu tiếp theo bên trái — hệ thống sẽ tự ghép vào cùng hồ sơ.",
                            })
                          }
                          return next
                        })
                      }}
                      onRequestHumanHelp={handleRequestHumanHelp}
                      onAcknowledge={handleAcknowledge}
                      isAcking={ackMutation.isPending}
                    />
                  )}

                  {!translation && (
                    <Card className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground border-dashed">
                      <Video className="size-10 mb-3 opacity-50" />
                      <p className="text-base font-semibold text-foreground">Chờ kết quả ký hiệu</p>
                      <p className="text-sm mt-1.5 max-w-md leading-relaxed">
                        Bấm <strong>[Bật Camera Tập Ký Hiệu]</strong> hoặc tải lên video ký hiệu để bắt đầu khai báo triệu chứng.
                      </p>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 
        =========================================================================
        TRẠNG THÁI 2: PHIÊN ĐỐI THOẠI 2 CHIỀU TRỰC TIẾP (activeTicket !== null)
        Hỗ trợ hỏi đáp nhiều lượt: 1 chạm, Camera VSL, Sơ đồ cơ thể & VSL mẫu.
        ========================================================================= 
      */}
      {activeTicket && (
        <DialogueSession
          ticketNumber={activeTicket}
          messages={activeCase?.messages ?? []}
          doctorReply={doctorReply}
          isAcking={ackMutation.isPending}
          isSendingMessage={sendPatientMsgMutation.isPending}
          isAnalyzingVideo={recognizeMutation.isPending}
          onAcknowledge={handleAcknowledge}
          onSendPatientMessage={handleSendDialogueMessage}
          onRecognizeVideo={(file) => recognizeMutation.mutateAsync(file)}
          onResetKiosk={handleResetKiosk}
        />
      )}
    </div>
  )
}
