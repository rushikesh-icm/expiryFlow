import { request } from "./client"
import type {
  StraddleUnderlyingsResponse,
  StraddleDatesResponse,
  StraddleDataResponse,
} from "@/types"

export const straddleApi = {
  underlyings: () =>
    request<StraddleUnderlyingsResponse>("/straddle/underlyings"),

  dates: (underlyingScrip: string, expiryFlag: string, expiryCode: number) =>
    request<StraddleDatesResponse>(
      `/straddle/dates?underlying_scrip=${encodeURIComponent(underlyingScrip)}&expiry_flag=${encodeURIComponent(expiryFlag)}&expiry_code=${expiryCode}`
    ),

  data: (underlyingScrip: string, date: string, expiryFlag: string, expiryCode: number) =>
    request<StraddleDataResponse>(
      `/straddle/data?underlying_scrip=${encodeURIComponent(underlyingScrip)}&date=${encodeURIComponent(date)}&expiry_flag=${encodeURIComponent(expiryFlag)}&expiry_code=${expiryCode}`
    ),
}
