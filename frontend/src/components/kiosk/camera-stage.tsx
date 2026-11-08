import * as React from "react"
import {
  Activity,
  Camera,
  CameraOff,
  CircleDot,
  Eye,
  FlaskConical,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Upload,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { SampleKeypointsResponse } from "@/lib/types"

interface CameraStageProps {
  isAnalyzing: boolean
  activeVideoName: string | null
  samplePlaybackData?: SampleKeypointsResponse | null
  isLoadingSample?: boolean
  onUploadVideo: (file: File) => void
  onCameraActivated: () => void
  onPlaySample?: () => void
  onSimulateUnknownSign?: () => void
}

interface LandmarkPoint {
  x: number
  y: number
  z?: number
  visibility?: number
}

interface HolisticResults {
  poseLandmarks?: LandmarkPoint[]
  faceLandmarks?: LandmarkPoint[]
  leftHandLandmarks?: LandmarkPoint[]
  rightHandLandmarks?: LandmarkPoint[]
}

declare global {
  interface Window {
    Holistic?: new (config: { locateFile: (file: string) => string }) => {
      setOptions: (opts: Record<string, unknown>) => void
      onResults: (cb: (results: HolisticResults) => void) => void
      send: (input: { image: HTMLVideoElement }) => Promise<void>
      close: () => Promise<void>
    }
  }
}

// 70 điểm khuôn mặt chuẩn trong pipeline 411/822 chiều của VSL
const FACE_LANDMARKS_70 = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317,
  14, 87, 178, 88, 33, 7, 163, 144, 145, 153, 362, 382, 381, 380, 374, 373,
  46, 53, 52, 65, 55, 285, 295, 282, 283, 276, 168, 6, 197, 195, 5, 4, 1, 19,
  94, 10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
  378, 400, 377, 152,
]

// Khớp nối bàn tay (21 landmarks)
const HAND_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // Ngón cái
  [0, 5], [5, 6], [6, 7], [7, 8],       // Ngón trỏ
  [0, 9], [9, 10], [10, 11], [11, 12],  // Ngón giữa
  [0, 13], [13, 14], [14, 15], [15, 16],// Ngón áp út
  [0, 17], [17, 18], [18, 19], [19, 20],// Ngón út
  [5, 9], [9, 13], [13, 17],            // Lòng bàn tay
]

// Khớp nối cơ thể (MediaPipe Pose 33-landmark indices cho Live Webcam)
const POSE_EDGES_33: [number, number][] = [
  [11, 12],                 // Hai vai
  [11, 13], [13, 15],       // Cánh tay trái
  [12, 14], [14, 16],       // Cánh tay phải
  [11, 23], [12, 24], [23, 24], // Thân trên
  [0, 11], [0, 12],         // Cổ - Đầu
]

// Khớp nối cơ thể trong file .npy (25-landmark subset của VSL-GH dataset)
const POSE_EDGES_25: [number, number][] = [
  [9, 10],                  // Hai vai
  [9, 11], [11, 13],        // Cánh tay trái
  [10, 12], [12, 14],       // Cánh tay phải
  [9, 19], [10, 20], [19, 20], // Thân trên
  [0, 9], [0, 10],          // Cổ - Đầu
]

const POSE_KEY_JOINTS_33 = [0, 11, 12, 13, 14, 15, 16, 23, 24]
const POSE_KEY_JOINTS_25 = [0, 9, 10, 11, 12, 13, 14, 19, 20]
const FINGERTIPS = new Set([4, 8, 12, 16, 20])

export function CameraStage({
  isAnalyzing,
  activeVideoName,
  samplePlaybackData,
  isLoadingSample = false,
  onUploadVideo,
  onCameraActivated,
  onPlaySample,
  onSimulateUnknownSign,
}: CameraStageProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const sampleCanvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const timerRef = React.useRef<number | null>(null)
  const darkSkeletonRef = React.useRef<boolean>(false)

  const [isCameraOn, setIsCameraOn] = React.useState(false)
  const [cameraError, setCameraError] = React.useState<string | null>(null)
  const [isRecording, setIsRecording] = React.useState(false)
  const [recordDuration, setRecordDuration] = React.useState(0)
  const [darkSkeletonMode, setDarkSkeletonMode] = React.useState(false)
  const [isTrackerReady, setIsTrackerReady] = React.useState(false)
  const [trackedStats, setTrackedStats] = React.useState({
    pose: false,
    face: false,
    leftHand: false,
    rightHand: false,
    totalPoints: 0,
  })

  // State cho trình phát khung xương mẫu (.npy)
  const [sampleFrameIdx, setSampleFrameIdx] = React.useState(0)
  const [isSamplePlaying, setIsSamplePlaying] = React.useState(true)

  React.useEffect(() => {
    darkSkeletonRef.current = darkSkeletonMode
  }, [darkSkeletonMode])

  // Khi có samplePlaybackData mới -> phát từ frame 0
  React.useEffect(() => {
    if (samplePlaybackData) {
      setSampleFrameIdx(0)
      setIsSamplePlaying(true)
    }
  }, [samplePlaybackData])

  // Vòng lặp phát khung xương mẫu (.npy) ở tốc độ 25 FPS khi không bật webcam
  React.useEffect(() => {
    if (isCameraOn || !samplePlaybackData || !isSamplePlaying) return
    const total = samplePlaybackData.frames.length
    if (total === 0) return

    const interval = window.setInterval(() => {
      setSampleFrameIdx((prev) => (prev + 1) % total)
    }, 1000 / (samplePlaybackData.fps || 25))

    return () => window.clearInterval(interval)
  }, [isCameraOn, samplePlaybackData, isSamplePlaying])

  // Vẽ frame hiện tại của file .npy lên sampleCanvasRef (giống hệt visualize_skeleton.py)
  React.useEffect(() => {
    if (isCameraOn || !samplePlaybackData) return
    const canvas = sampleCanvasRef.current
    if (!canvas) return
    const frameVec = samplePlaybackData.frames[sampleFrameIdx]
    if (!frameVec || frameVec.length < 411) return

    const w = 640
    const h = 360
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Nền tối chuẩn visualize_skeleton.py
    ctx.fillStyle = "rgb(18, 22, 32)"
    ctx.fillRect(0, 0, w, h)

    const getPt = (offset: number, idx: number): [number, number] | null => {
      const x = frameVec[offset + idx * 3]
      const y = frameVec[offset + idx * 3 + 1]
      if (!x && !y) return null
      return [x * w, y * h]
    }

    // 1. Vẽ 70 điểm mặt (offset 75..285)
    ctx.fillStyle = "rgb(140, 160, 190)"
    for (let i = 0; i < 70; i++) {
      const pt = getPt(75, i)
      if (pt) {
        ctx.beginPath()
        ctx.arc(pt[0], pt[1], 1.6, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // 2. Vẽ 25 điểm cơ thể Pose (offset 0..75)
    ctx.strokeStyle = "#00c8dc"
    ctx.lineWidth = 3.5
    ctx.lineCap = "round"
    for (const [i1, i2] of POSE_EDGES_25) {
      const p1 = getPt(0, i1)
      const p2 = getPt(0, i2)
      if (p1 && p2) {
        ctx.beginPath()
        ctx.moveTo(p1[0], p1[1])
        ctx.lineTo(p2[0], p2[1])
        ctx.stroke()
      }
    }
    for (const idx of POSE_KEY_JOINTS_25) {
      const pt = getPt(0, idx)
      if (pt) {
        ctx.beginPath()
        ctx.arc(pt[0], pt[1], 4, 0, Math.PI * 2)
        ctx.fillStyle = "#ffffff"
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = "#00c8dc"
        ctx.stroke()
      }
    }

    // 3. Vẽ Bàn tay trái (offset 285..348, màu Xanh lá #00e68c)
    ctx.strokeStyle = "#00e68c"
    ctx.lineWidth = 3
    const wristL = getPt(0, 13)
    const rootL = getPt(285, 0)
    if (wristL && rootL) {
      ctx.beginPath()
      ctx.moveTo(wristL[0], wristL[1])
      ctx.lineTo(rootL[0], rootL[1])
      ctx.stroke()
    }
    for (const [i1, i2] of HAND_EDGES) {
      const p1 = getPt(285, i1)
      const p2 = getPt(285, i2)
      if (p1 && p2) {
        ctx.beginPath()
        ctx.moveTo(p1[0], p1[1])
        ctx.lineTo(p2[0], p2[1])
        ctx.stroke()
      }
    }
    for (let i = 0; i < 21; i++) {
      const pt = getPt(285, i)
      if (pt) {
        ctx.beginPath()
        ctx.arc(pt[0], pt[1], FINGERTIPS.has(i) ? 3.5 : 2.3, 0, Math.PI * 2)
        ctx.fillStyle = "#ffff64"
        ctx.fill()
      }
    }

    // 4. Vẽ Bàn tay phải (offset 348..411, màu Cam #ff783c)
    ctx.strokeStyle = "#ff783c"
    ctx.lineWidth = 3
    const wristR = getPt(0, 14)
    const rootR = getPt(348, 0)
    if (wristR && rootR) {
      ctx.beginPath()
      ctx.moveTo(wristR[0], wristR[1])
      ctx.lineTo(rootR[0], rootR[1])
      ctx.stroke()
    }
    for (const [i1, i2] of HAND_EDGES) {
      const p1 = getPt(348, i1)
      const p2 = getPt(348, i2)
      if (p1 && p2) {
        ctx.beginPath()
        ctx.moveTo(p1[0], p1[1])
        ctx.lineTo(p2[0], p2[1])
        ctx.stroke()
      }
    }
    for (let i = 0; i < 21; i++) {
      const pt = getPt(348, i)
      if (pt) {
        ctx.beginPath()
        ctx.arc(pt[0], pt[1], FINGERTIPS.has(i) ? 3.5 : 2.3, 0, Math.PI * 2)
        ctx.fillStyle = "#ffff64"
        ctx.fill()
      }
    }
  }, [isCameraOn, samplePlaybackData, sampleFrameIdx])

  // Tìm Gloss hiện tại theo frame trong samplePlaybackData
  const currentSampleGloss = React.useMemo(() => {
    if (!samplePlaybackData) return "---"
    const bounds = samplePlaybackData.gloss_frame_boundaries || []
    for (const b of bounds) {
      if (sampleFrameIdx >= b.start && sampleFrameIdx <= b.end) {
        return b.gloss
      }
    }
    // Nếu không có boundary chi tiết, chia đều theo tổng số frame
    const glosses = samplePlaybackData.recognition.gloss_sequence
    if (glosses.length > 0 && samplePlaybackData.num_frames > 0) {
      const idx = Math.min(
        glosses.length - 1,
        Math.floor((sampleFrameIdx / samplePlaybackData.num_frames) * glosses.length),
      )
      return glosses[idx]
    }
    return "---"
  }, [samplePlaybackData, sampleFrameIdx])

  // Vẽ khung xương 137 điểm Live Webcam lên Canvas
  const drawHolisticSkeleton = React.useCallback((results: HolisticResults) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const w = video.videoWidth || 640
    const h = video.videoHeight || 360
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, w, h)

    if (darkSkeletonRef.current) {
      ctx.fillStyle = "rgb(18, 22, 32)"
      ctx.fillRect(0, 0, w, h)
    }

    const toXY = (pt?: LandmarkPoint): [number, number] | null => {
      if (!pt || (pt.x === 0 && pt.y === 0)) return null
      return [pt.x * w, pt.y * h]
    }

    // 1. Vẽ 70 điểm Khuôn mặt
    if (results.faceLandmarks) {
      ctx.fillStyle = "rgba(170, 190, 215, 0.85)"
      for (const idx of FACE_LANDMARKS_70) {
        const pt = toXY(results.faceLandmarks[idx])
        if (pt) {
          ctx.beginPath()
          ctx.arc(pt[0], pt[1], 1.8, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    // 2. Vẽ Khung cơ thể Pose
    if (results.poseLandmarks) {
      ctx.strokeStyle = "#00c8dc"
      ctx.lineWidth = 3.5
      ctx.lineCap = "round"
      for (const [i1, i2] of POSE_EDGES_33) {
        const p1 = toXY(results.poseLandmarks[i1])
        const p2 = toXY(results.poseLandmarks[i2])
        if (p1 && p2) {
          ctx.beginPath()
          ctx.moveTo(p1[0], p1[1])
          ctx.lineTo(p2[0], p2[1])
          ctx.stroke()
        }
      }

      for (const idx of POSE_KEY_JOINTS_33) {
        const pt = toXY(results.poseLandmarks[idx])
        if (pt) {
          ctx.beginPath()
          ctx.arc(pt[0], pt[1], 4.5, 0, Math.PI * 2)
          ctx.fillStyle = "#ffffff"
          ctx.fill()
          ctx.lineWidth = 2
          ctx.strokeStyle = "#00c8dc"
          ctx.stroke()
        }
      }
    }

    // 3. Vẽ Bàn tay trái
    if (results.leftHandLandmarks) {
      ctx.strokeStyle = "#00e68c"
      ctx.lineWidth = 3
      const wristL = toXY(results.poseLandmarks?.[15])
      const rootL = toXY(results.leftHandLandmarks[0])
      if (wristL && rootL) {
        ctx.beginPath()
        ctx.moveTo(wristL[0], wristL[1])
        ctx.lineTo(rootL[0], rootL[1])
        ctx.stroke()
      }

      for (const [i1, i2] of HAND_EDGES) {
        const p1 = toXY(results.leftHandLandmarks[i1])
        const p2 = toXY(results.leftHandLandmarks[i2])
        if (p1 && p2) {
          ctx.beginPath()
          ctx.moveTo(p1[0], p1[1])
          ctx.lineTo(p2[0], p2[1])
          ctx.stroke()
        }
      }

      for (let i = 0; i < results.leftHandLandmarks.length; i++) {
        const pt = toXY(results.leftHandLandmarks[i])
        if (pt) {
          ctx.beginPath()
          ctx.arc(pt[0], pt[1], FINGERTIPS.has(i) ? 3.8 : 2.6, 0, Math.PI * 2)
          ctx.fillStyle = "#ffff64"
          ctx.fill()
        }
      }
    }

    // 4. Vẽ Bàn tay phải
    if (results.rightHandLandmarks) {
      ctx.strokeStyle = "#ff783c"
      ctx.lineWidth = 3
      const wristR = toXY(results.poseLandmarks?.[16])
      const rootR = toXY(results.rightHandLandmarks[0])
      if (wristR && rootR) {
        ctx.beginPath()
        ctx.moveTo(wristR[0], wristR[1])
        ctx.lineTo(rootR[0], rootR[1])
        ctx.stroke()
      }

      for (const [i1, i2] of HAND_EDGES) {
        const p1 = toXY(results.rightHandLandmarks[i1])
        const p2 = toXY(results.rightHandLandmarks[i2])
        if (p1 && p2) {
          ctx.beginPath()
          ctx.moveTo(p1[0], p1[1])
          ctx.lineTo(p2[0], p2[1])
          ctx.stroke()
        }
      }

      for (let i = 0; i < results.rightHandLandmarks.length; i++) {
        const pt = toXY(results.rightHandLandmarks[i])
        if (pt) {
          ctx.beginPath()
          ctx.arc(pt[0], pt[1], FINGERTIPS.has(i) ? 3.8 : 2.6, 0, Math.PI * 2)
          ctx.fillStyle = "#ffff64"
          ctx.fill()
        }
      }
    }

    const hasPose = Boolean(results.poseLandmarks)
    const hasFace = Boolean(results.faceLandmarks)
    const hasL = Boolean(results.leftHandLandmarks)
    const hasR = Boolean(results.rightHandLandmarks)
    const pts = (hasPose ? 25 : 0) + (hasFace ? 70 : 0) + (hasL ? 21 : 0) + (hasR ? 21 : 0)

    setTrackedStats({
      pose: hasPose,
      face: hasFace,
      leftHand: hasL,
      rightHand: hasR,
      totalPoints: pts,
    })
  }, [])

  // Chạy vòng lặp MediaPipe Holistic khi Camera bật
  React.useEffect(() => {
    if (!isCameraOn) {
      setIsTrackerReady(false)
      setTrackedStats({ pose: false, face: false, leftHand: false, rightHand: false, totalPoints: 0 })
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d")
        ctx?.clearRect(0, 0, canvas.width, canvas.height)
      }
      return
    }

    let active = true
    let rafId = 0
    let holisticInstance: InstanceType<NonNullable<Window["Holistic"]>> | null = null

    const initAndRun = async () => {
      if (!window.Holistic) {
        await new Promise<void>((resolve) => {
          const script = document.createElement("script")
          script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js"
          script.crossOrigin = "anonymous"
          script.onload = () => resolve()
          script.onerror = () => resolve()
          document.head.appendChild(script)
        })
      }

      if (!active || !window.Holistic) return

      holisticInstance = new window.Holistic({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
      })

      holisticInstance.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        refineFaceLandmarks: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })

      holisticInstance.onResults((res: HolisticResults) => {
        if (!active) return
        setIsTrackerReady(true)
        drawHolisticSkeleton(res)
      })

      let busy = false
      const tick = async () => {
        if (!active) return
        const video = videoRef.current
        if (video && video.readyState >= 2 && !busy && holisticInstance) {
          busy = true
          try {
            await holisticInstance.send({ image: video })
          } catch {
            // Bỏ qua lỗi frame tạm thời
          }
          busy = false
        }
        if (active) {
          rafId = window.requestAnimationFrame(tick)
        }
      }

      rafId = window.requestAnimationFrame(tick)
    }

    initAndRun()

    return () => {
      active = false
      if (rafId) window.cancelAnimationFrame(rafId)
      if (holisticInstance) {
        holisticInstance.close().catch(() => {})
      }
    }
  }, [isCameraOn, drawHolisticSkeleton])

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
        "Thiết bị chưa kết nối webcam. Bạn có thể xem động tác mẫu (.npy) hoặc tải video MP4.",
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold">Khung Thu Nhận & Mô Phỏng Ký Hiệu</h2>
        </div>

        <div className="flex items-center gap-2">
          {isCameraOn && (
            <Button
              size="sm"
              variant={darkSkeletonMode ? "default" : "outline"}
              onClick={() => setDarkSkeletonMode((v) => !v)}
              className="h-7 px-2.5 text-xs"
            >
              {darkSkeletonMode ? <Eye className="size-3.5" /> : <Sparkles className="size-3.5" />}
              {darkSkeletonMode ? "Hiện Camera thật" : "Nền tối Skeleton"}
            </Button>
          )}

          <Badge variant={isRecording ? "destructive" : isCameraOn || isAnalyzing ? "accent" : "secondary"}>
            {isRecording
              ? `Đang ghi: 00:0${recordDuration}s / 8s`
              : isAnalyzing || isLoadingSample
                ? "Đang suy luận SLTModel..."
                : isCameraOn
                  ? `MediaPipe Live • ${trackedStats.totalPoints}/137 điểm`
                  : samplePlaybackData
                    ? `Đang phát mẫu: ${samplePlaybackData.video_id}`
                    : "Sẵn sàng"}
          </Badge>
        </div>
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-[#121620]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={isCameraOn ? "size-full object-cover" : "hidden"}
        />

        {/* Canvas vẽ trực tiếp 137 điểm Khung xương MediaPipe Holistic từ Webcam */}
        <canvas
          ref={canvasRef}
          className={
            isCameraOn
              ? "pointer-events-none absolute inset-0 size-full object-cover"
              : "hidden"
          }
        />

        {/* Canvas phát mẫu chuyển động 137 điểm từ file .npy trong Dataset khi chưa bật Webcam */}
        <canvas
          ref={sampleCanvasRef}
          className={
            !isCameraOn && samplePlaybackData
              ? "size-full object-contain"
              : "hidden"
          }
        />

        {/* HUD hiển thị thông tin Frame + Gloss + Câu dịch giống hệt visualize_skeleton.py */}
        {!isCameraOn && samplePlaybackData && (
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1 rounded-xl bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 backdrop-blur-md border border-slate-800">
                <p className="font-mono text-[11px] text-slate-400">
                  Sample: {samplePlaybackData.video_id} (Frame {sampleFrameIdx + 1}/{samplePlaybackData.num_frames})
                </p>
                <p className="text-sm font-bold text-amber-400">
                  Động tác (Gloss):{" "}
                  <span className="font-mono text-emerald-400">[{currentSampleGloss}]</span>
                </p>
                <p className="text-xs font-medium text-white">
                  Dịch (AI): {samplePlaybackData.recognition.translation || samplePlaybackData.ground_truth_translation}
                </p>
              </div>

              <div className="pointer-events-auto flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setIsSamplePlaying((p) => !p)}
                >
                  {isSamplePlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                  {isSamplePlaying ? "Tạm dừng" : "Tiếp tục"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => {
                    setSampleFrameIdx(0)
                    setIsSamplePlaying(true)
                  }}
                >
                  <RotateCcw className="size-3.5" />
                  Xem lại từ đầu
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 self-center rounded-full bg-slate-950/85 px-4 py-1 text-xs font-medium text-white border border-slate-800">
              <span className="flex items-center gap-1.5 text-[#00e68c]">
                <span className="size-2.5 rounded-full bg-[#00e68c]" />
                Xanh lá: Tay trái
              </span>
              <span className="flex items-center gap-1.5 text-[#ff783c]">
                <span className="size-2.5 rounded-full bg-[#ff783c]" />
                Cam: Tay phải
              </span>
              <span className="flex items-center gap-1.5 text-[#00c8dc]">
                <span className="size-2.5 rounded-full bg-[#00c8dc]" />
                Xanh dương: Cơ thể
              </span>
            </div>
          </div>
        )}

        {!isCameraOn && !samplePlaybackData && (
          <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <div className="flex size-16 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-primary shadow-sm">
              {isAnalyzing || isLoadingSample ? (
                <Loader2 className="size-8 animate-spin" aria-hidden />
              ) : (
                <Camera className="size-8" aria-hidden />
              )}
            </div>
            <div className="max-w-md space-y-1">
              <p className="text-base font-semibold">
                {isAnalyzing
                  ? `Đang phân tích video: ${activeVideoName ?? "mẫu"}`
                  : "Chọn kịch bản mẫu bên trên để xem Khung Xương Ký Hiệu (.npy)"}
              </p>
              <p className="text-sm text-slate-400">
                {cameraError ??
                  "Bạn có thể xem trước động tác tay chuẩn trong tập dữ liệu rồi bật Camera làm theo."}
              </p>
            </div>
          </div>
        )}

        {isCameraOn && (
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 rounded-full bg-background/85 px-3 py-1.5 text-xs font-medium backdrop-blur-md shadow-sm">
                {isRecording ? (
                  <>
                    <span className="size-2.5 animate-ping rounded-full bg-red-600" />
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      Đang thu cử chỉ: 00:0{recordDuration}s (Hãy thực hiện ký hiệu)
                    </span>
                  </>
                ) : !isTrackerReady ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin text-primary" />
                    <span>Đang khởi tạo mô hình MediaPipe Holistic 137 điểm...</span>
                  </>
                ) : (
                  <>
                    <span className="size-2 animate-ping rounded-full bg-success" />
                    <span>
                      Cơ thể: {trackedStats.pose ? "✓" : "—"} • Mặt: {trackedStats.face ? "✓" : "—"} • Tay trái:{" "}
                      <strong className={trackedStats.leftHand ? "text-emerald-500" : "text-muted-foreground"}>
                        {trackedStats.leftHand ? "✓" : "Chưa thấy"}
                      </strong>{" "}
                      • Tay phải:{" "}
                      <strong className={trackedStats.rightHand ? "text-orange-500" : "text-muted-foreground"}>
                        {trackedStats.rightHand ? "✓" : "Chưa thấy"}
                      </strong>
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 self-center rounded-full bg-slate-950/80 px-4 py-1 text-xs font-medium text-white backdrop-blur-md">
              <span className="flex items-center gap-1.5 text-[#00e68c]">
                <span className="size-2.5 rounded-full bg-[#00e68c]" />
                Xanh lá: Tay trái (21 điểm)
              </span>
              <span className="flex items-center gap-1.5 text-[#ff783c]">
                <span className="size-2.5 rounded-full bg-[#ff783c]" />
                Cam: Tay phải (21 điểm)
              </span>
              <span className="flex items-center gap-1.5 text-[#00c8dc]">
                <span className="size-2.5 rounded-full bg-[#00c8dc]" />
                Xanh dương: Cơ thể (25 điểm)
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="size-2 rounded-full bg-slate-300" />
                Chấm xám: Mặt (70 điểm)
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {!isCameraOn ? (
          <>
            <Button
              size="lg"
              variant="default"
              className="flex-1"
              onClick={handleToggleCamera}
            >
              <Camera />
              Bật Camera Tập Ký Hiệu
            </Button>
            {onPlaySample && (
              <Button
                size="lg"
                variant="secondary"
                loading={isLoadingSample}
                onClick={onPlaySample}
              >
                <Play className="size-4" />
                Xem Mẫu Động Tác (.npy)
              </Button>
            )}
          </>
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
              Xem Lại Khung Xương Mẫu
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

        {onSimulateUnknownSign && (
          <Button
            size="lg"
            variant="outline"
            disabled={isRecording}
            onClick={onSimulateUnknownSign}
            className="border-warning/60 text-warning-foreground hover:bg-warning/10"
            title="Giả lập tình huống bệnh nhân ra ký hiệu chưa có trong từ điển AI để kiểm thử 5 phương án Fallback"
          >
            <FlaskConical className="size-4" />
            Test Từ Ngoài Từ Điển (Fallback)
          </Button>
        )}
      </div>
    </Card>
  )
}
