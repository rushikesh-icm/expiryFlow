import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { downloadsApi } from "@/api/downloads"
import { useDownloadStore } from "@/store/download-store"
import { toast } from "sonner"

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  running: "secondary",
  completed: "default",
  failed: "destructive",
  cancelled: "destructive",
}

export function DownloadProgress() {
  const { activeJob, isDownloading } = useDownloadStore()

  if (!activeJob) return null

  const percent = activeJob.total_requests > 0
    ? Math.round((activeJob.completed_requests / activeJob.total_requests) * 100)
    : 0

  const allSkipped =
    activeJob.status === "completed" &&
    activeJob.skipped_requests > 0 &&
    activeJob.rows_downloaded === 0

  const handleCancel = async () => {
    try {
      await downloadsApi.cancel(activeJob.job_id)
      toast.success("Cancellation requested")
    } catch {
      toast.error("Failed to cancel")
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Download Progress</CardTitle>
        <Badge variant={STATUS_VARIANT[activeJob.status] || "secondary"}>
          {activeJob.status}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Progress value={percent} className="h-2" />
        {allSkipped ? (
          <p className="text-sm text-muted-foreground">
            All {activeJob.skipped_requests} requests skipped — data already
            exists in DuckDB
          </p>
        ) : (
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>
              Requests: {activeJob.completed_requests}/{activeJob.total_requests}
            </span>
            <span>Rows: {activeJob.rows_downloaded.toLocaleString()}</span>
            {activeJob.skipped_requests > 0 && (
              <span>
                Skipped: {activeJob.skipped_requests} (already existed)
              </span>
            )}
            {activeJob.failed_requests > 0 && (
              <span className="text-destructive">
                Failed: {activeJob.failed_requests}
              </span>
            )}
          </div>
        )}
        {activeJob.error_message && (
          <p className="text-sm text-destructive">{activeJob.error_message}</p>
        )}
        {isDownloading() && (
          <Button variant="outline" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
