import { CheckCircle2, ShieldAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import type { RecognitionStatus } from "@/lib/types"
import { resolveVslDisplayText } from "@/lib/vsl-format"
import { cn } from "@/lib/utils"

interface RecognitionPanelProps {
  glosses: string[]
  translation: string
  vslText?: string | null
  showVslOrder?: boolean
  confidence: number
  isPending: boolean
  isRecognized?: boolean
  recognitionStatus?: RecognitionStatus
  fallbackMessage?: string | null
}

export function RecognitionPanel({
  glosses,
  translation,
  vslText,
  showVslOrder = true,
  confidence,
  isPending,
  isRecognized = true,
  fallbackMessage,
}: RecognitionPanelProps) {
  const hasResult = Boolean(translation) || !isRecognized
  const resolvedVsl =
    isRecognized && hasResult
      ? resolveVslDisplayText({
          vslText,
          glosses,
          vietnameseText: translation,
        })
      : null

  return (
    <Card
      aria-live="polite"
      className={cn(
        "flex flex-col gap-4 p-6",
        !isRecognized && "border-warning ring-2 ring-warning/20",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "size-2.5 rounded-full",
              !isRecognized
                ? "bg-warning"
                : hasResult
                  ? "bg-primary"
                  : "bg-muted-foreground/40",
            )}
          />
          <h2 className="text-lg font-semibold">Kết Quả Phiên Dịch Ngôn Ngữ Ký Hiệu</h2>
        </div>

        {!hasResult ? (
          <Badge variant="secondary">Chờ thu nhận cử chỉ</Badge>
        ) : (
          <Badge variant={isRecognized ? "success" : "destructive"} className="tabular-nums">
            {isRecognized ? <CheckCircle2 aria-hidden /> : <ShieldAlert aria-hidden />}
            {isRecognized
              ? `Độ tin cậy: ${(confidence * 100).toFixed(1)}%`
              : `Chặn đoán mò (${(confidence * 100).toFixed(0)}%)`}
          </Badge>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Chuỗi Ký Hiệu Nhận Diện (Gloss Sequence)
        </p>
        <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border bg-muted/40 p-3">
          {isPending ? (
            <span className="text-sm text-muted-foreground">Đang giải mã ký hiệu...</span>
          ) : glosses.length > 0 ? (
            glosses.map((g, idx) => (
              <Badge key={`${g}-${idx}`} variant="accent">
                {g}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">
              {!isRecognized
                ? "Không phát hiện chuỗi ký hiệu hợp lệ trong từ điển y tế"
                : "Chưa có cử chỉ nào được thu nhận"}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {showVslOrder ? "Nội Dung Song Ngữ (Tiếng Việt & Trật Tự VSL)" : "Câu Dịch Tiếng Việt Hoàn Chỉnh"}
        </p>
        <div
          className={cn(
            "flex min-h-20 flex-col justify-center gap-2.5 rounded-xl border px-4 py-3.5",
            !isRecognized
              ? "border-warning/50 bg-warning/10 text-foreground"
              : hasResult
                ? "border-primary/25 bg-accent/40 text-foreground"
                : "border-border bg-muted/20 text-muted-foreground",
          )}
        >
          {!isRecognized ? (
            <p className="text-sm font-medium leading-relaxed text-warning-foreground">
              ⚠️ {fallbackMessage || "Chưa nhận diện chắc chắn ký hiệu. Để đảm bảo an toàn y khoa, hệ thống không tự ý đoán nghĩa."}
            </p>
          ) : hasResult ? (
            <>
              <div className="space-y-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Tiếng Việt
                </span>
                <p className="font-display text-xl font-semibold leading-snug">
                  {translation}
                </p>
              </div>

              {showVslOrder && resolvedVsl && (
                <div className="rounded-lg border border-primary/20 bg-background/80 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      Ngữ pháp VSL
                    </span>
                    <p className="text-sm font-semibold text-foreground leading-snug">
                      {resolvedVsl}
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Chưa có kết quả. Hãy bật Camera ra ký hiệu hoặc tải video MP4 lên để nhận diện.
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}
