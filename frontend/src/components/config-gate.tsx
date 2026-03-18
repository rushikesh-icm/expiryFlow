import { useEffect, useState } from "react"
import { Navigate } from "react-router-dom"
import { configApi } from "@/api/config"
import { authApi } from "@/api/auth"
import { useConfigStore } from "@/store/config-store"
import { useAuthStore } from "@/store/auth-store"
import { Skeleton } from "@/components/ui/skeleton"

export function ConfigGate() {
  const [loading, setLoading] = useState(true)
  const { configExists, setConfigStatus } = useConfigStore()
  const { isAuthenticated, setAuth } = useAuthStore()

  useEffect(() => {
    async function check() {
      try {
        const configResult = await configApi.checkExists()
        setConfigStatus(configResult.exists, configResult.client_id)

        if (configResult.exists) {
          const sessionResult = await authApi.session()
          if (sessionResult.active && !sessionResult.is_expired) {
            setAuth(
              "active",
              sessionResult.expiry_time || "",
              sessionResult.dhan_client_name || "",
              sessionResult.dhan_client_id || ""
            )
          }
        }
      } catch {
        setConfigStatus(false)
      } finally {
        setLoading(false)
      }
    }
    check()
  }, [setConfigStatus, setAuth])

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="flex flex-col gap-4 w-80">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    )
  }

  if (!configExists) {
    return <Navigate to="/setup" replace />
  }

  if (isAuthenticated()) {
    return <Navigate to="/dashboard" replace />
  }

  return <Navigate to="/login" replace />
}
