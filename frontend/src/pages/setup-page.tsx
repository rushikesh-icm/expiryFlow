import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
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
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { configApi } from "@/api/config"
import { useConfigStore } from "@/store/config-store"
import { ApiError } from "@/api/client"

export function SetupPage() {
  const navigate = useNavigate()
  const setConfigStatus = useConfigStore((s) => s.setConfigStatus)
  const [isPending, setIsPending] = useState(false)
  const [form, setForm] = useState({
    client_id: "",
    api_key: "",
    api_secret: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.client_id.trim() || !form.api_key.trim() || !form.api_secret.trim()) {
      toast.error("All fields are required")
      return
    }

    setIsPending(true)
    try {
      const exists = await configApi.checkExists().catch(() => ({ exists: false, client_id: null }))
      if (exists.exists) {
        await configApi.update(form)
      } else {
        await configApi.save(form)
      }
      setConfigStatus(true, form.client_id)
      toast.success("Configuration saved successfully")
      navigate("/login", { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.detail)
      } else {
        toast.error("Failed to save configuration")
      }
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Initial Setup</CardTitle>
        <CardDescription>
          Connect your Dhan trading account to get started.
          You can change these settings later.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="client_id">Client ID</FieldLabel>
              <Input
                id="client_id"
                placeholder="Your Dhan Client ID"
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                autoFocus
              />
              <FieldDescription>
                Found in your Dhan account dashboard
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="api_key">API Key</FieldLabel>
              <Input
                id="api_key"
                placeholder="API Key from Dhan Developer Portal"
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="api_secret">API Secret</FieldLabel>
              <Input
                id="api_secret"
                type="password"
                placeholder="API Secret"
                value={form.api_secret}
                onChange={(e) => setForm({ ...form, api_secret: e.target.value })}
              />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Spinner data-icon="inline-start" />}
            Save Configuration
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
