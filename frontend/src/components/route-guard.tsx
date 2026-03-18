import { Navigate, Outlet } from "react-router-dom"
import { useAuthStore } from "@/store/auth-store"

export function RouteGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
