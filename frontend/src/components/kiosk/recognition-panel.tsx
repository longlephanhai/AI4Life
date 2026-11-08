import { AlertTriangle, CheckCircle2, Stethoscope } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import type { SemanticFrame } from "@/lib/types"
import { cn } from "@/lib/utils"

interface RecognitionPanelProps {
  glosses: string[]
  translation: string
  confidence: number
  frame: SemanticFrame | null
  isPending: boolean
}

export function RecognitionPanel({
  glosses,
  translation,
  confidence,
  frame,
  isPending,
}: RecognitionPanelProps) {
  const isEmergency = frame?.intent === "emergency"
  const needsReview = frame?.needs_human_review

  return (
    <Card
      aria-live="polite"
      className={cn(
        "flex flex-col gap-3 p-5",
        isEmergency && "border-destructive ring-2 ring-destructive/20",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2.5 rounded-full",
              isEmergency ? "animate-ping bg-destructive" : "bg-primary",
            )}
          />
          <h2 className="text-base font-semibold">Kết Quả Phiên Dịch Ngôn Ngữ Ký Hiệu</h2>
        </div>

        <Badge variant="success" className="tabular-nums">
          <CheckCircle2 aria-hidden />
          Độ tin cậy: {(confidence * 100).toFixed(1)}%
        </Badge>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Chuỗi Ký Hiệu Nhận Diện (Gloss Sequence)
        </p>
        <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border bg-muted/40 p-2">
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
              Chưa có cử chỉ nào được thu nhận
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Câu Dịch Tiếng Việt Hoàn Chỉnh
        </p>
        <div
          className={cn(
            "flex min-h-14 items-center rounded-xl border px-4 py-3",
            isEmergency
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-primary/25 bg-accent/40 text-foreground",
          )}
        >
          <p className="font-display text-lg font-semibold leading-snug">
            {translation || "Xin chào! Hãy ra ký hiệu hoặc chọn tình huống mẫu."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="flex items-start gap-2 rounded-xl border bg-muted/30 p-2.5">
          <Stethoscope className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div className="space-y-0.5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Chuyên Khoa Đề Xuất
            </p>
            <p className="text-xs font-semibold">
              {frame?.specialty ?? "Quầy Tiếp Đón Chung"}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl border bg-muted/30 p-2.5">
          <AlertTriangle
            className={cn(
              "mt-0.5 size-4 shrink-0",
              isEmergency
                ? "text-destructive"
                : needsReview
                  ? "text-warning-foreground"
                  : "text-success",
            )}
            aria-hidden
          />
          <div className="space-y-0.5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Phân Loại Ưu Tiên
            </p>
            <p
              className={cn(
                "text-xs font-semibold",
                isEmergency && "text-destructive",
                !isEmergency && needsReview && "text-warning-foreground",
                !isEmergency && !needsReview && "text-success",
              )}
            >
              {isEmergency
                ? "CẤP CỨU ĐỎ (Ưu tiên tuyệt đối)"
                : needsReview
                  ? "Cần hỏi thêm thông tin"
                  : "Tiếp nhận tiêu chuẩn"}
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
