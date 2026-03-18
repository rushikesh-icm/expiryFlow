import { useAuthStore } from "@/store/auth-store"
import { useCountdown } from "@/hooks/use-countdown"
import { Badge } from "@/components/ui/badge"
import { useNavigate } from "react-router-dom"
import { useEffect } from "react"

export function ExpiryCountdown() {
  const tokenExpiry = useAuthStore((s) => s.tokenExpiry)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()
  const { hours, minutes, seconds, isExpired } = useCountdown(tokenExpiry)

  useEffect(() => {
    if (isExpired && tokenExpiry) {
      clearAuth()
      navigate("/login", { replace: true })
    }
  }, [isExpired, tokenExpiry, clearAuth, navigate])

  if (isExpired) {
    return <Badge variant="destructive">Session Expired</Badge>
  }

  const pad = (n: number) => String(n).padStart(2, "0")

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Token expires in</span>
      <Badge variant="secondary" className="font-mono tabular-nums">
        {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </Badge>
    </div>
  )
}
