const API_BASE = "/api"

interface RequestOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
    this.detail = detail
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {} } = options

  const config: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  }

  if (body) {
    config.body = JSON.stringify(body)
  }

  const response = await fetch(`${API_BASE}${path}`, config)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: "Request failed" }))
    throw new ApiError(response.status, errorData.detail || "Request failed")
  }

  return response.json()
}

export { request, ApiError }
