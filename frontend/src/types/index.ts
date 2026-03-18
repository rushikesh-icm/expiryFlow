export interface ConfigExistsResponse {
  exists: boolean
  client_id: string | null
}

export interface ConfigCreate {
  client_id: string
  api_key: string
  api_secret: string
}

export interface ConfigResponse {
  client_id: string
  api_key_masked: string
  api_secret_masked: string
  created_at: string
  updated_at: string
}

export interface LoginRequest {
  pin: string
  totp: string
}

export interface LoginResponse {
  dhan_client_id: string
  dhan_client_name: string
  access_token: string
  expiry_time: string
}

export interface SessionStatusResponse {
  active: boolean
  dhan_client_id: string | null
  dhan_client_name: string | null
  expiry_time: string | null
  is_expired: boolean
}

export interface MessageResponse {
  message: string
}
