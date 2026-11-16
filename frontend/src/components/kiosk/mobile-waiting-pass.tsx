import * as React from "react"
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Clock,
  DoorOpen,
  HandHeart,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Vibrate,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/components/ui/toast"
import { useConfirmOnTheWay, useTicketStatus } from "@/hooks/use-signbridge"
import { cn } from "@/lib/utils"

interface MobileWaitingPassProps {
  ticketNumber: string
  onBackToKiosk?: () => void
}

interface WakeLockSentinelLike {
  released?: boolean
  release: () => Promise<void>
}

export function MobileWaitingPass({
  ticketNumber,
  onBackToKiosk,
}: MobileWaitingPassProps) {
  const { pushToast } = useToast()
  const statusQuery = useTicketStatus(ticketNumber)
  const onTheWayMutation = useConfirmOnTheWay()

  const [alertsArmed, setAlertsArmed] = React.useState(false)
  const [wakeLockActive, setWakeLockActive] = React.useState(false)
  const [flashPhase, setFlashPhase] = React.useState(false)
  const wakeLockRef = React.useRef<WakeLockSentinelLike | null>(null)
  const lastPreAlertKeyRef = React.useRef<string>("")

  const supportsVibrate =
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function"

  const ticket = statusQuery.data
  const callStatus = ticket?.call_status ?? "waiting"
  const peopleAhead = ticket?.people_ahead ?? 0
  const isNearTurn =
    callStatus === "pre_alert" ||
    (callStatus === "waiting" && peopleAhead <= 2 && Boolean(ticket))
  const isCalling = callStatus === "calling"

  // Xin quyền WakeLock + mở khóa Vibration API qua 1 chạm của người dùng
  const handleArmAlerts = async () => {
    setAlertsArmed(true)
    if (supportsVibrate) {
      try {
        navigator.vibrate([90, 60, 90])
      } catch {
        // ignore vibration failure
      }
    }
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> }
      }
      if (nav.wakeLock) {
        wakeLockRef.current = await nav.wakeLock.request("screen")
        setWakeLockActive(true)
      }
    } catch {
      setWakeLockActive(false)
    }

    pushToast({
      title: supportsVibrate
        ? "Đã bật báo rung & giữ màn hình sáng"
        : "Đã bật cảnh báo nháy sáng màn hình",
      description: supportsVibrate
        ? "Điện thoại sẽ tự rung liên tục khi bác sĩ gọi tới lượt bạn."
        : "Trình duyệt này không hỗ trợ rung trực tiếp — màn hình sẽ nháy tương phản cao khi tới lượt.",
      tone: "success",
    })
  }

  const handleTestVibrate = () => {
    setAlertsArmed(true)
    if (supportsVibrate) {
      navigator.vibrate([250, 120, 250])
      pushToast({
        title: "Đã gửi nhịp rung thử",
        description: "Nếu bạn thấy máy rung nhẹ nghĩa là đã sẵn sàng nhận lượt.",
        tone: "default",
      })
    } else {
      setFlashPhase((p) => !p)
      pushToast({
        title: "Thiết bị không hỗ trợ rung web (iOS/PC)",
        description: "Hệ thống sẽ dùng chế độ nháy sáng toàn màn hình thay thế.",
        tone: "default",
      })
    }
  }

  // Giải phóng WakeLock khi rời trang
  React.useEffect(() => {
    return () => {
      if (supportsVibrate) {
        try {
          navigator.vibrate(0)
        } catch {
          // ignore
        }
      }
      void wakeLockRef.current?.release?.().catch(() => undefined)
    }
  }, [supportsVibrate])

  // Rung nhẹ 1 lần khi sắp tới lượt (pre_alert hoặc còn <= 2 người)
  React.useEffect(() => {
    if (!ticket || !isNearTurn || isCalling) {
      return
    }
    const key = `${ticket.ticket_number}:${callStatus}:${peopleAhead <= 2}`
    if (lastPreAlertKeyRef.current === key) return
    lastPreAlertKeyRef.current = key
    if (alertsArmed && supportsVibrate) {
      try {
        navigator.vibrate([250, 120, 250])
      } catch {
        // ignore
      }
    }
  }, [ticket, isNearTurn, isCalling, callStatus, peopleAhead, alertsArmed, supportsVibrate])

  // Rung + nháy nền liên tục (tần số an toàn ~1.3Hz) khi ĐẾN LƯỢT (`calling`)
  React.useEffect(() => {
    if (!isCalling) {
      setFlashPhase(false)
      if (supportsVibrate) {
        try {
          navigator.vibrate(0)
        } catch {
          // ignore
        }
      }
      return
    }

    const triggerVibration = () => {
      if (supportsVibrate) {
        try {
          navigator.vibrate([500, 200, 500])
        } catch {
          // ignore
        }
      }
    }

    triggerVibration()
    const vibTimer = window.setInterval(triggerVibration, 1700)
    const flashTimer = window.setInterval(() => {
      setFlashPhase((prev) => !prev)
    }, 750)

    return () => {
      window.clearInterval(vibTimer)
      window.clearInterval(flashTimer)
      if (supportsVibrate) {
        try {
          navigator.vibrate(0)
        } catch {
          // ignore
        }
      }
    }
  }, [isCalling, supportsVibrate, ticket?.call_count])

  const handleConfirmOnTheWay = () => {
    if (supportsVibrate) {
      try {
        navigator.vibrate(0)
      } catch {
        // ignore
      }
    }
    onTheWayMutation.mutate(ticketNumber, {
      onSuccess: () => {
        pushToast({
          title: "Đã báo bác sĩ bạn đang vào phòng",
          description: "Bác sĩ sẽ giữ lượt và đợi bạn bước vào.",
          tone: "success",
        })
      },
    })
  }

  return (
    <div
      className={cn(
        "mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-md flex-col justify-between gap-4 rounded-2xl p-3 transition-colors duration-300 sm:p-5",
        isCalling &&
          (flashPhase
            ? "bg-emerald-500/25 ring-4 ring-emerald-500"
            : "bg-sky-500/20 ring-4 ring-sky-500"),
        !isCalling && isNearTurn && "bg-amber-500/10 ring-2 ring-amber-500/60",
        callStatus === "on_the_way" && "bg-emerald-500/10 ring-2 ring-emerald-500/50",
      )}
    >
      <div className="space-y-4">
        {/* Thanh trạng thái trên cùng */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <HandHeart className="size-4" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Thẻ Chờ Di Động
              </p>
              <p className="text-xs text-muted-foreground">
                SignBridge AI • Báo hiệu không âm thanh
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onBackToKiosk && (
              <Button variant="ghost" size="sm" onClick={onBackToKiosk} className="h-8 gap-1 px-2 text-xs">
                <ArrowLeft className="size-3.5" />
                Kiosk
              </Button>
            )}
          </div>
        </div>

        {/* Nút kích hoạt quyền rung & khóa màn hình */}
        {!alertsArmed && callStatus !== "served" && (
          <Card className="border-2 border-primary/40 bg-primary/5 p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <Vibrate className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">
                  Bước 1: Bật báo rung khi tới lượt
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Chạm 1 lần vào nút bên dưới để điện thoại được phép{" "}
                  <strong>rung báo hiệu</strong> và <strong>giữ màn hình sáng</strong> trong lúc bạn ngồi chờ.
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="lg"
              onClick={handleArmAlerts}
              className="w-full gap-2 font-bold shadow-sm"
            >
              <Vibrate className="size-5" />
              BẬT BÁO RUNG &amp; GIỮ SÁNG MÀN HÌNH
            </Button>
          </Card>
        )}

        {alertsArmed && callStatus !== "served" && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-success/40 bg-success/10 px-3.5 py-2 text-xs">
            <div className="flex items-center gap-2 font-semibold text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>
                {supportsVibrate
                  ? "Đã bật báo rung"
                  : "Đã bật nháy màn hình"}
                {wakeLockActive ? " • Đang giữ sáng" : ""}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleTestVibrate}
              className="h-7 px-2 text-[11px]"
            >
              Rung thử
            </Button>
          </div>
        )}

        {/* Loading / Not Found */}
        {statusQuery.isLoading && (
          <Card className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Đang kết nối hàng đợi phiếu <strong>{ticketNumber}</strong>...
            </p>
          </Card>
        )}

        {statusQuery.isError && !ticket && (
          <Card className="border-destructive/40 bg-destructive/10 p-6 text-center space-y-3">
            <ShieldAlert className="mx-auto size-8 text-destructive" />
            <div className="space-y-1">
              <p className="font-bold text-foreground">
                Không tìm thấy phiếu {ticketNumber}
              </p>
              <p className="text-xs text-muted-foreground">
                Phiếu có thể đã hoàn thành trước đó hoặc mã số chưa đúng.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void statusQuery.refetch()}
              className="gap-1.5"
            >
              <RefreshCw className="size-3.5" />
              Kiểm tra lại
            </Button>
          </Card>
        )}

        {/* Nội dung chính của Thẻ Chờ */}
        {ticket && (
          <Card
            className={cn(
              "overflow-hidden border-2 p-5 space-y-5 shadow-md",
              isCalling
                ? "border-emerald-600 bg-background"
                : isNearTurn
                  ? "border-amber-500 bg-background"
                  : "border-border bg-card",
            )}
          >
            {/* Số thứ tự cực lớn */}
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge
                  variant={
                    isCalling
                      ? "success"
                      : isNearTurn
                        ? "warning"
                        : ticket.is_emergency
                          ? "destructive"
                          : "secondary"
                  }
                  className="text-xs font-bold uppercase tracking-wider px-3 py-1"
                >
                  {isCalling
                    ? "ĐẾN LƯỢT CỦA BẠN!"
                    : callStatus === "on_the_way"
                      ? "BÁC SĨ ĐANG ĐỢI BẠN VÀO"
                      : callStatus === "served"
                        ? "ĐÃ HOÀN TẤT LƯỢT NÀY"
                        : isNearTurn
                          ? "SẮP TỚI LƯỢT — HÃY CHUẨN BỊ"
                          : "ĐANG CHỜ GỌI LƯỢT"}
                </Badge>
              </div>

              <div className="font-display text-6xl font-black tracking-tight tabular-nums text-foreground sm:text-7xl">
                {ticket.ticket_number}
              </div>

              {ticket.specialty && (
                <p className="text-xs font-semibold text-muted-foreground">
                  Chuyên khoa dự kiến: <span className="text-foreground">{ticket.specialty}</span>
                </p>
              )}
            </div>

            {/* Trạng thái CALLING — Nổi bật tối đa */}
            {isCalling && (
              <div className="space-y-4 rounded-2xl border-2 border-emerald-500 bg-emerald-500/15 p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <BellRing className="size-6 animate-bounce" />
                  <span className="text-sm font-extrabold uppercase tracking-wide">
                    MỜI BẠN VÀO PHÒNG NGAY
                  </span>
                </div>

                <div className="flex items-center justify-center gap-2 rounded-xl bg-background/90 px-4 py-3 shadow-sm">
                  <MapPin className="size-6 shrink-0 text-emerald-600" />
                  <span className="font-display text-2xl font-extrabold text-foreground">
                    {ticket.assigned_room || "Phòng Tiếp Nhận"}
                  </span>
                </div>

                {ticket.call_vsl_text && (
                  <div className="rounded-lg border border-emerald-500/30 bg-background/70 px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      Trật tự ký hiệu VSL
                    </p>
                    <p className="text-base font-bold text-foreground">
                      {ticket.call_vsl_text}
                    </p>
                  </div>
                )}

                <Button
                  type="button"
                  size="lg"
                  variant="success"
                  loading={onTheWayMutation.isPending}
                  onClick={handleConfirmOnTheWay}
                  className="h-14 w-full gap-2 text-base font-extrabold shadow-lg"
                >
                  <DoorOpen className="size-6" />
                  TÔI ĐÃ THẤY — ĐANG VÀO PHÒNG
                </Button>
              </div>
            )}

            {/* Trạng thái ON THE WAY */}
            {callStatus === "on_the_way" && (
              <div className="space-y-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-center">
                <CheckCircle2 className="mx-auto size-8 text-emerald-600" />
                <p className="text-base font-bold text-foreground">
                  Đã báo bác sĩ bạn đang vào{" "}
                  <span className="text-emerald-700 dark:text-emerald-300">
                    {ticket.assigned_room || "phòng khám"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Vui lòng di chuyển tới cửa phòng. Bác sĩ đang giữ lượt cho bạn (xác nhận lúc{" "}
                  {ticket.on_the_way_at}).
                </p>
              </div>
            )}

            {/* Trạng thái PRE-ALERT / WAITING */}
            {(callStatus === "waiting" || callStatus === "pre_alert") && (
              <div
                className={cn(
                  "rounded-2xl border p-4 text-center space-y-2",
                  isNearTurn
                    ? "border-amber-500/50 bg-amber-500/15"
                    : "border-border bg-muted/40",
                )}
              >
                <div className="flex items-center justify-center gap-2 text-sm font-semibold">
                  {isNearTurn ? (
                    <Sparkles className="size-5 text-amber-600" />
                  ) : (
                    <Clock className="size-5 text-primary" />
                  )}
                  <span>
                    {ticket.people_ahead === 0
                      ? "Bạn đang đứng đầu hàng đợi"
                      : `Còn ${ticket.people_ahead} người phía trước bạn`}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {isNearTurn
                    ? ticket.assigned_room
                      ? `Hãy chuẩn bị giấy tờ và tiến gần ${ticket.assigned_room}.`
                      : "Hãy chuẩn bị sẵn CCCD/BHYT và tiến lại gần khu vực phòng tiếp nhận."
                    : "Bạn có thể ngồi nghỉ thoải mái. Khi tới lượt, máy sẽ tự rung và nháy sáng màn hình."}
                </p>
              </div>
            )}

            {/* Trạng thái SERVED */}
            {callStatus === "served" && (
              <div className="rounded-2xl border border-border bg-muted/40 p-4 text-center space-y-2">
                <CheckCircle2 className="mx-auto size-8 text-success" />
                <p className="text-sm font-bold text-foreground">
                  Lượt tiếp nhận {ticket.ticket_number} đã hoàn tất
                </p>
                <p className="text-xs text-muted-foreground">
                  Cảm ơn bạn đã sử dụng SignBridge AI.
                </p>
              </div>
            )}

            {/* Lời nhắn mới nhất từ bác sĩ nếu có */}
            {ticket.doctor_reply?.message && callStatus !== "served" && (
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  Hướng dẫn từ nhân viên y tế
                </p>
                <p className="text-sm font-semibold text-foreground">
                  “{ticket.doctor_reply.message}”
                </p>
                {ticket.doctor_reply.vsl_text && (
                  <p className="text-xs text-muted-foreground">
                    VSL: <strong>{ticket.doctor_reply.vsl_text}</strong>
                  </p>
                )}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Footer trạng thái kết nối */}
      <div className="flex items-center justify-between gap-2 rounded-xl border bg-background/80 px-3.5 py-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Smartphone className="size-3.5 text-primary" />
          Cập nhật tự động mỗi 1,5 giây
        </span>
        <span className="tabular-nums">
          {statusQuery.dataUpdatedAt
            ? new Date(statusQuery.dataUpdatedAt).toLocaleTimeString("vi-VN")
            : "—"}
        </span>
      </div>
    </div>
  )
}

