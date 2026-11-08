export type IntentType =
  | "registration"
  | "symptom_report"
  | "specialty_ent_dental"
  | "specialty_other"
  | "lab_diagnostic"
  | "exam_cooperation"
  | "inquiry"
  | "emergency"
  | "general"

export interface SemanticFrame {
  intent: IntentType
  specialty: string | null
  visit_reason: string | null
  symptoms: string[]
  body_location: string | null
  onset: string | null
  severity: string | null
  allergy_status: string
  medication_status: string
  needs_human_review: boolean
  review_reasons: string[]
  summary_for_clinician: string
  patient_confirmation_text: string
  suggested_action: string
  doctor_quick_responses: string[]
}

export type RecognitionStatus =
  | "recognized"
  | "low_confidence"
  | "out_of_vocabulary"
  | "hands_not_detected"
  | "no_movement"
  | "invalid_video"

export interface RecognizeResponse {
  sample_id: string | null
  is_recognized?: boolean
  recognition_status?: RecognitionStatus
  fallback_message?: string | null
  gloss_sequence: string[]
  translation: string
  confidence: number
  semantic_frame: SemanticFrame
}

export interface DoctorReply {
  ticket_number: string
  message: string
  clinician_name: string
  replied_at: string
}

export interface QueueCase {
  ticket_number: string
  patient_name: string
  status: "confirmed" | "edited" | "need_help"
  confirmed_text: string
  gloss_sequence?: string[]
  confidence?: number
  semantic_frame: SemanticFrame
  created_at: string
  doctor_reply?: DoctorReply | null
}

export interface QueueResponse {
  total_cases: number
  served_count: number
  cases: QueueCase[]
  doctor_replies?: Record<string, DoctorReply>
}

export interface ConfirmPayload {
  patient_name?: string
  status?: "confirmed" | "edited" | "need_help"
  confirmed_text: string
  gloss_sequence?: string[]
  confidence?: number
  semantic_frame: SemanticFrame
}

export interface ConfirmResponse {
  success: boolean
  ticket_number: string
  created_at: string
  message: string
}

export interface SampleScenario {
  id: string
  category?: string
  title: string
  glosses: string[]
  translation: string
  description: string
}

export interface HealthResponse {
  status: string
  samples_loaded: number
  ai_engine: {
    is_ready: boolean
    checkpoint: string | null
    device: string | null
  }
}

