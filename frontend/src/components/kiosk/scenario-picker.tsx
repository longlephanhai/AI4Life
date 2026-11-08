import { AlertOctagon, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { SampleScenario } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ScenarioPickerProps {
  scenarios: SampleScenario[]
  activeScenarioId: string | null
  onSelectScenario: (scenario: SampleScenario) => void
  onTriggerEmergency: () => void
  isLoading: boolean
}

export function ScenarioPicker({
  scenarios,
  activeScenarioId,
  onSelectScenario,
  onTriggerEmergency,
  isLoading,
}: ScenarioPickerProps) {
  const regularScenarios = scenarios.filter((s) => s.id !== "EMERGENCY")

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tình Huống Ký Hiệu Mẫu (7 Nhóm Nghiệp Vụ Lâm Sàng)
          </h2>
        </div>

        <Button
          variant="destructive"
          size="md"
          onClick={onTriggerEmergency}
          className="font-semibold shadow-sm"
        >
          <AlertOctagon />
          CẤP CỨU KHẨN CẤP (SOS)
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {regularScenarios.map((item) => {
            const isSelected = activeScenarioId === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectScenario(item)}
                className={cn(
                  "flex cursor-pointer flex-col justify-between gap-1.5 rounded-xl border p-2.5 text-left transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.98]",
                  isSelected
                    ? "border-primary bg-accent/60 text-accent-foreground shadow-sm"
                    : "border-border/80 bg-background hover:bg-muted/60",
                )}
              >
                <span className="text-xs font-semibold text-primary">
                  {item.id} • {item.category}
                </span>
                <p className="line-clamp-2 text-xs font-semibold leading-snug text-foreground">
                  {item.title}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </Card>
  )
}
