import * as React from "react"
import { Activity, Camera, CameraOff, Loader2, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface CameraStageProps {
  isAnalyzing: boolean
  activeVideoName: string | null
  onUploadVideo: (file: File) => void
  onCameraActivated: () => void
}

const LANDMARK_POINTS = [
  "top-1/3 left-1/2",
  "top-2/5 left-2/5",
  "top-2/5 left-3/5",
  "top-3/5 left-1/3",
  "top-3/5 left-2/3",
]

export function CameraStage({
  isAnalyzing,
  activeVideoName,
  onUploadVideo,
  onCameraActivated,
}: CameraStageProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [isCameraOn, setIsCameraOn] = React.useState(false)
  const [cameraError, setCameraError] = React.useState<string | null>(null)

  const stopCamera = React.useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream | null
    stream?.getTracks().forEach((track) => track.stop())
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCameraOn(false)
  }, [])

  React.useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  const handleToggleCamera = async () => {
    setCameraError(null)
    if (isCameraOn) {
      stopCamera()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setIsCameraOn(true)
      onCameraActivated()
    } catch {
      setCameraError(
        "Thiết bị chưa kết nối webcam. Bạn có thể tải video MP4 hoặc chọn kịch bản mẫu bên trên.",
      )
      onCameraActivated()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUploadVideo(file)
      e.target.value = ""
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold">Khung Thu Nhận Cử Chỉ Ký Hiệu</h2>
        </div>
        <Badge variant={isCameraOn || isAnalyzing ? "accent" : "secondary"}>
          {isAnalyzing
            ? "Đang trích xuất 822 chiều..."
            : isCameraOn
              ? "MediaPipe Holistic • Live"
              : "Sẵn sàng"}
        </Badge>
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-muted/60">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={isCameraOn ? "size-full object-cover" : "hidden"}
        />

        {!isCameraOn && (
          <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-xl border bg-background text-primary shadow-sm">
              {isAnalyzing ? (
                <Loader2 className="size-8 animate-spin" aria-hidden />
              ) : (
                <Camera className="size-8" aria-hidden />
              )}
            </div>
            <div className="max-w-md space-y-1">
              <p className="text-base font-semibold">
                {isAnalyzing
                  ? `Đang phân tích video: ${activeVideoName ?? "mẫu"}`
                  : "Vui lòng đứng trước Camera Kiosk"}
              </p>
              <p className="text-sm text-muted-foreground">
                {cameraError ??
                  "Nhấn nút Bật Camera để ra ký hiệu trực tiếp, hoặc tải lên video MP4 để suy luận bằng mô hình SLTModel."}
              </p>
            </div>
          </div>
        )}

        {(isCameraOn || isAnalyzing) && (
          <div className="pointer-events-none absolute inset-0">
            {LANDMARK_POINTS.map((pos, idx) => (
              <span
                key={idx}
                className={`absolute ${pos} size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-success ring-4 ring-success/30`}
              />
            ))}
            <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-xs font-medium backdrop-blur-md">
              <span className="size-2 animate-ping rounded-full bg-success" />
              <span>Tracking 137 Landmarks (Pose + Face + Hands)</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          variant={isCameraOn ? "secondary" : "default"}
          className="flex-1"
          onClick={handleToggleCamera}
        >
          {isCameraOn ? <CameraOff /> : <Camera />}
          {isCameraOn ? "Dừng Camera" : "Bật Camera Ký Hiệu"}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          size="lg"
          variant="outline"
          loading={isAnalyzing}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload />
          Tải Video MP4
        </Button>
      </div>
    </Card>
  )
}

