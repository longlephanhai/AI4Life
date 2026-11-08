import type {
  ConfirmPayload,
  ConfirmResponse,
  DoctorReply,
  HealthResponse,
  QueueResponse,
  RecognizeResponse,
  SampleScenario,
  SemanticFrame,
} from "@/lib/types"

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ""

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init)
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText)
    throw new Error(detail || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  getHealth(): Promise<HealthResponse> {
    return requestJson<HealthResponse>("/health")
  },

  getScenarios(): Promise<SampleScenario[]> {
    return requestJson<SampleScenario[]>("/api/sample-scenarios")
  },

  parseSemantic(payload: {
    gloss_sequence?: string[]
    translation?: string
  }): Promise<SemanticFrame> {
    return requestJson<SemanticFrame>("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  },

  recognizeVideo(file: File): Promise<RecognizeResponse> {
    const form = new FormData()
    form.append("video", file)
    return requestJson<RecognizeResponse>("/api/recognize", {
      method: "POST",
      body: form,
    })
  },

  confirmCase(payload: ConfirmPayload): Promise<ConfirmResponse> {
    return requestJson<ConfirmResponse>("/api/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  },

  getQueue(): Promise<QueueResponse> {
    return requestJson<QueueResponse>("/api/queue")
  },

  sendDoctorReply(
    ticketNumber: string,
    message: string,
  ): Promise<{ success: boolean; reply: DoctorReply }> {
    return requestJson<{ success: boolean; reply: DoctorReply }>(
      `/api/queue/${encodeURIComponent(ticketNumber)}/reply`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      },
    )
  },

  serveTicket(
    ticketNumber: string,
  ): Promise<{ success: boolean; served_count: number }> {
    return requestJson<{ success: boolean; served_count: number }>(
      `/api/queue/${encodeURIComponent(ticketNumber)}/serve`,
      {
        method: "POST",
      },
    )
  },
}

