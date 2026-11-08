import * as React from "react"
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
    // Chạy suy luận thật từ file .npy của kịch bản này qua SLTModel
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

  const handleSimulateUnknownSign = () => {
    setActiveScenarioId(null)
    setActiveTicket(null)
    setIsRecognized(false)
    setRecognitionStatus("out_of_vocabulary")
    const msg =
      "Ký hiệu bệnh nhân vừa thực hiện chưa có trong bộ từ điển của AI (hoặc độ tin cậy dưới ngưỡng an toàn 72%). Hệ thống đã chặn đoán mò — vui lòng chọn 1 trong 5 phương án Fallback bên dưới."
    setFallbackMessage(msg)
    setGlosses([])
    setTranslation("")
    setConfidence(0.34)
    setFrame({
      intent: "general",
      specialty: "Bàn Tiếp Nhận & Hỗ Trợ",
      visit_reason: "Ký hiệu ngoài bộ từ điển — Cần hỗ trợ đa phương thức",
      symptoms: [],
      body_location: null,
      onset: null,
      severity: null,
      allergy_status: "not_confirmed",
      medication_status: "unknown",
      needs_human_review: true,
      review_reasons: [msg],
      summary_for_clinician:
        "Bệnh nhân thực hiện ký hiệu nằm ngoài bộ từ vựng AI đã học. Hệ thống đã kích hoạt bảng Fallback (Sơ đồ cơ thể / Câu giao tiếp có sẵn / Văn bản TTS).",
      patient_confirmation_text:
        "Hệ thống chưa nhận diện chắc chắn ký hiệu vừa rồi. Mời bạn chọn nội dung trên bảng hỗ trợ bên dưới.",
      suggested_action: "Sử dụng Sơ đồ cơ thể, Câu giao tiếp có sẵn, Nhập chữ hoặc Gọi nhân viên hỗ trợ",
      doctor_quick_responses: [
        "Mời bạn chỉ vào vị trí đau trên sơ đồ cơ thể",
        "Nhân viên y tế đang ra hỗ trợ trực tiếp",
      ],
    })
    pushToast({
      title: "Đã kích hoạt chế độ Chặn Đoán Bậy (Fallback)",
      description: "Hãy thử dùng Sơ đồ cơ thể (PA 2), Câu có sẵn (PA 3), Nhập chữ TTS (PA 4) hoặc Gọi hỗ trợ (PA 5) bên dưới.",
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

        if (recognized) {
          pushToast({
            title: "Đã nhận diện ký hiệu thành công",
            description: `Câu dịch: "${res.translation}" (${(res.confidence * 100).toFixed(0)}%)`,
            tone: "success",
          })
        } else {
          pushToast({
            title: "Chưa nhận diện chắc chắn ký hiệu",
            description:
              res.fallback_message ??
              "Để đảm bảo an toàn y tế, hệ thống không đoán mò. Vui lòng sử dụng bảng hỗ trợ bên dưới.",
            tone: "destructive",
          })
        }
      },
      onError: () => {
        pushToast({
          title: "Không thể phân tích video",
          description: "Vui lòng kiểm tra định dạng file MP4 hoặc thử lại.",
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
          pushToast({
            title: "Đã áp dụng nội dung từ bảng hỗ trợ Fallback",
            description: `Nội dung: "${newText}" — Hãy bấm [ĐÚNG, GỬI BÀN TIẾP NHẬN] để lấy số thứ tự.`,
            tone: "success",
          })
        },
      },
    )
  }

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
      review_reasons: ["Bệnh nhân bấm nút Gọi người hỗ trợ trực tiếp tại Kiosk"],
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

  const doctorReply =
    (activeTicket && queueQuery.data?.doctor_replies?.[activeTicket]) || null

  return (
    <div className="flex flex-col gap-6">
      <ScenarioPicker
        scenarios={scenariosQuery.data ?? []}
        activeScenarioId={activeScenarioId}
        onSelectScenario={applyScenario}
        onTriggerEmergency={handleTriggerEmergency}
        isLoading={scenariosQuery.isLoading}
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <CameraStage
            isAnalyzing={recognizeMutation.isPending}
            activeVideoName={activeVideoName}
            samplePlaybackData={samplePlaybackData}
            isLoadingSample={sampleKeypointsMutation.isPending}
            onUploadVideo={handleUploadVideo}
            onCameraActivated={() => {
              // Keep current state when camera activates
            }}
            onPlaySample={() =>
              loadSampleKeypointsAndInfer(activeScenarioId ?? "SENT001", true)
            }
            onSimulateUnknownSign={handleSimulateUnknownSign}
          />

          {/* Bảng 5 Phương Án Fallback Đa Phương Thức (Bước 2 & 3) */}
          <FallbackAssistantPanel
            isRecognized={isRecognized}
            recognitionStatus={recognitionStatus}
            fallbackMessage={fallbackMessage}
            onRetryCamera={() => {
              pushToast({
                title: "Sẵn sàng thực hiện lại",
                description:
                  "Hãy đứng chính diện camera, đưa 2 bàn tay vào vùng khung hình và bấm [Bắt Đầu Ký Hiệu].",
              })
            }}
            onPlaySampleGuide={() =>
              loadSampleKeypointsAndInfer(activeScenarioId ?? "SENT001", true)
            }
            onApplyFallbackText={handleApplyFallbackText}
            onRequestHumanInterpreter={handleRequestHumanHelp}
          />
        </div>

        <div className="flex flex-col gap-6 lg:col-span-5">
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
        </div>
      </div>

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
