import * as React from "react"
import {
  AlertCircle,
  Hand,
  Headphones,
  Keyboard,
  MessageSquarePlus,
  Play,
  RotateCcw,
  Sparkles,
  UserCheck,
  Volume2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  InteractiveBodyMap,
  BODY_REGIONS,
  type BodyRegion,
} from "./interactive-body-map"
import type { RecognitionStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

interface FallbackAssistantPanelProps {
  isRecognized: boolean
  recognitionStatus: RecognitionStatus
  fallbackMessage: string | null
  onRetryCamera: () => void
  onPlaySampleGuide: () => void
  onApplyFallbackText: (text: string, glossLabel: string) => void
  onRequestHumanInterpreter: () => void
}

type FallbackTab = "body_map" | "quick_phrases" | "text_input" | "retry_guide"

const PAIN_LEVELS = [
  { id: "mild", label: "Nhẹ (1–3)", suffix: "mức độ nhẹ" },
  { id: "moderate", label: "Vừa (4–6)", suffix: "mức độ vừa" },
  { id: "severe", label: "Nặng / Dữ dội (7–10)", suffix: "mức độ dữ dội" },
]

const ONSET_TIMES = [
  { id: "today", label: "Vừa mới xuất hiện", suffix: "vừa mới xuất hiện hôm nay" },
  { id: "yesterday", label: "Từ hôm qua", suffix: "từ hôm qua" },
  { id: "days", label: "Vài ngày nay", suffix: "vài ngày nay" },
  { id: "week", label: "Trên 1 tuần", suffix: "kéo dài hơn 1 tuần nay" },
]

const QUICK_PHRASES = [
  {
    text: "Tôi muốn mô tả triệu chứng khác ngoài từ điển ký hiệu.",
    tag: "Mô tả khác",
  },
  {
    text: "Tôi bị chóng mặt và mệt mỏi trong người.",
    tag: "Triệu chứng",
  },
  {
    text: "Tôi cần nhân viên y tế hỗ trợ trực tiếp.",
    tag: "Cần trợ giúp",
  },
  {
    text: "Tôi không hiểu câu hỏi, vui lòng viết ra màn hình giúp tôi.",
    tag: "Giao tiếp",
  },
  {
    text: "Tôi muốn giải thích thêm về bệnh sử và thuốc đang dùng.",
    tag: "Bệnh sử",
  },
  {
    text: "Tôi có tiền sử bị dị ứng thuốc kháng sinh.",
    tag: "Cảnh báo dị ứng",
  },
]

function speakVietnamese(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  try {
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = "vi-VN"
    utter.rate = 0.95
    window.speechSynthesis.speak(utter)
  } catch {
    // Ignore TTS errors on unsupported browsers
  }
}

export function FallbackAssistantPanel({
  isRecognized,
  fallbackMessage,
  onRetryCamera,
  onPlaySampleGuide,
  onApplyFallbackText,
  onRequestHumanInterpreter,
}: FallbackAssistantPanelProps) {
  const [activeTab, setActiveTab] = React.useState<FallbackTab>("body_map")
  const [selectedRegion, setSelectedRegion] = React.useState<BodyRegion>(BODY_REGIONS[0])
  const [selectedPain, setSelectedPain] = React.useState(PAIN_LEVELS[1])
  const [selectedOnset, setSelectedOnset] = React.useState(ONSET_TIMES[1])
  const [customText, setCustomText] = React.useState("")

  // Tự động chuyển về tab Sơ đồ cơ thể khi nhận diện thất bại
  React.useEffect(() => {
    if (!isRecognized) {
      setActiveTab("body_map")
    }
  }, [isRecognized])

  const composedBodySymptom = `${selectedRegion.phrase}, ${selectedPain.suffix}, ${selectedOnset.suffix}.`

  return (
    <Card
      className={cn(
        "flex flex-col gap-4 p-5 transition-all",
        !isRecognized
          ? "border-2 border-warning bg-warning/5 shadow-md"
          : "border bg-card",
      )}
    >
      {/* Header giải thích cơ chế Fallback */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
        <div className="flex items-start gap-2.5">
          <div
            className={cn(
              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
              !isRecognized
                ? "bg-warning text-warning-foreground"
                : "bg-primary/10 text-primary",
            )}
          >
            {!isRecognized ? (
              <AlertCircle className="size-4" />
            ) : (
              <Sparkles className="size-4" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">
                {!isRecognized
                  ? "Cơ Chế Fallback An Toàn — Hỗ Trợ Khi Chưa Nhận Diện Được Ký Hiệu"
                  : "Bảng Giao Tiếp Đa Phương Thức (Dự Phòng Khi Không Biết Ký Hiệu)"}
              </h3>
              {!isRecognized && (
                <Badge variant="destructive" className="text-[11px]">
                  Đã chặn AI đoán bậy
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {!isRecognized
                ? fallbackMessage ||
                  "Khi từ vựng chưa có trong tập dữ liệu AI hoặc video mờ, hãy chọn 1 trong 5 phương án an toàn dưới đây:"
                : "Nếu bạn không thuộc ký hiệu tay hoặc muốn khai báo triệu chứng ngoài bộ từ điển của AI:"}
            </p>
          </div>
        </div>

        {/* Phương án 5 luôn hiển thị nổi bật */}
        <Button
          size="sm"
          variant="outline"
          onClick={onRequestHumanInterpreter}
          className="border-primary/40 text-primary hover:bg-primary/10"
        >
          <Headphones className="size-3.5" />
          PA 5: Gọi Nhân Viên / Phiên Dịch Viên
        </Button>
      </div>

      {/* Thanh chọn 4 phương án tại chỗ */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setActiveTab("retry_guide")}
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors",
            activeTab === "retry_guide"
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background hover:bg-muted",
          )}
        >
          <RotateCcw className="size-3.5 shrink-0" />
          <span>PA 1: Thử lại / Xem mẫu</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("body_map")}
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors",
            activeTab === "body_map"
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background hover:bg-muted",
          )}
        >
          <Hand className="size-3.5 shrink-0" />
          <span>PA 2: Chọn bằng hình ảnh</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("quick_phrases")}
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors",
            activeTab === "quick_phrases"
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background hover:bg-muted",
          )}
        >
          <MessageSquarePlus className="size-3.5 shrink-0" />
          <span>PA 3: Câu giao tiếp sẵn</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("text_input")}
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors",
            activeTab === "text_input"
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background hover:bg-muted",
          )}
        >
          <Keyboard className="size-3.5 shrink-0" />
          <span>PA 4: Nhập chữ + Phát âm</span>
        </button>
      </div>

      {/* Nội dung Phương án 1: Yêu cầu thực hiện lại hoặc Xem mẫu */}
      {activeTab === "retry_guide" && (
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              Phương án 1: Thực hiện lại ký hiệu hoặc Xem khung xương mẫu
            </p>
            <p className="text-xs text-muted-foreground">
              Dành cho trường hợp camera bị ngược sáng, tay khuất khỏi khung hình hoặc bạn muốn xem trước động tác chuẩn trong tập dữ liệu VSL-GH.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button size="sm" onClick={onRetryCamera}>
              <RotateCcw className="size-4" />
              Thực Hiện Lại Trước Camera
            </Button>
            <Button size="sm" variant="secondary" onClick={onPlaySampleGuide}>
              <Play className="size-4" />
              Xem Khung Xương Mẫu (.npy) Để Tập Theo
            </Button>
          </div>
        </div>
      )}

      {/* Nội dung Phương án 2: Chọn nội dung bằng hình ảnh (Sơ đồ cơ thể 2D Trước/Sau + Mức độ đau + Thời gian) */}
      {activeTab === "body_map" && (
        <div className="flex flex-col gap-3.5 rounded-xl border bg-muted/20 p-4">
          <InteractiveBodyMap
            selectedRegionId={selectedRegion.id}
            onSelectRegion={(r) => setSelectedRegion(r)}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                2. Mức độ đau / khó chịu:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PAIN_LEVELS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPain(p)}
                    className={cn(
                      "cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      selectedPain.id === p.id
                        ? "border-primary bg-primary text-primary-foreground font-semibold"
                        : "bg-background hover:bg-muted",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                3. Thời gian xuất hiện:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ONSET_TIMES.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelectedOnset(o)}
                    className={cn(
                      "cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      selectedOnset.id === o.id
                        ? "border-primary bg-primary text-primary-foreground font-semibold"
                        : "bg-background hover:bg-muted",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3 shadow-xs">
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-muted-foreground">
                Câu khai báo tự động tạo từ sơ đồ cơ thể:
              </span>
              <p className="text-sm font-semibold text-foreground">
                “{composedBodySymptom}”
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => speakVietnamese(composedBodySymptom)}
              >
                <Volume2 className="size-3.5" />
                Phát âm
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  speakVietnamese(composedBodySymptom)
                  onApplyFallbackText(composedBodySymptom, selectedRegion.label.toUpperCase().replace(/\s+/g, "-"))
                }}
              >
                <UserCheck className="size-3.5" />
                Dùng Nội Dung Này
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Nội dung Phương án 3: Bảng câu giao tiếp có sẵn */}
      {activeTab === "quick_phrases" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {QUICK_PHRASES.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 rounded-xl border bg-background p-3 hover:border-primary/50"
            >
              <button
                type="button"
                onClick={() => {
                  speakVietnamese(item.text)
                  onApplyFallbackText(item.text, "CÂU-GIAO-TIẾP-SẴN")
                }}
                className="flex-1 cursor-pointer text-left"
              >
                <Badge variant="secondary" className="mb-1 text-[10px]">
                  {item.tag}
                </Badge>
                <p className="text-xs font-semibold text-foreground">{item.text}</p>
              </button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => speakVietnamese(item.text)}
                title="Phát âm thanh (Text-to-Speech)"
              >
                <Volume2 className="size-4 text-primary" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Nội dung Phương án 4: Nhập nội dung bằng văn bản + Text-to-Speech */}
      {activeTab === "text_input" && (
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4">
          <label className="text-xs font-semibold text-foreground">
            Nhập trực tiếp triệu chứng hoặc điều bạn muốn nói với bác sĩ:
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Ví dụ: Tôi bị chóng mặt và buồn nôn từ sáng nay..."
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!customText.trim()}
              onClick={() => speakVietnamese(customText.trim())}
            >
              <Volume2 className="size-4" />
              Đọc Thành Tiếng (TTS)
            </Button>
            <Button
              size="sm"
              disabled={!customText.trim()}
              onClick={() => {
                const txt = customText.trim()
                speakVietnamese(txt)
                onApplyFallbackText(txt, "NHẬP-VĂN-BẢN-TTS")
              }}
            >
              Áp Dụng Vào Phiếu Khám
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

