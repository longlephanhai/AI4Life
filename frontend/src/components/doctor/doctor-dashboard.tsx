import * as React from "react"
import { ClinicalDetailPanel } from "@/components/doctor/clinical-detail-panel"
import { QueuePanel } from "@/components/doctor/queue-panel"
import { StatCard } from "@/components/ui/stat-card"
import { useToast } from "@/components/ui/toast"
import { useDoctorReply, useQueue, useServeTicket } from "@/hooks/use-signbridge"

interface DoctorDashboardProps {
  onSwitchToKiosk: () => void
}

export function DoctorDashboard({ onSwitchToKiosk }: DoctorDashboardProps) {
  const { pushToast } = useToast()
  const queueQuery = useQueue()
  const replyMutation = useDoctorReply()
  const serveMutation = useServeTicket()

  const cases = queueQuery.data?.cases ?? []
  const servedCount = queueQuery.data?.served_count ?? 0

  const [selectedTicket, setSelectedTicket] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (cases.length === 0) {
      setSelectedTicket(null)
      return
    }
    if (!selectedTicket || !cases.some((c) => c.ticket_number === selectedTicket)) {
      setSelectedTicket(cases[0].ticket_number)
    }
  }, [cases, selectedTicket])

  const selectedCase =
    cases.find((c) => c.ticket_number === selectedTicket) ?? cases[0] ?? null

  const emergencyCount = cases.filter(
    (c) => c.semantic_frame.intent === "emergency",
  ).length
  const reviewCount = cases.filter(
    (c) =>
      c.semantic_frame.intent !== "emergency" &&
      c.semantic_frame.needs_human_review,
  ).length

  const handleSendReply = (ticketNumber: string, message: string) => {
    replyMutation.mutate(
      { ticketNumber, message },
      {
        onSuccess: () => {
          pushToast({
            title: `Đã gửi phản hồi tới phiếu ${ticketNumber}`,
            description: `Nội dung: "${message}"`,
            tone: "success",
          })
        },
      },
    )
  }

  const handleServeCase = (ticketNumber: string) => {
    serveMutation.mutate(ticketNumber, {
      onSuccess: () => {
        pushToast({
          title: `Đã hoàn thành tiếp nhận phiếu ${ticketNumber}`,
          description: "Ca khám đã được chuyển sang phòng chuyên khoa.",
          tone: "success",
        })
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard>
          <StatCard.Label>Đang Chờ Tiếp Nhận</StatCard.Label>
          <StatCard.Value>{cases.length}</StatCard.Value>
        </StatCard>

        <StatCard>
          <StatCard.Label>Ca Đã Hoàn Thành</StatCard.Label>
          <StatCard.Value>{servedCount}</StatCard.Value>
        </StatCard>

        <StatCard>
          <StatCard.Label>Cần Khảo Sát Thêm</StatCard.Label>
          <StatCard.Value className={reviewCount > 0 ? "text-warning-foreground" : ""}>
            {reviewCount}
          </StatCard.Value>
        </StatCard>

        <StatCard>
          <StatCard.Label>Báo Động Cấp Cứu (SOS)</StatCard.Label>
          <StatCard.Value className={emergencyCount > 0 ? "text-destructive" : ""}>
            {emergencyCount}
          </StatCard.Value>
        </StatCard>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <QueuePanel
            cases={cases}
            isLoading={queueQuery.isLoading}
            error={queueQuery.error}
            selectedTicket={selectedCase?.ticket_number ?? null}
            onSelectTicket={setSelectedTicket}
            onRefresh={() => void queueQuery.refetch()}
            onSwitchToKiosk={onSwitchToKiosk}
          />
        </div>

        <div className="lg:col-span-7">
          <ClinicalDetailPanel
            selectedCase={selectedCase}
            isReplying={replyMutation.isPending}
            isServing={serveMutation.isPending}
            onSendQuickReply={handleSendReply}
            onServeCase={handleServeCase}
          />
        </div>
      </div>
    </div>
  )
}

