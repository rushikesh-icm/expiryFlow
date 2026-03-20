import { Outlet, useNavigate, useLocation, Link } from "react-router-dom"
import { AppLogo } from "@/components/app-logo"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth-store"
import { authApi } from "@/api/auth"
import { cn } from "@/lib/utils"
import { GlobalDownloadIndicator } from "@/components/global-download-indicator"

const NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Straddle", path: "/straddle" },
]

export function DashboardLayout() {
  const navigate = useNavigate()
  const location = useLocation()
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
        <div className="flex items-center gap-6">
          <AppLogo />
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent",
                  location.pathname === item.path
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <GlobalDownloadIndicator />
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
