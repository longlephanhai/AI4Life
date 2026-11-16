import type {
  CallStatus,
  ConfirmPayload,
  ConfirmResponse,
  DialogueMessage,
  DoctorReply,
  HealthResponse,
  QueueResponse,
  RecognizeResponse,
  SampleKeypointsResponse,
  SampleScenario,
  SemanticFrame,
  TicketStatusResponse,
  VslPreviewResponse,
  VslSynthesizeResponse,
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

  getNetworkInfo(): Promise<{ lan_ip: string | null }> {
    return requestJson<{ lan_ip: string | null }>("/api/network-info")
  },

  getScenarios(): Promise<SampleScenario[]> {
    return requestJson<SampleScenario[]>("/api/sample-scenarios")
  },

  getSampleKeypoints(sampleId: string): Promise<SampleKeypointsResponse> {
    return requestJson<SampleKeypointsResponse>(
      `/api/sample-keypoints/${encodeURIComponent(sampleId)}`,
    )
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
    category?: string,
    options?: { overrideGlosses?: string[]; sendVsl?: boolean },
  ): Promise<{ success: boolean; reply: DoctorReply }> {
    return requestJson<{ success: boolean; reply: DoctorReply }>(
      `/api/queue/${encodeURIComponent(ticketNumber)}/reply`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          category,
          override_glosses: options?.overrideGlosses,
          send_vsl: options?.sendVsl ?? true,
        }),
      },
    )
  },

  acknowledgeDoctorReply(
    ticketNumber: string,
    action: "understood" | "yes" | "no" | "need_help",
    note?: string,
  ): Promise<{ success: boolean; patient_ack: import("./types").PatientAck }> {
    return requestJson<{ success: boolean; patient_ack: import("./types").PatientAck }>(
      `/api/queue/${encodeURIComponent(ticketNumber)}/ack`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      },
    )
  },

  sendPatientMessage(
    ticketNumber: string,
    payload: {
      text: string
      source?: "vsl" | "body_map" | "quick_reply" | "text"
      gloss_sequence?: string[]
      vsl_text?: string | null
    },
  ): Promise<{ success: boolean; message: DialogueMessage }> {
    return requestJson<{ success: boolean; message: DialogueMessage }>(
      `/api/queue/${encodeURIComponent(ticketNumber)}/patient-message`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  setQrPassVisible(
    ticketNumber: string,
    enabled: boolean,
  ): Promise<{ success: boolean; ticket_number: string; qr_pass_enabled: boolean }> {
    return requestJson(
      `/api/queue/${encodeURIComponent(ticketNumber)}/qr-pass`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      },
    )
  },

  callPatient(
    ticketNumber: string,
    roomName: string,
    mode: "pre_alert" | "calling" = "calling",
  ): Promise<{
    success: boolean
    ticket_number: string
    call_status: CallStatus
    assigned_room: string
    called_at: string
    called_at_ts: number
    call_count: number
    call_vsl_text: string
  }> {
    return requestJson(
      `/api/queue/${encodeURIComponent(ticketNumber)}/call`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_name: roomName, mode }),
      },
    )
  },

  confirmOnTheWay(ticketNumber: string): Promise<{
    success: boolean
    ticket_number: string
    call_status: CallStatus
    assigned_room?: string | null
    on_the_way_at: string
  }> {
    return requestJson(
      `/api/queue/${encodeURIComponent(ticketNumber)}/on-the-way`,
      {
        method: "POST",
      },
    )
  },

  getTicketStatus(ticketNumber: string): Promise<TicketStatusResponse> {
    return requestJson<TicketStatusResponse>(
      `/api/ticket/${encodeURIComponent(ticketNumber)}/status`,
    )
  },

  getVslGlosses(): Promise<{ glosses: string[] }> {
    return requestJson<{ glosses: string[] }>("/api/vsl-glosses")
  },

  previewVsl(text: string): Promise<VslPreviewResponse> {
    return requestJson<VslPreviewResponse>("/api/vsl-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
  },

  synthesizeVsl(
    text: string,
    overrideGlosses?: string[],
  ): Promise<VslSynthesizeResponse> {
    return requestJson<VslSynthesizeResponse>("/api/vsl-synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, override_glosses: overrideGlosses }),
    })
  },
}

