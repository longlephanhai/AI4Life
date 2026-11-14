import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { ConfirmPayload } from "@/lib/types"

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => api.getHealth(),
    refetchInterval: 10000,
  })
}

export function useScenarios() {
  return useQuery({
    queryKey: ["scenarios"],
    queryFn: () => api.getScenarios(),
    staleTime: 60000,
  })
}

export function useQueue() {
  return useQuery({
    queryKey: ["queue"],
    queryFn: () => api.getQueue(),
    refetchInterval: 2000,
  })
}

export function useParseSemantic() {
  return useMutation({
    mutationFn: (payload: { gloss_sequence?: string[]; translation?: string }) =>
      api.parseSemantic(payload),
  })
}

export function useRecognizeVideo() {
  return useMutation({
    mutationFn: (file: File) => api.recognizeVideo(file),
  })
}

export function useSampleKeypoints() {
  return useMutation({
    mutationFn: (sampleId: string) => api.getSampleKeypoints(sampleId),
  })
}

export function useConfirmCase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ConfirmPayload) => api.confirmCase(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["queue"] })
    },
  })
}

export function useDoctorReply() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      ticketNumber,
      message,
      category,
      overrideGlosses,
      sendVsl,
    }: {
      ticketNumber: string
      message: string
      category?: string
      overrideGlosses?: string[]
      sendVsl?: boolean
    }) =>
      api.sendDoctorReply(ticketNumber, message, category, {
        overrideGlosses,
        sendVsl,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["queue"] })
    },
  })
}

export function useAcknowledgeDoctorReply() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      ticketNumber,
      action,
      note,
    }: {
      ticketNumber: string
      action: "understood" | "yes" | "no" | "need_help"
      note?: string
    }) => api.acknowledgeDoctorReply(ticketNumber, action, note),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["queue"] })
    },
  })
}

export function useSendPatientMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      ticketNumber,
      text,
      source,
      gloss_sequence,
    }: {
      ticketNumber: string
      text: string
      source?: "vsl" | "body_map" | "quick_reply" | "text"
      gloss_sequence?: string[]
    }) => api.sendPatientMessage(ticketNumber, { text, source, gloss_sequence }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["queue"] })
    },
  })
}

export function useServeTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ticketNumber: string) => api.serveTicket(ticketNumber),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["queue"] })
    },
  })
}

export function useVslGlosses() {
  return useQuery({
    queryKey: ["vsl-glosses"],
    queryFn: () => api.getVslGlosses(),
    staleTime: 300000,
  })
}

export function usePreviewVsl() {
  return useMutation({
    mutationFn: (text: string) => api.previewVsl(text),
  })
}

export function useSynthesizeVsl() {
  return useMutation({
    mutationFn: ({
      text,
      overrideGlosses,
    }: {
      text: string
      overrideGlosses?: string[]
    }) => api.synthesizeVsl(text, overrideGlosses),
  })
}

