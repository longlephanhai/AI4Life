import * as React from "react"
import { CameraStage } from "@/components/kiosk/camera-stage"
import { ConfirmationBanner } from "@/components/kiosk/confirmation-banner"
import { EditTranslationDialog } from "@/components/kiosk/edit-translation-dialog"
import { RecognitionPanel } from "@/components/kiosk/recognition-panel"
import { ScenarioPicker } from "@/components/kiosk/scenario-picker"
import { useToast } from "@/components/ui/toast"
import {
  useConfirmCase,
  useParseSemantic,
  useQueue,
  useRecognizeVideo,
  useScenarios,
} from "@/hooks/use-signbridge"
import type { RecognitionStatus, SampleScenario, SemanticFrame } from "@/lib/types"

export function KioskWorkspace() {
  const { pushToast } = useToast()
  const scenariosQuery = useScenarios()
  const queueQuery = useQueue()
  const parseMutation = useParseSemantic()
  const recognizeMutation = useRecognizeVideo()
  const confirmMutation = useConfirmCase()

  const [activeScenarioId, setActiveScenarioId] = React.useState<string | null>("SENT001")
  const [glosses, setGlosses] = React.useState<string[]>([
    "TÔI",
    "ĐĂNG-KÝ",
    "KHÁM",
    "SỨC-KHỎE",
    "MUỐN",
  ])
  const [translation, setTranslation] = React.useState<string>(
    "Tôi muốn đăng ký khám sức khỏe.",
  )
  const [confidence, setConfidence] = React.useState<number>(0.965)
  const [isRecognized, setIsRecognized] = React.useState<boolean>(true)
  const [recognitionStatus, setRecognitionStatus] =
    React.useState<RecognitionStatus>("recognized")
  const [fallbackMessage, setFallbackMessage] = React.useState<string | null>(null)
  const [frame, setFrame] = React.useState<SemanticFrame | null>(null)
  const [activeVideoName, setActiveVideoName] = React.useState<string | null>(null)
  const [activeTicket, setActiveTicket] = React.useState<string | null>(() => {
    return typeof window !== "undefined"
      ? sessionStorage.getItem("vsl_active_ticket")
      : null
  })
  const [isEditOpen, setIsEditOpen] = React.useState(false)

  React.useEffect(() => {
    if (activeTicket) {
      sessionStorage.setItem("vsl_active_ticket", activeTicket)
    }
  }, [activeTicket])

  // Load default scenario on mount
  React.useEffect(() => {
    parseMutation.mutate(
      {
        gloss_sequence: ["TÔI", "ĐĂNG-KÝ", "KHÁM", "SỨC-KHỎE", "MUỐN"],
        translation: "Tôi muốn đăng ký khám sức khỏe.",
      },
      {
        onSuccess: (res) => setFrame(res),
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyScenario = (scenario: SampleScenario) => {
    setActiveScenarioId(scenario.id)
    setActiveTicket(null)
    setIsRecognized(true)
    setRecognitionStatus("recognized")
    setFallbackMessage(null)
    setGlosses(scenario.glosses)
    setTranslation(scenario.translation)
    setConfidence(scenario.id === "EMERGENCY" ? 0.99 : 0.965)

    parseMutation.mutate(
      {
        gloss_sequence: scenario.glosses,
        translation: scenario.translation,
      },
      {
        onSuccess: (parsed) => setFrame(parsed),
      },
    )
  }

  const handleTriggerEmergency = () => {
    applyScenario({
      id: "EMERGENCY",
      category: "Cấp cứu đỏ",
      title: "Cảnh báo cấp cứu: Đau ngực, khó thở",
      glosses: ["TÔI", "NGỰC-ĐAU", "KHÓ-THỞ"],
      translation: "Tôi bị đau tức ngực và rất khó thở.",
      description: "Kích hoạt cảnh báo đỏ ưu tiên tuyệt đối.",
    })
    pushToast({
      title: "Đã kích hoạt chế độ Cấp Cứu Khẩn Cấp",
      description: "Nhấn [ĐÚNG, GỬI BÀN TIẾP NHẬN] để chuyển ngay lên đầu hàng đợi cấp cứu.",
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
        setRecognitionStatus(res.recognition_status ?? (recognized ? "recognized" : "low_confidence"))
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
              "Để đảm bảo an toàn y tế, hệ thống không đoán mò. Vui lòng thử lại hoặc chọn công cụ hỗ trợ.",
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

  const handleSaveEditedText = (newText: string) => {
    parseMutation.mutate(
      { translation: newText },
      {
        onSuccess: (parsed) => {
          setActiveScenarioId("EDITED")
          setIsRecognized(true)
          setRecognitionStatus("recognized")
          setFallbackMessage(null)
          setGlosses(["CHỈNH-SỬA-TAY"])
          setTranslation(newText)
          setConfidence(1.0)
          setFrame(parsed)
          setIsEditOpen(false)
          pushToast({
            title: "Đã cập nhật nội dung",
            description: "Hệ thống đã phân tích lại chuyên khoa phù hợp.",
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
        <div className="lg:col-span-7">
          <CameraStage
            isAnalyzing={recognizeMutation.isPending}
            activeVideoName={activeVideoName}
            onUploadVideo={handleUploadVideo}
            onCameraActivated={() => {
              if (!frame && scenariosQuery.data?.[0]) {
                applyScenario(scenariosQuery.data[0])
              }
            }}
          />
        </div>

        <div className="flex flex-col gap-6 lg:col-span-5">
          <RecognitionPanel
            glosses={glosses}
            translation={translation}
            confidence={confidence}
            frame={frame}
            isPending={parseMutation.isPending || recognizeMutation.isPending}
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
            onRequestHumanHelp={() =>
              pushToast({
                title: "Đã gọi Phiên dịch viên y tế",
                description:
                  "Tín hiệu hỗ trợ đã gửi đến Điều dưỡng trực. Nhân viên sẽ tới hỗ trợ bạn ngay.",
              })
            }
          />
        </div>
      </div>

      <EditTranslationDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        initialText={translation}
        isSaving={parseMutation.isPending}
        onSave={handleSaveEditedText}
      />
    </div>
  )
}

