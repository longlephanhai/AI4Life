import * as React from "react"
import { cn } from "@/lib/utils"

export interface BodyRegion {
  id: string
  label: string
  phrase: string
  category: string
  view: "front" | "back" | "both"
}

export const BODY_REGIONS: BodyRegion[] = [
  // Mặt trước
  { id: "head", label: "Đầu / Thái dương", phrase: "Tôi bị đau đầu và vùng trán", category: "Đầu - Mặt", view: "front" },
  { id: "eyes", label: "Mắt / Thị lực", phrase: "Tôi bị đau mắt và nhìn mờ", category: "Đầu - Mặt", view: "front" },
  { id: "ent", label: "Tai - Mũi", phrase: "Tôi bị nghẹt mũi, ù tai", category: "Đầu - Mặt", view: "front" },
  { id: "mouth", label: "Răng - Miệng - Họng", phrase: "Tôi bị đau nhức răng và rát họng", category: "Đầu - Mặt", view: "front" },
  { id: "neck", label: "Cổ họng / Cổ trước", phrase: "Tôi bị đau rát cổ họng", category: "Cổ", view: "front" },
  { id: "shoulder_left", label: "Bả vai trái", phrase: "Tôi bị đau khớp vai trái", category: "Vai", view: "front" },
  { id: "shoulder_right", label: "Bả vai phải", phrase: "Tôi bị đau khớp vai phải", category: "Vai", view: "front" },
  { id: "chest_left", label: "Ngực trái / Vùng tim", phrase: "Tôi bị đau tức ngực bên trái", category: "Ngực", view: "front" },
  { id: "chest_right", label: "Ngực phải", phrase: "Tôi bị đau tức ngực bên phải", category: "Ngực", view: "front" },
  { id: "stomach", label: "Bụng trên / Dạ dày", phrase: "Tôi bị đau quặn bụng trên vùng dạ dày", category: "Bụng", view: "front" },
  { id: "lower_abdomen", label: "Bụng dưới / Vùng chậu", phrase: "Tôi bị đau âm ỉ bụng dưới", category: "Bụng", view: "front" },
  { id: "arm_upper_left", label: "Bắp tay trái", phrase: "Tôi bị đau nhức bắp tay trái", category: "Tay trái", view: "front" },
  { id: "arm_upper_right", label: "Bắp tay phải", phrase: "Tôi bị đau nhức bắp tay phải", category: "Tay phải", view: "front" },
  { id: "arm_lower_left", label: "Cẳng tay trái", phrase: "Tôi bị đau cẳng tay trái", category: "Tay trái", view: "front" },
  { id: "arm_lower_right", label: "Cẳng tay phải", phrase: "Tôi bị đau cẳng tay phải", category: "Tay phải", view: "front" },
  { id: "hand_left", label: "Cổ tay / Bàn tay trái", phrase: "Tôi bị đau buốt cổ tay và bàn tay trái", category: "Tay trái", view: "front" },
  { id: "hand_right", label: "Cổ tay / Bàn tay phải", phrase: "Tôi bị đau buốt cổ tay và bàn tay phải", category: "Tay phải", view: "front" },
  { id: "thigh_left", label: "Đùi trái", phrase: "Tôi bị đau nhức đùi trái", category: "Chân trái", view: "front" },
  { id: "thigh_right", label: "Đùi phải", phrase: "Tôi bị đau nhức đùi phải", category: "Chân phải", view: "front" },
  { id: "knee_left", label: "Khớp gối trái", phrase: "Tôi bị đau sưng khớp gối trái", category: "Chân trái", view: "front" },
  { id: "knee_right", label: "Khớp gối phải", phrase: "Tôi bị đau sưng khớp gối phải", category: "Chân phải", view: "front" },
  { id: "shin_left", label: "Cẳng chân trái", phrase: "Tôi bị đau cẳng chân trái", category: "Chân trái", view: "front" },
  { id: "shin_right", label: "Cẳng chân phải", phrase: "Tôi bị đau cẳng chân phải", category: "Chân phải", view: "front" },
  { id: "foot_left", label: "Bàn chân / Mắt cá trái", phrase: "Tôi bị đau mắt cá và bàn chân trái", category: "Chân trái", view: "front" },
  { id: "foot_right", label: "Bàn chân / Mắt cá phải", phrase: "Tôi bị đau mắt cá và bàn chân phải", category: "Chân phải", view: "front" },

  // Mặt sau
  { id: "back_head", label: "Sau gáy / Chẩm", phrase: "Tôi bị đau nhức sau gáy", category: "Đầu - Cổ sau", view: "back" },
  { id: "back_neck", label: "Đốt sống cổ", phrase: "Tôi bị mỏi đốt sống cổ sau", category: "Cổ sau", view: "back" },
  { id: "back_upper", label: "Lưng trên / 2 bả vai", phrase: "Tôi bị đau mỏi lưng trên giữa 2 bả vai", category: "Lưng", view: "back" },
  { id: "back_lower", label: "Thắt lưng / Cột sống", phrase: "Tôi bị đau buốt thắt lưng và cột sống", category: "Lưng", view: "back" },
  { id: "buttocks", label: "Vùng hông / Mông", phrase: "Tôi bị ê mỏi hông và vùng chậu sau", category: "Hông", view: "back" },
  { id: "calf_left", label: "Bắp chân trái", phrase: "Tôi bị chuột rút và đau bắp chân trái", category: "Chân trái", view: "back" },
  { id: "calf_right", label: "Bắp chân phải", phrase: "Tôi bị chuột rút và đau bắp chân phải", category: "Chân phải", view: "back" },
  { id: "heel_left", label: "Gót chân trái", phrase: "Tôi bị đau thốn gót chân trái", category: "Chân trái", view: "back" },
  { id: "heel_right", label: "Gót chân phải", phrase: "Tôi bị đau thốn gót chân phải", category: "Chân phải", view: "back" },
]

interface InteractiveBodyMapProps {
  selectedRegionId: string
  onSelectRegion: (region: BodyRegion) => void
}

export function InteractiveBodyMap({
  selectedRegionId,
  onSelectRegion,
}: InteractiveBodyMapProps) {
  const [activeView, setActiveView] = React.useState<"front" | "back">("front")
  const [hoveredRegion, setHoveredRegion] = React.useState<BodyRegion | null>(null)

  const regionMap = React.useMemo(() => {
    const map = new Map<string, BodyRegion>()
    BODY_REGIONS.forEach((r) => map.set(r.id, r))
    return map
  }, [])

  const selectedRegion = regionMap.get(selectedRegionId) ?? BODY_REGIONS[0]

  const handleRegionClick = (id: string) => {
    const r = regionMap.get(id)
    if (r) onSelectRegion(r)
  }

  const getRegionFill = (id: string, defaultColor: string) => {
    if (selectedRegionId === id) {
      return "fill-destructive stroke-destructive-foreground stroke-[2.5] filter drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]"
    }
    return cn(
      defaultColor,
      "stroke-border/70 hover:stroke-primary hover:fill-primary/30 transition-all duration-150 cursor-pointer",
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs">
      {/* Thanh điều khiển góc nhìn Trước / Sau */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground">
            Chạm vào vị trí bị đau trên hình người:
          </span>
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            {selectedRegion.label}
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setActiveView("front")}
            className={cn(
              "cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-all",
              activeView === "front"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Mặt Trước (Front)
          </button>
          <button
            type="button"
            onClick={() => setActiveView("back")}
            className={cn(
              "cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-all",
              activeView === "back"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Mặt Sau (Back)
          </button>
        </div>
      </div>

      {/* Vùng hiển thị sơ đồ cơ thể SVG 2D */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 items-center">
        {/* Cột SVG cơ thể */}
        <div className="relative flex justify-center md:col-span-7 bg-muted/20 rounded-xl p-3 border border-border/50">
          <svg
            viewBox="0 0 260 480"
            className="h-[360px] max-w-full select-none"
            role="img"
            aria-label={`Sơ đồ cơ thể ${activeView === "front" ? "mặt trước" : "mặt sau"}`}
          >
            <defs>
              <linearGradient id="bodySkin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.3" />
              </linearGradient>
            </defs>

            {activeView === "front" ? (
              // ===================== MẶT TRƯỚC =====================
              <g id="front-body" className="transition-all">
                {/* 1. Đầu & Trán */}
                <path
                  d="M130,20 C108,20 100,38 100,56 C100,76 112,88 130,88 C148,88 160,76 160,56 C160,38 152,20 130,20 Z"
                  className={getRegionFill("head", "fill-amber-300/40 dark:fill-amber-500/30")}
                  onClick={() => handleRegionClick("head")}
                  onMouseEnter={() => setHoveredRegion(regionMap.get("head") || null)}
                  onMouseLeave={() => setHoveredRegion(null)}
                />
                <circle cx="120" cy="52" r="3.5" className="fill-foreground/40 pointer-events-none" />
                <circle cx="140" cy="52" r="3.5" className="fill-foreground/40 pointer-events-none" />
                <path d="M126,68 Q130,72 134,68" className="stroke-foreground/50 stroke-1 fill-none pointer-events-none" />

                {/* 2. Cổ trước / Họng */}
                <path
                  d="M120,88 L140,88 L144,106 L116,106 Z"
                  className={getRegionFill("neck", "fill-orange-400/40 dark:fill-orange-500/30")}
                  onClick={() => handleRegionClick("neck")}
                  onMouseEnter={() => setHoveredRegion(regionMap.get("neck") || null)}
                  onMouseLeave={() => setHoveredRegion(null)}
                />

                {/* 3. Bả vai trái & Bả vai phải (Theo hướng người nhìn: trái hình = vai phải bệnh nhân) */}
                <path
                  d="M116,106 L90,118 L76,140 L98,144 L114,124 Z"
                  className={getRegionFill("shoulder_right", "fill-purple-400/40 dark:fill-purple-500/30")}
                  onClick={() => handleRegionClick("shoulder_right")}
                  onMouseEnter={() => setHoveredRegion(regionMap.get("shoulder_right") || null)}
                  onMouseLeave={() => setHoveredRegion(null)}
                />
                <path
                  d="M144,106 L170,118 L184,140 L162,144 L146,124 Z"
                  className={getRegionFill("shoulder_left", "fill-purple-400/40 dark:fill-purple-500/30")}
                  onClick={() => handleRegionClick("shoulder_left")}
                  onMouseEnter={() => setHoveredRegion(regionMap.get("shoulder_left") || null)}
                  onMouseLeave={() => setHoveredRegion(null)}
                />

                {/* 4. Ngực phải & Ngực trái */}
                <path
                  d="M114,120 L98,140 L102,176 L130,176 L130,110 Z"
                  className={getRegionFill("chest_right", "fill-emerald-400/40 dark:fill-emerald-500/30")}
                  onClick={() => handleRegionClick("chest_right")}
                />
                <path
                  d="M146,120 L162,140 L158,176 L130,176 L130,110 Z"
                  className={getRegionFill("chest_left", "fill-emerald-400/40 dark:fill-emerald-500/30")}
                  onClick={() => handleRegionClick("chest_left")}
                />

                {/* 5. Bụng trên / Dạ dày */}
                <path
                  d="M102,176 L158,176 L154,216 L106,216 Z"
                  className={getRegionFill("stomach", "fill-yellow-400/50 dark:fill-yellow-500/30")}
                  onClick={() => handleRegionClick("stomach")}
                />

                {/* 6. Bụng dưới / Vùng chậu */}
                <path
                  d="M106,216 L154,216 L160,250 L100,250 Z"
                  className={getRegionFill("lower_abdomen", "fill-pink-400/40 dark:fill-pink-500/30")}
                  onClick={() => handleRegionClick("lower_abdomen")}
                />

                {/* 7. Tay phải (bên trái hình) */}
                <path
                  d="M76,140 L98,144 L92,195 L68,190 Z"
                  className={getRegionFill("arm_upper_right", "fill-teal-400/40 dark:fill-teal-500/30")}
                  onClick={() => handleRegionClick("arm_upper_right")}
                />
                <path
                  d="M68,190 L92,195 L84,245 L58,238 Z"
                  className={getRegionFill("arm_lower_right", "fill-cyan-400/40 dark:fill-cyan-500/30")}
                  onClick={() => handleRegionClick("arm_lower_right")}
                />
                <path
                  d="M58,238 L84,245 L76,275 L46,268 Z"
                  className={getRegionFill("hand_right", "fill-sky-400/40 dark:fill-sky-500/30")}
                  onClick={() => handleRegionClick("hand_right")}
                />

                {/* 8. Tay trái (bên phải hình) */}
                <path
                  d="M184,140 L162,144 L168,195 L192,190 Z"
                  className={getRegionFill("arm_upper_left", "fill-teal-400/40 dark:fill-teal-500/30")}
                  onClick={() => handleRegionClick("arm_upper_left")}
                />
                <path
                  d="M192,190 L168,195 L176,245 L202,238 Z"
                  className={getRegionFill("arm_lower_left", "fill-cyan-400/40 dark:fill-cyan-500/30")}
                  onClick={() => handleRegionClick("arm_lower_left")}
                />
                <path
                  d="M202,238 L176,245 L184,275 L214,268 Z"
                  className={getRegionFill("hand_left", "fill-sky-400/40 dark:fill-sky-500/30")}
                  onClick={() => handleRegionClick("hand_left")}
                />

                {/* 9. Chân phải (bên trái hình) */}
                <path
                  d="M100,250 L128,250 L124,320 L96,320 Z"
                  className={getRegionFill("thigh_right", "fill-indigo-400/40 dark:fill-indigo-500/30")}
                  onClick={() => handleRegionClick("thigh_right")}
                />
                <path
                  d="M96,320 L124,320 L122,350 L98,350 Z"
                  className={getRegionFill("knee_right", "fill-violet-400/50 dark:fill-violet-500/30")}
                  onClick={() => handleRegionClick("knee_right")}
                />
                <path
                  d="M98,350 L122,350 L118,425 L92,425 Z"
                  className={getRegionFill("shin_right", "fill-blue-400/40 dark:fill-blue-500/30")}
                  onClick={() => handleRegionClick("shin_right")}
                />
                <path
                  d="M92,425 L118,425 L124,455 L82,455 Z"
                  className={getRegionFill("foot_right", "fill-lime-400/40 dark:fill-lime-500/30")}
                  onClick={() => handleRegionClick("foot_right")}
                />

                {/* 10. Chân trái (bên phải hình) */}
                <path
                  d="M132,250 L160,250 L164,320 L136,320 Z"
                  className={getRegionFill("thigh_left", "fill-indigo-400/40 dark:fill-indigo-500/30")}
                  onClick={() => handleRegionClick("thigh_left")}
                />
                <path
                  d="M136,320 L164,320 L162,350 L138,350 Z"
                  className={getRegionFill("knee_left", "fill-violet-400/50 dark:fill-violet-500/30")}
                  onClick={() => handleRegionClick("knee_left")}
                />
                <path
                  d="M138,350 L162,350 L168,425 L142,425 Z"
                  className={getRegionFill("shin_left", "fill-blue-400/40 dark:fill-blue-500/30")}
                  onClick={() => handleRegionClick("shin_left")}
                />
                <path
                  d="M142,425 L168,425 L178,455 L136,455 Z"
                  className={getRegionFill("foot_left", "fill-lime-400/40 dark:fill-lime-500/30")}
                  onClick={() => handleRegionClick("foot_left")}
                />
              </g>
            ) : (
              // ===================== MẶT SAU (BACK VIEW) =====================
              <g id="back-body" className="transition-all">
                {/* 1. Sau gáy / Chẩm */}
                <path
                  d="M130,20 C108,20 100,38 100,56 C100,76 112,88 130,88 C148,88 160,76 160,56 C160,38 152,20 130,20 Z"
                  className={getRegionFill("back_head", "fill-amber-300/40 dark:fill-amber-500/30")}
                  onClick={() => handleRegionClick("back_head")}
                />

                {/* 2. Cổ sau / Đốt sống cổ */}
                <path
                  d="M120,88 L140,88 L144,106 L116,106 Z"
                  className={getRegionFill("back_neck", "fill-orange-400/40 dark:fill-orange-500/30")}
                  onClick={() => handleRegionClick("back_neck")}
                />

                {/* 3. Lưng trên & 2 bả vai */}
                <path
                  d="M116,106 L144,106 L166,128 L158,178 L102,178 L94,128 Z"
                  className={getRegionFill("back_upper", "fill-yellow-400/40 dark:fill-yellow-500/30")}
                  onClick={() => handleRegionClick("back_upper")}
                />

                {/* Đường cột sống lưng */}
                <path d="M130,110 L130,225" className="stroke-foreground/30 stroke-[2] stroke-dasharray-[3,3] fill-none pointer-events-none" />

                {/* 4. Thắt lưng / Cột sống dưới */}
                <path
                  d="M102,178 L158,178 L156,225 L104,225 Z"
                  className={getRegionFill("back_lower", "fill-orange-500/40 dark:fill-orange-600/30")}
                  onClick={() => handleRegionClick("back_lower")}
                />

                {/* 5. Mông / Hông sau */}
                <path
                  d="M104,225 L156,225 L162,260 L98,260 Z"
                  className={getRegionFill("buttocks", "fill-pink-500/40 dark:fill-pink-600/30")}
                  onClick={() => handleRegionClick("buttocks")}
                />

                {/* 6. Tay trái & phải mặt sau */}
                <path
                  d="M76,140 L94,142 L84,245 L62,238 Z"
                  className={getRegionFill("arm_lower_right", "fill-cyan-400/40")}
                  onClick={() => handleRegionClick("arm_lower_right")}
                />
                <path
                  d="M184,140 L166,142 L176,245 L198,238 Z"
                  className={getRegionFill("arm_lower_left", "fill-cyan-400/40")}
                  onClick={() => handleRegionClick("arm_lower_left")}
                />

                {/* 7. Đùi sau */}
                <path
                  d="M98,260 L128,260 L124,330 L96,330 Z"
                  className={getRegionFill("thigh_right", "fill-indigo-400/40")}
                  onClick={() => handleRegionClick("thigh_right")}
                />
                <path
                  d="M132,260 L162,260 L164,330 L136,330 Z"
                  className={getRegionFill("thigh_left", "fill-indigo-400/40")}
                  onClick={() => handleRegionClick("thigh_left")}
                />

                {/* 8. Bắp chân (Calf) */}
                <path
                  d="M96,330 L124,330 L120,425 L92,425 Z"
                  className={getRegionFill("calf_right", "fill-blue-400/40")}
                  onClick={() => handleRegionClick("calf_right")}
                />
                <path
                  d="M136,330 L164,330 L168,425 L140,425 Z"
                  className={getRegionFill("calf_left", "fill-blue-400/40")}
                  onClick={() => handleRegionClick("calf_left")}
                />

                {/* 9. Gót chân (Heel) */}
                <path
                  d="M92,425 L120,425 L122,455 L88,455 Z"
                  className={getRegionFill("heel_right", "fill-lime-400/40")}
                  onClick={() => handleRegionClick("heel_right")}
                />
                <path
                  d="M140,425 L168,425 L172,455 L138,455 Z"
                  className={getRegionFill("heel_left", "fill-lime-400/40")}
                  onClick={() => handleRegionClick("heel_left")}
                />
              </g>
            )}
          </svg>

          {/* Nhãn gợi ý khi hover */}
          {hoveredRegion && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-foreground/90 px-3 py-1 text-xs font-semibold text-background shadow-md">
              {hoveredRegion.label}
            </div>
          )}
        </div>

        {/* Cột danh mục chọn nhanh theo nhóm */}
        <div className="flex flex-col gap-2.5 md:col-span-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Hoặc chọn nhanh theo vị trí:
          </p>

          <div className="max-h-[340px] space-y-1.5 overflow-y-auto pr-1">
            {BODY_REGIONS.filter(
              (r) => r.view === activeView || r.view === "both"
            ).map((region) => (
              <button
                key={region.id}
                type="button"
                onClick={() => onSelectRegion(region)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-medium transition-all",
                  selectedRegionId === region.id
                    ? "border-destructive bg-destructive/10 text-destructive ring-1 ring-destructive font-semibold"
                    : "bg-background hover:bg-muted text-foreground",
                )}
              >
                <span>{region.label}</span>
                <span className="text-[11px] text-muted-foreground">{region.category}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
