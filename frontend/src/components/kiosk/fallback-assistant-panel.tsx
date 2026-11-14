import * as React from "react"
import {
  Activity,
  AlertCircle,
  BedDouble,
  Brain,
  Droplets,
  Hand,
  Headphones,
  MessageSquarePlus,
  Play,
  RotateCcw,
  Sparkles,
  Thermometer,
  UserCheck,
  Wind,
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

type FallbackTab = "body_map" | "systemic_symptoms" | "quick_phrases" | "retry_guide"

const PAIN_LEVELS = [
  { id: "mild", label: "Nhẹ (1–3)", suffix: "mức độ nhẹ" },
  { id: "moderate", label: "Vừa (4–6)", suffix: "mức độ vừa" },
  { id: "severe", label: "Nặng / Dữ dội (7–10)", suffix: "mức độ dữ dội" },
]

type DurationPreset =
  | { kind: "preset"; id: string; label: string; suffix: string }
  | { kind: "custom"; id: "custom" }

const DURATION_PRESETS: Array<Exclude<DurationPreset, { kind: "custom" }>> = [
  { kind: "preset", id: "today", label: "Hôm nay", suffix: "từ hôm nay" },
  { kind: "preset", id: "yesterday", label: "Hôm qua", suffix: "từ hôm qua" },
]

const DURATION_NUMBERS = [1, 2, 3, 4, 5, 6, 7]
const DURATION_UNITS = ["ngày", "tuần", "tháng"] as const

interface SystemicSymptom {
  id: string
  label: string
  gloss: string
  phrase: string
  icon: React.ComponentType<{ className?: string }>
}

const SYSTEMIC_SYMPTOMS: SystemicSymptom[] = [
  {
    id: "fever",
    label: "Sốt / Ớn lạnh",
    gloss: "SỐT",
    phrase: "Tôi bị sốt",
    icon: Thermometer,
  },
  {
    id: "cough",
    label: "Ho / Đau rát họng",
    gloss: "HO",
    phrase: "Tôi bị ho và đau rát họng",
    icon: Wind,
  },
  {
    id: "dizzy",
    label: "Chóng mặt / Đau đầu",
    gloss: "CHÓNG-MẶT",
    phrase: "Tôi bị chóng mặt và đau đầu",
    icon: Brain,
  },
  {
    id: "nausea",
    label: "Buồn nôn / Tiêu chảy",
    gloss: "ĐAU-BỤNG",
    phrase: "Tôi bị buồn nôn và tiêu chảy",
    icon: Droplets,
  },
  {
    id: "insomnia",
    label: "Mất ngủ / Khó ngủ",
    gloss: "MẤT-NGỦ",
    phrase: "Tôi bị mất ngủ",
    icon: BedDouble,
  },
  {
    id: "skin",
    label: "Ngứa / Phát ban da",
    gloss: "DỊ-ỨNG",
    phrase: "Tôi bị ngứa và nổi mẩn ngoài da",
    icon: Activity,
  },
]

const QUICK_PHRASES = [
  {
    text: "Tôi muốn đăng ký khám sức khỏe.",
    tag: "Đăng ký khám",
  },
  {
    text: "Tôi có tiền sử bị dị ứng thuốc kháng sinh.",
    tag: "Cảnh báo dị ứng",
  },
  {
    text: "Tôi không bị dị ứng thuốc.",
    tag: "Dị ứng",
  },
  {
    text: "Tôi chưa uống thuốc gì trước khi đến đây.",
    tag: "Thuốc đang dùng",
  },
  {
    text: "Tôi đã uống thuốc giảm đau / hạ sốt ở nhà.",
    tag: "Thuốc đang dùng",
  },
  {
    text: "Tôi cần nhân viên y tế hỗ trợ trực tiếp.",
    tag: "Cần trợ giúp",
  },
]

/** Bộ chọn Mức độ + Thời gian khởi phát dạng chạm nút số (Zero-Typing) dùng chung cho PA 2 & PA 3. */
function SeverityAndDurationControls({
  selectedPainId,
  onSelectPain,
  durationMode,
  onSelectDurationPreset,
  durationCount,
  onSelectDurationCount,
  durationUnit,
  onSelectDurationUnit,
}: {
  selectedPainId: string
  onSelectPain: (p: (typeof PAIN_LEVELS)[number]) => void
  durationMode: "today" | "yesterday" | "custom"
  onSelectDurationPreset: (id: "today" | "yesterday") => void
  durationCount: number
  onSelectDurationCount: (n: number) => void
  durationUnit: (typeof DURATION_UNITS)[number]
  onSelectDurationUnit: (u: (typeof DURATION_UNITS)[number]) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Mức độ nặng / nhẹ:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PAIN_LEVELS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectPain(p)}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                selectedPainId === p.id
                  ? "border-primary bg-primary text-primary-foreground font-semibold"
                  : "bg-background hover:bg-muted",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Bắt đầu từ bao lâu (chạm chọn số):
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DURATION_PRESETS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onSelectDurationPreset(o.id as "today" | "yesterday")}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                durationMode === o.id
                  ? "border-primary bg-primary text-primary-foreground font-semibold"
                  : "bg-background hover:bg-muted",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {DURATION_NUMBERS.map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => onSelectDurationCount(num)}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 text-xs font-bold tabular-nums transition-colors",
                durationMode === "custom" && durationCount === num
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              {num}
            </button>
          ))}
          <span className="mx-0.5 text-xs text-muted-foreground">•</span>
          {DURATION_UNITS.map((unit) => (
            <button
              key={unit}
              type="button"
              onClick={() => onSelectDurationUnit(unit)}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors",
                durationMode === "custom" && durationUnit === unit
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              {unit}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
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
  const [selectedSystemic, setSelectedSystemic] = React.useState<SystemicSymptom>(
    SYSTEMIC_SYMPTOMS[0],
  )
  const [selectedPain, setSelectedPain] = React.useState(PAIN_LEVELS[1])
  const [durationMode, setDurationMode] = React.useState<"today" | "yesterday" | "custom">(
    "custom",
  )
  const [durationCount, setDurationCount] = React.useState<number>(3)
  const [durationUnit, setDurationUnit] = React.useState<(typeof DURATION_UNITS)[number]>("ngày")

  // Tự động chuyển về tab Sơ đồ cơ thể khi nhận diện thất bại
  React.useEffect(() => {
    if (!isRecognized) {
      setActiveTab("body_map")
    }
  }, [isRecognized])

  const durationSuffix =
    durationMode === "today"
      ? "từ hôm nay"
      : durationMode === "yesterday"
        ? "từ hôm qua"
        : `khoảng ${durationCount} ${durationUnit} trước`

  const composedBodySymptom = `${selectedRegion.phrase}, ${selectedPain.suffix}, ${durationSuffix}.`
  const composedSystemicSymptom = `${selectedSystemic.phrase}, ${selectedPain.suffix}, ${durationSuffix}.`

  const handleSelectDurationCount = (num: number) => {
    setDurationMode("custom")
    setDurationCount(num)
  }

  const handleSelectDurationUnit = (unit: (typeof DURATION_UNITS)[number]) => {
    setDurationMode("custom")
    setDurationUnit(unit)
  }

  return (
    <Card
      className={cn(
        "flex flex-col gap-4 p-5 transition-all",
        !isRecognized
          ? "border-2 border-warning bg-warning/5 shadow-md"
          : "border bg-card",
      )}
    >
      {/* Header giải thích cơ chế Zero-Typing */}
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
                  ? "Chế Độ Chạm Trực Quan (Không Cần Gõ Chữ)"
                  : "Bảng Giao Tiếp Chạm Trực Quan (Zero-Typing)"}
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
                  "Chỉ cần chạm vào hình cơ thể, biểu tượng triệu chứng hoặc câu có sẵn — không cần gõ bàn phím:"
                : "Không thuộc ký hiệu tay? Hãy chạm vào vị trí đau hoặc biểu tượng triệu chứng dưới đây:"}
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

      {/* Thanh chọn 4 phương án chạm (Zero-Typing) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
          <span>PA 2: Sơ đồ cơ thể</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("systemic_symptoms")}
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors",
            activeTab === "systemic_symptoms"
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background hover:bg-muted",
          )}
        >
          <Thermometer className="size-3.5 shrink-0" />
          <span>PA 3: Triệu chứng khác</span>
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
          <span>PA 4: Thủ tục / Thuốc</span>
        </button>

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
          <span>PA 1: Thử lại Camera</span>
        </button>
      </div>

      {/* Phương án 1: Thực hiện lại trước Camera */}
      {activeTab === "retry_guide" && (
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              Phương án 1: Thực hiện lại ký hiệu trước Camera
            </p>
            <p className="text-xs text-muted-foreground">
              Dành cho trường hợp camera bị ngược sáng hoặc tay khuất khỏi khung hình. Đưa 2 tay vào giữa khung hình và làm chậm hơn.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button size="sm" onClick={onRetryCamera}>
              <RotateCcw className="size-4" />
              Thực Hiện Lại Trước Camera
            </Button>
            <Button size="sm" variant="secondary" onClick={onPlaySampleGuide}>
              <Play className="size-4" />
              Xem Khung Xương Minh Họa
            </Button>
          </div>
        </div>
      )}

      {/* Phương án 2: Sơ đồ cơ thể 2D + Mức độ + Chọn số ngày */}
      {activeTab === "body_map" && (
        <div className="flex flex-col gap-3.5 rounded-xl border bg-muted/20 p-4">
          <InteractiveBodyMap
            selectedRegionId={selectedRegion.id}
            onSelectRegion={(r) => setSelectedRegion(r)}
          />

          <SeverityAndDurationControls
            selectedPainId={selectedPain.id}
            onSelectPain={setSelectedPain}
            durationMode={durationMode}
            onSelectDurationPreset={setDurationMode}
            durationCount={durationCount}
            onSelectDurationCount={handleSelectDurationCount}
            durationUnit={durationUnit}
            onSelectDurationUnit={handleSelectDurationUnit}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3 shadow-xs">
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-muted-foreground">
                Câu khai báo tự động tạo (không cần gõ):
              </span>
              <p className="text-sm font-semibold text-foreground">
                “{composedBodySymptom}”
              </p>
            </div>
            <Button
              size="sm"
              onClick={() =>
                onApplyFallbackText(
                  composedBodySymptom,
                  selectedRegion.label.toUpperCase().replace(/\s+/g, "-"),
                )
              }
            >
              <UserCheck className="size-3.5" />
              Dùng Nội Dung Này
            </Button>
          </div>
        </div>
      )}

      {/* Phương án 3: Lưới Biểu tượng Triệu chứng Toàn thân (Sốt, Ho, Chóng mặt, Buồn nôn, Mất ngủ, Ngứa) */}
      {activeTab === "systemic_symptoms" && (
        <div className="flex flex-col gap-3.5 rounded-xl border bg-muted/20 p-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              1. Chạm biểu tượng triệu chứng toàn thân đang gặp:
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SYSTEMIC_SYMPTOMS.map((sym) => {
                const Icon = sym.icon
                const active = selectedSystemic.id === sym.id
                return (
                  <button
                    key={sym.id}
                    type="button"
                    onClick={() => setSelectedSystemic(sym)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-left text-xs font-semibold transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "bg-background hover:bg-muted/60",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{sym.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <SeverityAndDurationControls
            selectedPainId={selectedPain.id}
            onSelectPain={setSelectedPain}
            durationMode={durationMode}
            onSelectDurationPreset={setDurationMode}
            durationCount={durationCount}
            onSelectDurationCount={handleSelectDurationCount}
            durationUnit={durationUnit}
            onSelectDurationUnit={handleSelectDurationUnit}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3 shadow-xs">
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-muted-foreground">
                Câu khai báo tự động tạo (không cần gõ):
              </span>
              <p className="text-sm font-semibold text-foreground">
                “{composedSystemicSymptom}”
              </p>
            </div>
            <Button
              size="sm"
              onClick={() =>
                onApplyFallbackText(composedSystemicSymptom, selectedSystemic.gloss)
              }
            >
              <UserCheck className="size-3.5" />
              Áp Dụng Triệu Chứng Này
            </Button>
          </div>
        </div>
      )}

      {/* Phương án 4: Chạm câu thủ tục, dị ứng, thuốc đang dùng */}
      {activeTab === "quick_phrases" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {QUICK_PHRASES.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onApplyFallbackText(item.text, "CHẠM-NHANH")}
              className="flex cursor-pointer flex-col items-start rounded-xl border bg-background p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/30"
            >
              <Badge variant="secondary" className="mb-1 text-[10px]">
                {item.tag}
              </Badge>
              <p className="text-xs font-semibold text-foreground">{item.text}</p>
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}
