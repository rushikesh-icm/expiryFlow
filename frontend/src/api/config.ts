import { request } from "./client"
import type { ConfigCreate, ConfigExistsResponse, ConfigResponse } from "@/types"

export const configApi = {
  checkExists: () => request<ConfigExistsResponse>("/config/exists"),

  save: (data: ConfigCreate) =>
    request<ConfigResponse>("/config", { method: "POST", body: data }),

  get: () => request<ConfigResponse>("/config"),

  update: (data: ConfigCreate) =>
    request<ConfigResponse>("/config", { method: "PUT", body: data }),
}
