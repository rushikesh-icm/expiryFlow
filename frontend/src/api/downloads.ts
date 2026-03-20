import { request } from "./client"
import type {
  DownloadRequest,
  DownloadProgress,
  DownloadHistoryResponse,
  RateLimitStatus,
  MessageResponse,
} from "@/types"

export const downloadsApi = {
  start: (data: DownloadRequest) =>
    request<DownloadProgress>("/downloads/start", { method: "POST", body: data }),

  progress: (jobId: string) =>
    request<DownloadProgress>(`/downloads/${jobId}/progress`),

  cancel: (jobId: string) =>
    request<MessageResponse>(`/downloads/${jobId}/cancel`, { method: "POST" }),

  active: () =>
    request<DownloadProgress[]>("/downloads/active"),

  history: () =>
    request<DownloadHistoryResponse>("/downloads/history"),

  rateLimitStatus: () =>
    request<RateLimitStatus>("/downloads/rate-limit-status"),
}
