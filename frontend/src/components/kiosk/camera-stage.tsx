import * as React from "react"
import { Activity, Camera, CameraOff, CircleDot, Loader2, Square, Upload } from "lucide-react"
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
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const timerRef = React.useRef<number | null>(null)

  const [isCameraOn, setIsCameraOn] = React.useState(false)
  const [cameraError, setCameraError] = React.useState<string | null>(null)
  const [isRecording, setIsRecording] = React.useState(false)
  const [recordDuration, setRecordDuration] = React.useState(0)

  const stopRecording = React.useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsRecording(false)
  }, [])

  const stopCamera = React.useCallback(() => {
    stopRecording()
    setRecordDuration(0)
    const stream = videoRef.current?.srcObject as MediaStream | null
    stream?.getTracks().forEach((track) => track.stop())
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCameraOn(false)
  }, [stopRecording])

  React.useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  const handleToggleCamera = async () => {
    setCameraError(null)
    if (isCameraOn) {
      stopCamera()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
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

  const handleStartRecording = React.useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream | null
    if (!stream) return

    chunksRef.current = []
    let mimeType = "video/webm"
    if (typeof MediaRecorder !== "undefined") {
      if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
        mimeType = "video/webm;codecs=vp9"
      } else if (MediaRecorder.isTypeSupported("video/webm")) {
        mimeType = "video/webm"
      } else if (MediaRecorder.isTypeSupported("video/mp4")) {
        mimeType = "video/mp4"
      }
    }

    try {
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }
      recorder.onstop = () => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" })
          const ext = blob.type.includes("mp4") ? "mp4" : "webm"
          const file = new File([blob], `live_gesture_${Date.now()}.${ext}`, { type: blob.type })
          onUploadVideo(file)
        }
      }

      recorder.start(100)
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordDuration(0)

      if (timerRef.current) window.clearInterval(timerRef.current)
      const startTime = Date.now()
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        setRecordDuration(elapsed)
        // Tự động dừng sau tối đa 8 giây để tránh video quá dài
        if (elapsed >= 8) {
          if (recorder.state !== "inactive") {
            recorder.stop()
          }
          if (timerRef.current) {
            window.clearInterval(timerRef.current)
            timerRef.current = null
          }
          setIsRecording(false)
        }
      }, 500)
    } catch (err) {
      console.error("Lỗi khi khởi động MediaRecorder:", err)
    }
  }, [onUploadVideo])

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
        <Badge variant={isRecording ? "destructive" : isCameraOn || isAnalyzing ? "accent" : "secondary"}>
          {isRecording
            ? `Đang ghi: 00:0${recordDuration}s / 8s`
            : isAnalyzing
              ? "Đang trích xuất 822 chiều..."
              : isCameraOn
                ? "MediaPipe Holistic • Sẵn sàng ký hiệu"
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
                  "Bật Camera để ghi hình ký hiệu trực tiếp, hoặc tải lên video MP4 để suy luận bằng mô hình SLTModel."}
              </p>
            </div>
          </div>
        )}

        {(isCameraOn || isAnalyzing) && (
          <div className="pointer-events-none absolute inset-0">
            {LANDMARK_POINTS.map((pos, idx) => (
              <span
                key={idx}
                className={`absolute ${pos} size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                  isRecording ? "bg-red-500 ring-4 ring-red-500/40" : "bg-success ring-4 ring-success/30"
                }`}
              />
            ))}

            <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-background/85 px-3 py-1.5 text-xs font-medium backdrop-blur-md shadow-sm">
              {isRecording ? (
                <>
                  <span className="size-2.5 animate-ping rounded-full bg-red-600" />
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    Đang thu cử chỉ: 00:0{recordDuration}s (Hãy thực hiện ký hiệu)
                  </span>
                </>
              ) : (
                <>
                  <span className="size-2 animate-ping rounded-full bg-success" />
                  <span>Tracking 137 Landmarks (Pose + Face + Hands)</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!isCameraOn ? (
          <Button
            size="lg"
            variant="default"
            className="flex-1"
            onClick={handleToggleCamera}
          >
            <Camera />
            Bật Camera Ký Hiệu
          </Button>
        ) : (
          <>
            {isRecording ? (
              <Button
                size="lg"
                variant="destructive"
                className="flex-1 font-semibold animate-pulse"
                onClick={stopRecording}
              >
                <Square className="size-4 fill-current" />
                Dừng & Dịch Ngay (00:0{recordDuration}s)
              </Button>
            ) : (
              <Button
                size="lg"
                className="flex-1 font-semibold bg-red-600 hover:bg-red-700 text-white"
                disabled={isAnalyzing}
                onClick={handleStartRecording}
              >
                <CircleDot className="size-5" />
                Bắt Đầu Ký Hiệu (Ghi hình)
              </Button>
            )}

            <Button
              size="lg"
              variant="secondary"
              disabled={isRecording}
              onClick={handleToggleCamera}
            >
              <CameraOff />
              Tắt Camera
            </Button>
          </>
        )}

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
          disabled={isRecording}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload />
          Tải Video MP4
        </Button>
      </div>
    </Card>
  )
}

