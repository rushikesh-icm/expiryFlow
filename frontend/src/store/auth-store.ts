import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

interface AuthState {
  accessToken: string | null
  tokenExpiry: string | null
  userName: string | null
  clientId: string | null
  setAuth: (token: string, expiry: string, userName: string, clientId: string) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
  isTokenExpired: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      tokenExpiry: null,
      userName: null,
      clientId: null,

      setAuth: (token, expiry, userName, clientId) =>
        set({ accessToken: token, tokenExpiry: expiry, userName, clientId }),

      clearAuth: () =>
        set({ accessToken: null, tokenExpiry: null, userName: null, clientId: null }),

      isAuthenticated: () => {
        const { accessToken } = get()
        return !!accessToken && !get().isTokenExpired()
      },

      isTokenExpired: () => {
        const { tokenExpiry } = get()
        if (!tokenExpiry) return true
        try {
          return new Date() >= new Date(tokenExpiry)
        } catch {
          return true
        }
      },
    }),
    {
      name: "dhan-auth",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
