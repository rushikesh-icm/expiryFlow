import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { AuthLayout } from "@/layouts/auth-layout"
import { DashboardLayout } from "@/layouts/dashboard-layout"
import { ConfigGate } from "@/components/config-gate"
import { RouteGuard } from "@/components/route-guard"
import { SetupPage } from "@/pages/setup-page"
import { LoginPage } from "@/pages/login-page"
import { DashboardPage } from "@/pages/dashboard-page"
import { StraddlePage } from "@/pages/straddle-page"

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ConfigGate />} />

        <Route element={<AuthLayout />}>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<RouteGuard />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/straddle" element={<StraddlePage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}

export default App
