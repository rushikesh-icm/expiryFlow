import { useAuthStore } from "@/store/auth-store"
import { ExpiryCountdown } from "@/components/expiry-countdown"
import { DownloadControls } from "@/components/download-controls"
import { DownloadProgress } from "@/components/download-progress"
import { DownloadHistory } from "@/components/download-history"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

export function DashboardPage() {
  const userName = useAuthStore((s) => s.userName)
  const clientId = useAuthStore((s) => s.clientId)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{userName}</span>
            {clientId && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span className="font-mono">{clientId}</span>
              </>
            )}
            <Separator orientation="vertical" className="h-4" />
            <Badge variant="secondary">Connected</Badge>
          </div>
        </div>
        <ExpiryCountdown />
      </div>

      <Separator />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <DownloadControls />
          <DownloadProgress />
        </div>
        <DownloadHistory />
      </div>
    </div>
  )
}
