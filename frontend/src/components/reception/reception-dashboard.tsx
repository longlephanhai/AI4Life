import * as React from "react"
import { ClinicalDetailPanel } from "@/components/reception/clinical-detail-panel"
import { QueuePanel } from "@/components/reception/queue-panel"
import { StatCard } from "@/components/ui/stat-card"
import { useToast } from "@/components/ui/toast"
import {
  useCallPatient,
  useDoctorReply,
  useQueue,
  useServeTicket,
  useSetQrPassVisible,
} from "@/hooks/use-signbridge"

interface ReceptionDashboardProps {
  onSwitchToKiosk: () => void
}

export function ReceptionDashboard({ onSwitchToKiosk }: ReceptionDashboardProps) {
  const { pushToast } = useToast()
  const queueQuery = useQueue()
  const replyMutation = useDoctorReply()
  const qrPassMutation = useSetQrPassVisible()
  const callMutation = useCallPatient()
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
  const repliedCount = cases.filter((c) => Boolean(c.doctor_reply)).length

  const handleSendReply = (
    ticketNumber: string,
    message: string,
    options?: { overrideGlosses?: string[]; sendVsl?: boolean },
  ) => {
    replyMutation.mutate(
      {
        ticketNumber,
        message,
        overrideGlosses: options?.overrideGlosses,
        sendVsl: options?.sendVsl,
      },
      {
        onSuccess: () => {
          pushToast({
            title: `Đã gửi hướng dẫn tới phiếu ${ticketNumber}`,
            description: `Nội dung: "${message}"`,
            tone: "success",
          })
        },
      },
    )
  }

  const handleToggleQrPass = (ticketNumber: string, enabled: boolean) => {
    qrPassMutation.mutate(
      { ticketNumber, enabled },
      {
        onSuccess: () => {
          pushToast({
            title: enabled
              ? `Đã hiện mã QR Thẻ Chờ cho phiếu ${ticketNumber}`
              : `Đã ẩn mã QR Thẻ Chờ của phiếu ${ticketNumber}`,
            description: enabled
              ? "Người bệnh có thể quét mã QR trên màn hình Kiosk ngay bây giờ."
              : "Màn hình Kiosk đã ẩn mã QR theo yêu cầu của nhân viên.",
            tone: enabled ? "success" : "default",
          })
        },
      },
    )
  }

  const handleCallPatient = (
    ticketNumber: string,
    roomName: string,
    mode: "pre_alert" | "calling" = "calling",
  ) => {
    callMutation.mutate(
      { ticketNumber, roomName, mode },
      {
        onSuccess: () => {
          pushToast({
            title:
              mode === "pre_alert"
                ? `Đã báo chuẩn bị tới phiếu ${ticketNumber}`
                : `Đang rung & nháy gọi phiếu ${ticketNumber}`,
            description: `Điểm đến: ${roomName}`,
            tone: mode === "pre_alert" ? "default" : "success",
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
          description: "Ca khám đã được chuyển đến phòng chuyên khoa.",
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
          <StatCard.Label>Ca Đã Tiếp Nhận Xong</StatCard.Label>
          <StatCard.Value>{servedCount}</StatCard.Value>
        </StatCard>

        <StatCard>
          <StatCard.Label>Đã Gửi Hướng Dẫn</StatCard.Label>
          <StatCard.Value>{repliedCount}</StatCard.Value>
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
            isTogglingQrPass={qrPassMutation.isPending}
            isCalling={callMutation.isPending}
            isServing={serveMutation.isPending}
            onSendQuickReply={handleSendReply}
            onToggleQrPass={handleToggleQrPass}
            onCallPatient={handleCallPatient}
            onServeCase={handleServeCase}
          />
        </div>
      </div>
    </div>
  )
}

