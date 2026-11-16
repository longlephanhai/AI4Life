import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { AppHeader, type AppViewMode } from "@/app/app-header"
import { AppProviders } from "@/app/providers"
import { KioskWorkspace } from "@/components/kiosk/kiosk-workspace"
import { MobileWaitingPass } from "@/components/kiosk/mobile-waiting-pass"
import { ReceptionDashboard } from "@/components/reception/reception-dashboard"

function resolveTicketParam(): string | null {
  const params = new URLSearchParams(window.location.search)
  const queryTicket = params.get("ticket")?.trim()
  if (queryTicket) return queryTicket.toUpperCase()

  const match = window.location.pathname.match(/\/ticket\/([A-Za-z0-9_-]+)/i)
  return match ? match[1].toUpperCase() : null
}

function resolveInitialMode(): AppViewMode {
  const path = window.location.pathname.toLowerCase()
  if (path.includes("reception") || path.includes("doctor")) return "reception"
  return "kiosk"
}

export function App() {
  const [mode, setMode] = React.useState<AppViewMode>(resolveInitialMode)
  const [ticketPassCode, setTicketPassCode] = React.useState<string | null>(
    resolveTicketParam,
  )
  const [isDark, setIsDark] = React.useState(false)

  React.useEffect(() => {
    const onPopState = () => {
      setTicketPassCode(resolveTicketParam())
      setMode(resolveInitialMode())
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
  }, [isDark])

  const handleModeChange = (nextMode: AppViewMode) => {
    setTicketPassCode(null)
    setMode(nextMode)
    const targetPath = nextMode === "reception" ? "/reception" : "/kiosk"
    if (window.location.pathname !== targetPath || window.location.search) {
      window.history.pushState({}, "", targetPath)
    }
  }

  const handleBackFromTicketPass = () => {
    setTicketPassCode(null)
    setMode("kiosk")
    window.history.pushState({}, "", "/kiosk")
  }

  if (ticketPassCode) {
    return (
      <AppProviders>
        <div className="min-h-dvh bg-background px-2 py-3 text-foreground sm:px-4">
          <MobileWaitingPass
            ticketNumber={ticketPassCode}
            onBackToKiosk={handleBackFromTicketPass}
          />
        </div>
      </AppProviders>
    )
  }

  return (
    <AppProviders>
      <div className="flex min-h-dvh flex-col bg-background text-foreground">
        <AppHeader
          mode={mode}
          onModeChange={handleModeChange}
          isDark={isDark}
          onToggleTheme={() => setIsDark((prev) => !prev)}
        />

        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 md:px-6 lg:px-8">
          <AnimatePresence mode="wait" initial={false}>
            {mode === "kiosk" ? (
              <motion.div
                key="kiosk"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <KioskWorkspace />
              </motion.div>
            ) : (
              <motion.div
                key="reception"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <ReceptionDashboard onSwitchToKiosk={() => handleModeChange("kiosk")} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="border-t py-4 text-center text-xs text-muted-foreground/70">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 md:px-6 lg:px-8">
            <p>SignBridge AI — Nền tảng Tiếp nhận Y tế Ban đầu cho Người Khiếm thính (VSL)</p>
            <div className="flex items-center gap-3">
              {mode === "kiosk" ? (
                <button
                  type="button"
                  onClick={() => handleModeChange("reception")}
                  className="cursor-pointer underline-offset-4 hover:text-foreground hover:underline"
                >
                  Dành cho Cán bộ Y tế: Chuyển sang Bàn Tiếp Nhận (/reception)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleModeChange("kiosk")}
                  className="cursor-pointer underline-offset-4 hover:text-foreground hover:underline"
                >
                  Chuyển sang Màn hình Kiosk Người thăm khám (/kiosk)
                </button>
              )}
            </div>
          </div>
        </footer>
      </div>
    </AppProviders>
  )
}

export default App
