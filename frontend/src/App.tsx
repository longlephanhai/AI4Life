import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { AppHeader, type AppViewMode } from "@/app/app-header"
import { AppProviders } from "@/app/providers"
import { DoctorDashboard } from "@/components/doctor/doctor-dashboard"
import { KioskWorkspace } from "@/components/kiosk/kiosk-workspace"

function resolveInitialMode(): AppViewMode {
  const path = window.location.pathname.toLowerCase()
  if (path.includes("doctor")) return "doctor"
  return "kiosk"
}

export function App() {
  const [mode, setMode] = React.useState<AppViewMode>(resolveInitialMode)
  const [isDark, setIsDark] = React.useState(false)

  React.useEffect(() => {
    const onPopState = () => setMode(resolveInitialMode())
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
  }, [isDark])

  const handleModeChange = (nextMode: AppViewMode) => {
    setMode(nextMode)
    const targetPath = nextMode === "doctor" ? "/doctor" : "/kiosk"
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, "", targetPath)
    }
  }

  return (
    <AppProviders>
      <div className="min-h-dvh bg-background text-foreground">
        <AppHeader
          mode={mode}
          onModeChange={handleModeChange}
          isDark={isDark}
          onToggleTheme={() => setIsDark((prev) => !prev)}
        />

        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
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
                key="doctor"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <DoctorDashboard onSwitchToKiosk={() => handleModeChange("kiosk")} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </AppProviders>
  )
}

export default App
