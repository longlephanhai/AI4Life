import * as React from "react"
import { AlertCircle, Hand, Loader2, Pause, Play, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { VslSynthesizeResponse } from "@/lib/types"

const HAND_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
]

const POSE_EDGES_25: [number, number][] = [
  [9, 10],
  [9, 11], [11, 13],
  [10, 12], [12, 14],
  [9, 19], [10, 20], [19, 20],
  [0, 9], [0, 10],
]

const POSE_KEY_JOINTS_25 = [0, 9, 10, 11, 12, 13, 14, 19, 20]
const FINGERTIPS = new Set([4, 8, 12, 16, 20])

interface VslSkeletonPlayerProps {
  data: VslSynthesizeResponse | null
  isLoading?: boolean
  onActiveGlossChange?: (gloss: string | null) => void
}

export function VslSkeletonPlayer({
  data,
  isLoading = false,
  onActiveGlossChange,
}: VslSkeletonPlayerProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const [frameIdx, setFrameIdx] = React.useState(0)
  const [isPlaying, setIsPlaying] = React.useState(true)

  React.useEffect(() => {
    setFrameIdx(0)
    setIsPlaying(true)
  }, [data?.text, data?.num_frames])

  React.useEffect(() => {
    if (!data || data.frames.length === 0 || !isPlaying) return
    const total = data.frames.length
    const timer = window.setInterval(() => {
      setFrameIdx((prev) => (prev + 1) % total)
    }, 1000 / (data.fps || 30))
    return () => window.clearInterval(timer)
  }, [data, isPlaying])

  const activeGloss = React.useMemo(() => {
    if (!data?.gloss_frame_boundaries?.length) return null
    const found = data.gloss_frame_boundaries.find(
      (b) => frameIdx >= b.start && frameIdx < b.end,
    )
    return found?.gloss ?? null
  }, [data, frameIdx])

  React.useEffect(() => {
    onActiveGlossChange?.(activeGloss)
  }, [activeGloss, onActiveGlossChange])

  // Tính khung bao chung cho toàn bộ clip để giữ nhân vật cân giữa và không bị cắt ngón tay ở rìa dưới
  const clipBounds = React.useMemo(() => {
    if (!data?.frames?.length) {
      return { cx: 0.5, cy: 0.5, span: 1.0 }
    }
    let minX = 1.0
    let maxX = 0.0
    let minY = 1.0
    let maxY = 0.0
    let hasPoint = false

    for (const fv of data.frames) {
      // Quét thân trên (pose 0..20) + mặt (75..285) + 2 bàn tay (285..411)
      for (let i = 0; i < 411; i += 3) {
        // Bỏ qua các điểm hông/chân (pose 21..24) nếu vượt quá khung dưới
        if (i >= 21 * 3 && i < 25 * 3) continue
        const x = fv[i]
        const y = fv[i + 1]
        if (!x && !y) continue
        hasPoint = true
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }

    if (!hasPoint) return { cx: 0.5, cy: 0.5, span: 1.0 }
    const span = Math.max(maxX - minX, maxY - minY, 0.35) * 1.18
    return {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      span,
    }
  }, [data])

  React.useEffect(() => {
    if (!data || data.frames.length === 0) return
    const canvas = canvasRef.current
    if (!canvas) return
    const frameVec = data.frames[frameIdx]
    if (!frameVec || frameVec.length < 411) return

    const w = 440
    const h = 440
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.fillStyle = "rgb(18, 22, 32)"
    ctx.fillRect(0, 0, w, h)

    const getPt = (offset: number, idx: number): [number, number] | null => {
      const x = frameVec[offset + idx * 3]
      const y = frameVec[offset + idx * 3 + 1]
      if (!x && !y) return null
      const nx = (x - clipBounds.cx) / clipBounds.span + 0.5
      const ny = (y - clipBounds.cy) / clipBounds.span + 0.5
      return [nx * w, ny * h]
    }

    // Mặt (70 điểm)
    ctx.fillStyle = "rgb(140, 160, 190)"
    for (let i = 0; i < 70; i++) {
      const pt = getPt(75, i)
      if (pt) {
        ctx.beginPath()
        ctx.arc(pt[0], pt[1], 1.7, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Cơ thể (25 điểm)
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

    // Tay trái (#00e68c) & Tay phải (#ff783c)
    const drawHand = (
      handOffset: number,
      wristPoseIdx: number,
      color: string,
    ) => {
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      const wrist = getPt(0, wristPoseIdx)
      const root = getPt(handOffset, 0)
      if (wrist && root) {
        ctx.beginPath()
        ctx.moveTo(wrist[0], wrist[1])
        ctx.lineTo(root[0], root[1])
        ctx.stroke()
      }
      for (const [i1, i2] of HAND_EDGES) {
        const p1 = getPt(handOffset, i1)
        const p2 = getPt(handOffset, i2)
        if (p1 && p2) {
          ctx.beginPath()
          ctx.moveTo(p1[0], p1[1])
          ctx.lineTo(p2[0], p2[1])
          ctx.stroke()
        }
      }
      for (let i = 0; i < 21; i++) {
        const pt = getPt(handOffset, i)
        if (pt) {
          ctx.beginPath()
          ctx.arc(pt[0], pt[1], FINGERTIPS.has(i) ? 3.5 : 2.3, 0, Math.PI * 2)
          ctx.fillStyle = "#ffff64"
          ctx.fill()
        }
      }
    }

    drawHand(285, 13, "#00e68c")
    drawHand(348, 14, "#ff783c")
  }, [data, frameIdx, clipBounds])

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2.5 rounded-xl border bg-[#121620] text-sm text-slate-300">
        <Loader2 className="size-5 animate-spin text-primary" />
        <span>Đang tổng hợp ký hiệu VSL phản hồi...</span>
      </div>
    )
  }

  if (!data || data.frames.length === 0) {
    return null
  }

  return (
    <div className="space-y-3 rounded-xl border bg-slate-950/95 p-3.5 text-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Hand className="size-4 text-emerald-400" />
          <span>Phản hồi bằng Ngôn ngữ ký hiệu VSL</span>
          <Badge
            variant="secondary"
            className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]"
          >
            {data.mode === "full_sentence"
              ? "Mẫu nguyên câu VSL-GH"
              : `Ghép ${data.gloss_sequence.length} ký hiệu chuẩn S01`}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 px-2.5 text-xs"
            onClick={() => setIsPlaying((p) => !p)}
          >
            {isPlaying ? (
              <Pause className="size-3.5" />
            ) : (
              <Play className="size-3.5" />
            )}
            {isPlaying ? "Tạm dừng" : "Phát tiếp"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 px-2.5 text-xs"
            onClick={() => {
              setFrameIdx(0)
              setIsPlaying(true)
            }}
          >
            <RotateCcw className="size-3.5" />
            Xem lại
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[300px_1fr] items-center">
        <div className="relative mx-auto aspect-square w-full max-w-[300px] overflow-hidden rounded-lg border border-slate-800 bg-[#121620]">
          <canvas ref={canvasRef} className="size-full object-contain" />
          <span className="absolute bottom-2 left-2 rounded-full bg-slate-950/80 px-2 py-0.5 text-[11px] font-medium text-slate-300 tabular-nums">
            Frame {frameIdx + 1}/{data.frames.length}
          </span>
          {activeGloss && (
            <span className="absolute top-2 left-2 rounded-md bg-emerald-500/90 px-2.5 py-0.5 text-xs font-bold text-slate-950 shadow">
              {activeGloss}
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Chuỗi ký hiệu VSL đang phát (sáng theo nhịp tay):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.gloss_sequence.map((g, i) => {
                const isActive = activeGloss === g
                return (
                  <span
                    key={`${g}-${i}`}
                    className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                      isActive
                        ? "bg-emerald-400 text-slate-950 shadow-sm"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {g}
                  </span>
                )
              })}
            </div>
          </div>

          {data.missing_terms.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-200">
              <AlertCircle className="size-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-300">
                  Thông tin chữ/số bổ sung (ngoài 368 ký hiệu mẫu):
                </p>
                <p className="mt-0.5 font-bold text-sm text-white">
                  {data.missing_terms.join(" • ")}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-[#00e68c]">
              <span className="size-2 rounded-full bg-[#00e68c]" />
              Tay trái
            </span>
            <span className="flex items-center gap-1 text-[#ff783c]">
              <span className="size-2 rounded-full bg-[#ff783c]" />
              Tay phải
            </span>
            <span className="flex items-center gap-1 text-[#00c8dc]">
              <span className="size-2 rounded-full bg-[#00c8dc]" />
              Cơ thể
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

