import { Outlet, useNavigate } from "react-router-dom"
import { AppLogo } from "@/components/app-logo"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth-store"
import { authApi } from "@/api/auth"

export function DashboardLayout() {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore logout errors
    }
    clearAuth()
    navigate("/login", { replace: true })
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <AppLogo />
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Logout
        </Button>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
