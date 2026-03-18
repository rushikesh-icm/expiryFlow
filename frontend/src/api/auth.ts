import { request } from "./client"
import type { LoginRequest, LoginResponse, MessageResponse, SessionStatusResponse } from "@/types"

export const authApi = {
  login: (data: LoginRequest) =>
    request<LoginResponse>("/auth/login", { method: "POST", body: data }),

  session: () => request<SessionStatusResponse>("/auth/session"),

  logout: () =>
    request<MessageResponse>("/auth/logout", { method: "POST" }),
}
