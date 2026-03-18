import { useAuthStore } from "@/store/auth-store"
import { ExpiryCountdown } from "@/components/expiry-countdown"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Futures Data</CardTitle>
            <CardDescription>Coming in Phase 2</CardDescription>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Options Data</CardTitle>
            <CardDescription>Coming in Phase 2</CardDescription>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expiry Calendar</CardTitle>
            <CardDescription>Coming in Phase 2</CardDescription>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
