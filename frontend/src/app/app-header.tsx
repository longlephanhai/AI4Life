import { HandHeart, Moon, Stethoscope, Sun, UserRound } from "lucide-react"
import { motion } from "motion/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useHealth, useQueue } from "@/hooks/use-signbridge"
import { cn } from "@/lib/utils"

export type AppViewMode = "kiosk" | "doctor"

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
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm sm:size-10">
            <HandHeart className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-display text-base font-bold tracking-tight sm:text-lg">
                SignBridge AI
              </h1>
              <Badge variant="accent" className="hidden md:inline-flex">
                VSL Medical
              </Badge>
            </div>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Hệ thống Tiếp nhận Y tế Ngôn ngữ Ký hiệu Việt Nam
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs lg:flex">
            <span
              className={cn(
                "size-2 rounded-full",
                isModelReady ? "bg-success" : "bg-warning",
              )}
            />
            <span className="font-medium text-muted-foreground">
              {isModelReady ? "SLTModel Ready (BLEU 74.9)" : "API Connected"}
            </span>
          </div>

          <nav
            aria-label="Chế độ màn hình"
            className="flex items-center rounded-xl border bg-muted p-1"
          >
            <button
              type="button"
              onClick={() => onModeChange("kiosk")}
              className={cn(
                "relative flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors sm:gap-2 sm:px-3 sm:text-sm",
                mode === "kiosk"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {mode === "kiosk" && (
                <motion.span
                  layoutId="active-mode-pill"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  className="absolute inset-0 rounded-lg bg-background shadow-sm"
                />
              )}
              <UserRound className="relative z-10 hidden size-4 shrink-0 sm:block" aria-hidden />
              <span className="relative z-10">
                <span className="hidden sm:inline">Kiosk </span>Bệnh Nhân
              </span>
            </button>

            <button
              type="button"
              onClick={() => onModeChange("doctor")}
              className={cn(
                "relative flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors sm:gap-2 sm:px-3 sm:text-sm",
                mode === "doctor"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {mode === "doctor" && (
                <motion.span
                  layoutId="active-mode-pill"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  className="absolute inset-0 rounded-lg bg-background shadow-sm"
                />
              )}
              <Stethoscope className="relative z-10 hidden size-4 shrink-0 sm:block" aria-hidden />
              <span className="relative z-10">
                <span className="hidden sm:inline">Bàn </span>Bác Sĩ
              </span>
              <Badge
                variant={queueCount > 0 ? "default" : "secondary"}
                className="relative z-10 tabular-nums"
              >
                {queueCount}
              </Badge>
            </button>
          </nav>

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
