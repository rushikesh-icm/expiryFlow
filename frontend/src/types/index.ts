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

// --- Download types ---
export interface DownloadRequest {
  underlying_scrip: string
  exchange_segment: string
  instrument: string
  security_id: number
  option_type: string
  expiry_flag: string
  expiry_code: number
  strike_range: number
  interval: string
  from_date: string
  to_date: string
}

export interface DownloadProgress {
  job_id: string
  status: "pending" | "running" | "completed" | "failed" | "cancelled"
  total_requests: number
  completed_requests: number
  skipped_requests: number
  failed_requests: number
  rows_downloaded: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
}

export interface DownloadHistoryItem {
  underlying_scrip: string
  expiry_date: string
  strike_price: number
  option_type: string
  from_date: string
  to_date: string
  row_count: number
  downloaded_at: string
}

export interface DownloadHistoryResponse {
  items: DownloadHistoryItem[]
  total: number
}

export interface RateLimitStatus {
  requests_today: number
  daily_limit: number
  daily_remaining: number
}
