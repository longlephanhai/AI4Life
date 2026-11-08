import * as React from "react"
import {
  RotateCcw,
  Ticket,
  Video,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CameraStage } from "@/components/kiosk/camera-stage"
import { ConfirmationBanner } from "@/components/kiosk/confirmation-banner"
import { EditTranslationDialog } from "@/components/kiosk/edit-translation-dialog"
import { FallbackAssistantPanel } from "@/components/kiosk/fallback-assistant-panel"
import { RecognitionPanel } from "@/components/kiosk/recognition-panel"
import { ScenarioPicker } from "@/components/kiosk/scenario-picker"
import { useToast } from "@/components/ui/toast"
import {
  useAcknowledgeDoctorReply,
  useConfirmCase,
  useParseSemantic,
  useQueue,
  useRecognizeVideo,
  useSampleKeypoints,
  useScenarios,
} from "@/hooks/use-signbridge"
import type {
  RecognitionStatus,
  SampleKeypointsResponse,
  SampleScenario,
  SemanticFrame,
} from "@/lib/types"

export function KioskWorkspace() {
  const { pushToast } = useToast()
  const scenariosQuery = useScenarios()
  const queueQuery = useQueue()
  const parseMutation = useParseSemantic()
  const recognizeMutation = useRecognizeVideo()
  const sampleKeypointsMutation = useSampleKeypoints()
  const confirmMutation = useConfirmCase()
  const ackMutation = useAcknowledgeDoctorReply()

  const [activeScenarioId, setActiveScenarioId] = React.useState<string | null>(null)
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
  const [isEditOpen, setIsEditOpen] = React.useState(false)

  // Người dùng chủ động mở bảng 5 phương án dự phòng (khi không thuộc ký hiệu hoặc muốn bổ sung)
  const [forceShowFallback, setForceShowFallback] = React.useState(false)

  React.useEffect(() => {
    if (activeTicket) {
      sessionStorage.setItem("vsl_active_ticket", activeTicket)
    }
  }, [activeTicket])

  const loadSampleKeypointsAndInfer = React.useCallback(
    (sampleId: string, showToast = false) => {
      sampleKeypointsMutation.mutate(sampleId, {
        onSuccess: (data) => {
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

  const applyScenario = (scenario: SampleScenario) => {
    setActiveScenarioId(scenario.id)
    setActiveTicket(null)
    loadSampleKeypointsAndInfer(scenario.id, true)
  }

  const handleTriggerEmergency = () => {
    applyScenario({
      id: "SENT115",
      category: "Cấp cứu đỏ",
      title: "Cảnh báo cấp cứu: Cảm thấy khó thở",
      glosses: ["TÔI", "CẢM-THẤY", "THỞ-KHÓ"],
      translation: "Tôi cảm thấy khó thở.",
      description: "Kích hoạt cảnh báo đỏ ưu tiên tuyệt đối.",
    })
    pushToast({
      title: "Đã kích hoạt chế độ Cấp Cứu Khẩn Cấp",
      description: "Nhấn [ĐÚNG, GỬI BÀN TIẾP NHẬN] để chuyển ngay lên đầu hàng đợi cấp cứu.",
      tone: "destructive",
    })
  }

  // Phương thức 1 không nhận diện được (Out-of-vocabulary hoặc dưới ngưỡng an toàn) ➔ Kích hoạt 5 Phương án dự phòng
  const handleSimulateUnknownSign = () => {
    setActiveScenarioId(null)
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
        "Phương thức 1 không nhận diện được ký hiệu. Bệnh nhân đang sử dụng 5 phương án dự phòng (Sơ đồ cơ thể / Câu giao tiếp sẵn / Nhập chữ TTS).",
      patient_confirmation_text:
        "Hệ thống chưa nhận diện được ký hiệu vừa rồi. Vui lòng chọn 1 trong 5 phương án dự phòng bên dưới.",
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
    setActiveScenarioId(null)
    setActiveTicket(null)

    recognizeMutation.mutate(file, {
      onSuccess: (res) => {
        const recognized = res.is_recognized !== false
        setIsRecognized(recognized)
        setRecognitionStatus(
          res.recognition_status ?? (recognized ? "recognized" : "low_confidence"),
        )
        setFallbackMessage(res.fallback_message ?? null)
        setGlosses(res.gloss_sequence)
        setTranslation(res.translation)
        setConfidence(res.confidence)
        setFrame(res.semantic_frame)

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
        status: activeScenarioId === "EDITED" ? "edited" : "confirmed",
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
          setActiveScenarioId("EDITED")
          setIsRecognized(true)
          setRecognitionStatus("recognized")
          setFallbackMessage(null)
          setGlosses([glossLabel])
          setTranslation(newText)
          setConfidence(1.0)
          setFrame(parsed)
          setIsEditOpen(false)
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
    setActiveScenarioId(null)
    setSamplePlaybackData(null)
    setGlosses([])
    setTranslation("")
    setConfidence(0)
    setFrame(null)
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

  const doctorReply =
    (activeTicket && queueQuery.data?.doctor_replies?.[activeTicket]) || null

  // Điều kiện kích hoạt 5 Phương án dự phòng: CHỈ KHI phương thức 1 không được HOẶC người bệnh bấm mở
  const showFallbackOptions = !isRecognized || forceShowFallback

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* 
        =========================================================================
        TRẠNG THÁI 1: BÀN KHAI BÁO LIỀN MẠCH (KHI CHƯA CÓ VÉ activeTicket === null)
        Phương thức 1 (Ký hiệu) là trung tâm. Chỉ khi nào không được mới mở 5 PA dự phòng!
        ========================================================================= 
      */}
      {!activeTicket && (
        <div className="flex flex-col gap-6">
          <ScenarioPicker
            scenarios={scenariosQuery.data ?? []}
            activeScenarioId={activeScenarioId}
            onSelectScenario={applyScenario}
            onTriggerEmergency={handleTriggerEmergency}
            isLoading={scenariosQuery.isLoading}
          />

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
                onPlaySample={() =>
                  loadSampleKeypointsAndInfer(activeScenarioId ?? "SENT001", true)
                }
                onSimulateUnknownSign={handleSimulateUnknownSign}
              />

              {/* Lối chuyển nhanh khi người dùng không muốn ký hiệu */}
              {!showFallbackOptions && (
                <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
                  <span>
                    💡 <strong>Phương thức 1:</strong> Đứng chính diện camera và làm ký hiệu (hoặc chọn mẫu ở trên).
                  </span>
                  <button
                    type="button"
                    onClick={() => setForceShowFallback(true)}
                    className="font-semibold text-primary underline underline-offset-4 hover:text-primary/80 ml-2"
                  >
                    Gặp khó khăn? Mở 5 Phương Án Dự Phòng ➔
                  </button>
                </div>
              )}
            </div>

            {/* Cột phải: Kết quả nhận diện HOẶC 5 Phương Án Dự Phòng */}
            <div className="flex flex-col gap-4 lg:col-span-5">
              {/* NẾU PHƯƠNG THỨC 1 KHÔNG ĐƯỢC ➔ HIỂN THỊ 5 PHƯƠNG ÁN DỰ PHÒNG TẠI ĐÂY */}
              {showFallbackOptions ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-warning">
                      ⚠️ Kích hoạt 5 Phương Án Dự Phòng
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
                      loadSampleKeypointsAndInfer(activeScenarioId ?? "SENT001", true)
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
                    frame={frame}
                    isPending={
                      parseMutation.isPending ||
                      recognizeMutation.isPending ||
                      sampleKeypointsMutation.isPending
                    }
                    isRecognized={isRecognized}
                    recognitionStatus={recognitionStatus}
                    fallbackMessage={fallbackMessage}
                  />

                  {translation && (
                    <ConfirmationBanner
                      frame={frame}
                      translation={translation}
                      isSending={confirmMutation.isPending}
                      activeTicket={activeTicket}
                      doctorReply={doctorReply}
                      onConfirm={handleConfirm}
                      onOpenEdit={() => setIsEditOpen(true)}
                      onRequestHumanHelp={handleRequestHumanHelp}
                      onAcknowledge={handleAcknowledge}
                      isAcking={ackMutation.isPending}
                    />
                  )}

                  {!translation && (
                    <Card className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground border-dashed">
                      <Video className="size-8 mb-2 opacity-50" />
                      <p className="text-sm font-semibold">Chờ kết quả ký hiệu</p>
                      <p className="text-xs mt-1 max-w-xs">
                        Bấm [Bật Camera Tập Ký Hiệu] hoặc chọn một kịch bản mẫu phía trên để bắt đầu.
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
        TRẠNG THÁI 2: PHIẾU KHÁM & ĐỐI THOẠI 2 CHIỀU VỚI BÁC SĨ (activeTicket !== null)
        Sau khi đã gửi: Toàn bộ camera và bàn khai báo ẩn đi hoàn toàn!
        Chỉ tập trung vào Vé số khám & Hộp thoại dặn dò thông minh.
        ========================================================================= 
      */}
      {activeTicket && (
        <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full py-6">
          <Card className="flex flex-col items-center justify-center text-center p-8 border-2 border-success/40 bg-success/10 shadow-md">
            <div className="flex size-20 items-center justify-center rounded-3xl bg-success text-success-foreground shadow-lg mb-4">
              <Ticket className="size-10" />
            </div>

            <Badge variant="success" className="text-sm px-3 py-1 font-bold">
              ĐÃ GỬI THÀNH CÔNG VÀO HÀNG ĐỢI
            </Badge>

            <p className="text-muted-foreground text-sm mt-3">
              Số Thứ Tự Khám Của Bạn:
            </p>
            <h1 className="font-display text-6xl font-extrabold tracking-tight text-foreground my-2 tabular-nums">
              {activeTicket}
            </h1>

            <p className="text-xs text-muted-foreground max-w-md mt-1">
              Hồ sơ triệu chứng của bạn đã được chuyển tới Bàn Tiếp Nhận. Mời bạn quan sát các hướng dẫn/câu hỏi từ nhân viên y tế bên dưới.
            </p>
          </Card>

          {/* Hộp thoại thông minh: Nhận câu hỏi và hiển thị các nút trả lời chính xác */}
          <ConfirmationBanner
            frame={frame}
            translation={translation}
            isSending={confirmMutation.isPending}
            activeTicket={activeTicket}
            doctorReply={doctorReply}
            onConfirm={handleConfirm}
            onOpenEdit={() => setIsEditOpen(true)}
            onRequestHumanHelp={handleRequestHumanHelp}
            onAcknowledge={handleAcknowledge}
            isAcking={ackMutation.isPending}
          />

          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="lg"
              onClick={handleResetKiosk}
              className="gap-2 font-semibold text-sm"
            >
              <RotateCcw className="size-4" />
              Hoàn tất / Đón lượt thăm khám tiếp theo
            </Button>
          </div>
        </div>
      )}

      <EditTranslationDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        initialText={translation}
        isSaving={parseMutation.isPending}
        onSave={(txt) => handleApplyFallbackText(txt, "CHỈNH-SỬA-TAY")}
      />
    </div>
  )
}
