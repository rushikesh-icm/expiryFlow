import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { downloadsApi } from "@/api/downloads"
import { useDownloadStore } from "@/store/download-store"

export function GlobalDownloadIndicator() {
  const { activeJob, setActiveJob, clearJob, isDownloading } =
    useDownloadStore()
  const recoveryDone = useRef(false)

  // On mount: recover any active backend job (handles refresh / tab switch)
  useEffect(() => {
    if (recoveryDone.current) return
    recoveryDone.current = true

    async function recover() {
      try {
        const active = await downloadsApi.active()
        if (active.length > 0) {
          setActiveJob(active[0])
        } else if (activeJob && isDownloading()) {
          // Store says running but backend says no active jobs — stale
          // Poll once more with the stored job_id to get final status
          try {
            const final = await downloadsApi.progress(activeJob.job_id)
            setActiveJob(final)
          } catch {
            clearJob()
          }
        }
      } catch {
        // not authenticated yet or server down
      }
    }
    recover()
  }, [])

  // Poll while a job is active
  useEffect(() => {
    if (!activeJob || !isDownloading()) return

    const interval = setInterval(async () => {
      try {
        const updated = await downloadsApi.progress(activeJob.job_id)
        setActiveJob(updated)
        if (updated.status === "completed") {
          toast.success(
            `Download completed: ${updated.rows_downloaded.toLocaleString()} rows`
          )
        } else if (updated.status === "failed") {
          toast.error(updated.error_message || "Download failed")
        }
      } catch {
        // ignore transient polling errors
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [activeJob?.job_id, activeJob?.status])

  if (!activeJob) return null

  const running = isDownloading()
  const percent =
    activeJob.total_requests > 0
      ? Math.round(
          (activeJob.completed_requests / activeJob.total_requests) * 100
        )
      : 0

  const handleCancel = async () => {
    try {
      await downloadsApi.cancel(activeJob.job_id)
      toast.success("Cancellation requested")
    } catch {
      toast.error("Failed to cancel")
    }
  }

  // Completed / failed / cancelled — show briefly then allow dismiss
  if (!running) {
    return (
      <div className="flex items-center gap-2">
        <Badge
          variant={
            activeJob.status === "completed" ? "default" : "destructive"
          }
        >
          {activeJob.status}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {activeJob.rows_downloaded.toLocaleString()} rows
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={clearJob}
        >
          Dismiss
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <Badge variant="secondary">downloading</Badge>
      <Progress value={percent} className="h-1.5 w-32" />
      <span className="text-xs tabular-nums text-muted-foreground">
        {activeJob.completed_requests}/{activeJob.total_requests}
      </span>
      <span className="text-xs text-muted-foreground">
        {activeJob.rows_downloaded.toLocaleString()} rows
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={handleCancel}
      >
        Cancel
      </Button>
    </div>
  )
}
