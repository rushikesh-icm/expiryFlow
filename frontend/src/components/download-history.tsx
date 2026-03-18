import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { downloadsApi } from "@/api/downloads"
import type { DownloadHistoryItem } from "@/types"

export function DownloadHistory() {
  const [items, setItems] = useState<DownloadHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = async () => {
    try {
      const result = await downloadsApi.history()
      setItems(result.items)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
    const interval = setInterval(fetchHistory, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Download History</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No downloads yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm"
              >
                <Badge variant="secondary">{item.underlying_scrip}</Badge>
                <span className="font-mono">{item.strike_price}</span>
                <Badge variant="secondary">{item.option_type}</Badge>
                <span className="text-muted-foreground">
                  Exp: {item.expiry_date}
                </span>
                <span className="text-muted-foreground">
                  {item.from_date} to {item.to_date}
                </span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {item.row_count} rows
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
