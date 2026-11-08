import { ExternalLink, HandHeart, Moon, Stethoscope, Sun, UserCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useHealth, useQueue } from "@/hooks/use-signbridge"
import { cn } from "@/lib/utils"

export type AppViewMode = "kiosk" | "reception"

interface AppHeaderProps {
  mode: AppViewMode
  onModeChange: (mode: AppViewMode) => void
  isDark: boolean
  onToggleTheme: () => void
}

export function AppHeader({
  mode,
  onModeChange,
  isDark,
  onToggleTheme,
}: AppHeaderProps) {
  const healthQuery = useHealth()
  const queueQuery = useQueue()

  const queueCount = queueQuery.data?.total_cases ?? 0
  const isModelReady = healthQuery.data?.ai_engine?.is_ready ?? false

  return (
    <header className="sticky top-0 z-40 h-16 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
        {/* Brand identity */}
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm sm:size-10">
            <HandHeart className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-display text-base font-bold tracking-tight sm:text-lg">
                SignBridge AI
              </h1>
              <Badge variant="accent">
                {mode === "kiosk" ? "Kiosk Bệnh Nhân" : "Bàn Tiếp Nhận"}
              </Badge>
            </div>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {mode === "kiosk"
                ? "Màn hình dành riêng cho người thăm khám & người sử dụng ngôn ngữ ký hiệu"
                : "Phần mềm điều phối, phân loại triệu chứng & tiếp nhận người bệnh"}
            </p>
          </div>
        </div>

        {/* Status & actions */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* AI Model Ready Pill */}
          <div className="hidden items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs md:flex">
            <span
              className={cn(
                "size-2 rounded-full",
                isModelReady ? "bg-success" : "bg-warning",
              )}
            />
            <span className="font-medium text-muted-foreground">
              {isModelReady ? "SLTModel v2 Ready (BLEU 89.6%)" : "API Connected"}
            </span>
          </div>

          {/* Role-specific header action */}
          {mode === "kiosk" ? (
            // Màn người thăm khám: Chỉ hiển thị huy hiệu vai trò, KHÔNG có nút chuyển sang màn tiếp nhận
            <div className="flex items-center gap-1.5 rounded-lg border bg-muted/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <UserCheck className="size-4 text-primary" aria-hidden />
              <span>Dành cho Người Thăm Khám</span>
            </div>
          ) : (
            // Màn tiếp nhận: Có hiển thị số ca chờ & nút mở Kiosk để kiểm thử/hỗ trợ người bệnh
            <div className="flex items-center gap-2">
              <Badge variant={queueCount > 0 ? "default" : "secondary"} className="tabular-nums">
                <Stethoscope className="size-3.5" aria-hidden />
                <span>Hàng đợi: {queueCount} ca</span>
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onModeChange("kiosk")}
                title="Mở màn hình Kiosk Bệnh nhân"
                className="hidden sm:inline-flex"
              >
                <ExternalLink />
                Xem Màn Kiosk
              </Button>
            </div>
          )}

          {/* Dark/Light mode toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            aria-label={isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
          >
            {isDark ? <Sun /> : <Moon />}
          </Button>
        </div>
      </div>
    </header>
  )
}
