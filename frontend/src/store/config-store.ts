import { create } from "zustand"

interface ConfigState {
  configExists: boolean | null
  clientId: string | null
  setConfigStatus: (exists: boolean, clientId?: string | null) => void
}

export const useConfigStore = create<ConfigState>()((set) => ({
  configExists: null,
  clientId: null,
  setConfigStatus: (exists, clientId = null) => set({ configExists: exists, clientId }),
}))
