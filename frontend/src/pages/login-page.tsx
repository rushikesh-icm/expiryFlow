import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { authApi } from "@/api/auth"
import { configApi } from "@/api/config"
import { useAuthStore } from "@/store/auth-store"
import { useConfigStore } from "@/store/config-store"
import { ApiError } from "@/api/client"

export function LoginPage() {
  const navigate = useNavigate()
  const { clientId, setConfigStatus } = useConfigStore()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [isPending, setIsPending] = useState(false)
  const [loading, setLoading] = useState(!clientId)
  const [form, setForm] = useState({
    pin: "",
    totp: "",
  })

  useEffect(() => {
    if (clientId) return
    async function fetchConfig() {
      try {
        const result = await configApi.checkExists()
        if (result.exists) {
          setConfigStatus(true, result.client_id)
        } else {
          navigate("/setup", { replace: true })
        }
      } catch {
        navigate("/setup", { replace: true })
      } finally {
        setLoading(false)
      }
    }
    fetchConfig()
  }, [clientId, setConfigStatus, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.pin.trim() || !form.totp.trim()) {
      toast.error("PIN and TOTP are required")
      return
    }

    setIsPending(true)
    try {
      const result = await authApi.login(form)
      setAuth(
        result.access_token,
        result.expiry_time,
        result.dhan_client_name,
        result.dhan_client_id
      )
      toast.success(`Welcome, ${result.dhan_client_name}`)
      navigate("/dashboard", { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.detail)
      } else {
        toast.error("Authentication failed")
      }
    } finally {
      setIsPending(false)
    }
  }

  if (loading) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Login to Dhan</CardTitle>
        <CardDescription>
          Authenticate with your PIN and TOTP code.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="client_id">Client ID</FieldLabel>
              <Input
                id="client_id"
                value={clientId || ""}
                readOnly
                className="bg-muted"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pin">PIN</FieldLabel>
              <Input
                id="pin"
                type="password"
                placeholder="Trading PIN"
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value })}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="totp">TOTP</FieldLabel>
              <Input
                id="totp"
                placeholder="6-digit authenticator code"
                value={form.totp}
                onChange={(e) => setForm({ ...form, totp: e.target.value })}
                maxLength={6}
                inputMode="numeric"
                className="font-mono tracking-widest"
              />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Spinner data-icon="inline-start" />}
            Authenticate
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
