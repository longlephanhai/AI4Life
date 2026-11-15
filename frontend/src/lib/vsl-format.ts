const SKIP_GLOSS_TOKENS = new Set(["<blank>", "<unk>", "<pad>", "<bos>", "<eos>", "IX"])

const UPPER_ACRONYMS = new Set(["BHYT", "CCCD", "BMI", "CT", "MRI", "ECG", "HIV"])

const GLOSS_READABLE_OVERRIDES: Record<string, string> = {
  "CÓ-KHÔNG": "có không?",
  "CÓ-CHƯA": "có chưa?",
  "PHẢI-KHÔNG": "phải không?",
  "ĐÚNG-KHÔNG": "đúng không?",
  "CẦN-KHÔNG": "cần không?",
  "ĐƯỢC-KHÔNG": "được không?",
  "ĐAU-KHÔNG": "đau không?",
  "SAO-KHÔNG": "sao không?",
  "BAO-LÂU": "bao lâu?",
  "KHI-NÀO": "khi nào?",
  "BAO-GIỜ": "bao giờ?",
  "Ở-ĐÂU": "ở đâu?",
  "BAO-NHIÊU": "bao nhiêu?",
  "BỆNH-GÌ": "bệnh gì?",
  "TẠI-SAO": "tại sao?",
  GÌ: "gì?",
  ĐÂU: "đâu?",
  "BẢO-HIỂM": "bảo hiểm",
  "Y-TẾ": "y tế",
  "KHÔNG-CÓ": "không có",
  "KHÔNG-CẦN": "không cần",
  "KHÔNG-ĐƯỢC": "không được",
  "KHÔNG-NHẬN": "không nhận",
}

/** Chuyển mã gloss kỹ thuật (vd `BỤNG-ĐAU`) thành cụm chữ thân thiện (`bụng đau`). */
export function formatGlossTokenReadable(token: string): string {
  const raw = (token || "").trim()
  if (!raw || SKIP_GLOSS_TOKENS.has(raw) || SKIP_GLOSS_TOKENS.has(raw.toUpperCase())) {
    return ""
  }

  const upper = raw.toUpperCase()
  if (GLOSS_READABLE_OVERRIDES[upper]) {
    return GLOSS_READABLE_OVERRIDES[upper]
  }

  const parts = raw
    .split(/[-_]+/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (parts.length === 0) return ""

  return parts
    .map((p) => {
      const up = p.toUpperCase()
      return UPPER_ACRONYMS.has(up) ? up : p.toLowerCase()
    })
    .join(" ")
}

/** Chuyển danh sách gloss thành các nhịp chữ theo đúng trật tự VSL để người thăm khám dễ đọc. */
export function formatVslChunksReadable(
  glosses?: string[] | null,
  missingTerms?: string[] | null,
): string[] {
  const chunks: string[] = []
  for (const g of glosses ?? []) {
    const readable = formatGlossTokenReadable(g)
    if (!readable) continue
    if (chunks.length > 0 && chunks[chunks.length - 1].toLowerCase() === readable.toLowerCase()) {
      continue
    }
    chunks.push(readable)
  }

  const joinedLower = chunks.map((c) => c.toLowerCase()).join(" ")
  for (const term of missingTerms ?? []) {
    const t = (term || "").trim()
    if (!t) continue
    if (!joinedLower.includes(t.toLowerCase())) {
      chunks.push(t)
    }
  }

  if (chunks.length > 0) {
    const first = chunks[0]
    chunks[0] = first.charAt(0).toUpperCase() + first.slice(1)
  }

  return chunks
}

/** Chuyển câu ngắn tiếng Việt (khi chưa có gloss) sang trật tự VSL nhẹ nhàng để hiển thị song ngữ. */
export function convertSimpleVietnameseToVslOrder(text?: string | null): string | null {
  const s = (text || "").trim().replace(/[.!]+$/, "")
  if (!s) return null
  const lower = s.toLowerCase()

  const negMatch = lower.match(/^(tôi\s+)?(?:không\s+bị|không\s+có|chưa\s+từng|chưa|không)\s+(.+)$/i)
  if (negMatch) {
    const hasSubj = Boolean(negMatch[1])
    const negWord = lower.split(/\s+/).slice(0, 3).includes("chưa") ? "chưa" : "không"
    const body = negMatch[2].trim()
    return hasSubj ? `Tôi · ${body} · ${negWord}` : `${body.charAt(0).toUpperCase() + body.slice(1)} · ${negWord}`
  }

  const posMatch = lower.match(/^(tôi\s+)?(?:đã|đang|có)\s+(.+)$/i)
  if (posMatch) {
    const hasSubj = Boolean(posMatch[1])
    const tail = lower.startsWith("đã ") || lower.startsWith("tôi đã ")
      ? "rồi"
      : lower.includes("đang ")
        ? "đang"
        : "có"
    const body = posMatch[2].trim()
    return hasSubj ? `Tôi · ${body} · ${tail}` : `${body.charAt(0).toUpperCase() + body.slice(1)} · ${tail}`
  }

  if (lower.startsWith("tôi ")) {
    return `Tôi · ${s.slice(4).trim()}`
  }

  return null
}

/** Trả về chuỗi VSL thân thiện ưu tiên từ API, sau đó từ glosses, cuối cùng chuyển nhẹ từ tiếng Việt. */
export function resolveVslDisplayText(options: {
  vslText?: string | null
  glosses?: string[] | null
  missingTerms?: string[] | null
  vietnameseText?: string | null
}): string | null {
  const explicit = (options.vslText || "").trim()
  if (explicit) return explicit

  const chunks = formatVslChunksReadable(options.glosses, options.missingTerms)
  if (chunks.length > 0) {
    return chunks.join(" · ")
  }

  return convertSimpleVietnameseToVslOrder(options.vietnameseText)
}

export interface CapturedVslClause {
  translation: string
  glosses: string[]
  confidence: number
  vslText?: string | null
}

/** Gộp nhiều lượt quay VSL rời rạc thành một câu tiếng Việt + chuỗi gloss + dòng VSL thống nhất. */
export function mergeCapturedClauses(clauses: CapturedVslClause[]): {
  mergedText: string
  mergedGlosses: string[]
  mergedVslText: string | null
  avgConfidence: number
} {
  if (clauses.length === 0) {
    return {
      mergedText: "",
      mergedGlosses: [],
      mergedVslText: null,
      avgConfidence: 0,
    }
  }

  const formatClause = (txt: string) => {
    const cleaned = txt.trim().replace(/\s+([.?!,])/g, "$1")
    if (!cleaned) return ""
    return /[.?!]$/.test(cleaned) ? cleaned : `${cleaned}.`
  }

  const mergedText = clauses
    .map((c) => formatClause(c.translation))
    .filter(Boolean)
    .join(" ")
  const mergedGlosses = clauses.flatMap((c) => c.glosses)
  const avgConfidence = Number(
    (clauses.reduce((acc, c) => acc + c.confidence, 0) / clauses.length).toFixed(3),
  )

  const clauseVslParts = clauses
    .map((c) =>
      resolveVslDisplayText({
        vslText: c.vslText,
        glosses: c.glosses,
        vietnameseText: c.translation,
      }),
    )
    .filter((v): v is string => Boolean(v))

  const mergedVslText =
    clauseVslParts.length > 1
      ? clauseVslParts.join("  |  ")
      : (clauseVslParts[0] ??
        resolveVslDisplayText({
          glosses: mergedGlosses,
          vietnameseText: mergedText,
        }))

  return {
    mergedText,
    mergedGlosses,
    mergedVslText,
    avgConfidence,
  }
}

