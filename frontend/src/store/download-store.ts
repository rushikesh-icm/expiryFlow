import { create } from "zustand"
import type { DownloadProgress } from "@/types"

interface DownloadState {
  activeJob: DownloadProgress | null
  setActiveJob: (job: DownloadProgress | null) => void
  isDownloading: () => boolean
}

export const useDownloadStore = create<DownloadState>()((set, get) => ({
  activeJob: null,
  setActiveJob: (job) => set({ activeJob: job }),
  isDownloading: () => {
    const job = get().activeJob
    return job?.status === "pending" || job?.status === "running"
  },
}))
