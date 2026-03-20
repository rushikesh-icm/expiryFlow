import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { DownloadProgress } from "@/types"

interface DownloadState {
  activeJob: DownloadProgress | null
  setActiveJob: (job: DownloadProgress | null) => void
  clearJob: () => void
  isDownloading: () => boolean
}

export const useDownloadStore = create<DownloadState>()(
  persist(
    (set, get) => ({
      activeJob: null,
      setActiveJob: (job) => set({ activeJob: job }),
      clearJob: () => set({ activeJob: null }),
      isDownloading: () => {
        const job = get().activeJob
        return job?.status === "pending" || job?.status === "running"
      },
    }),
    {
      name: "expiryflow-download",
      partialize: (state) => ({ activeJob: state.activeJob }),
    }
  )
)
