import { Outlet } from "react-router-dom"
import { AppLogo } from "@/components/app-logo"

export function AuthLayout() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 p-4">
      <AppLogo />
      <Outlet />
    </div>
  )
}
