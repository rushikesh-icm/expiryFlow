import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { request } from "@/api/client"
import type { BacktestRequest, BacktestResult } from "@/api/backtest"
import { createChart, ColorType, type IChartApi } from "lightweight-charts"
import { LineSeries } from "lightweight-charts"

interface UnderlyingMeta {
  security_id: number
  exchange_segment: string
  instrument: string
  strike_step: number
}

type SpeechRecognitionType = typeof window & {
  SpeechRecognition: any
  webkitSpeechRecognition: any
}

const getSpeechRecognition = () => {
  const w = window as SpeechRecognitionType
  return w.SpeechRecognition || w.webkitSpeechRecognition
}

type SortTarget = "trades" | "daily_pnl"
type SortOrder = "asc" | "desc"

type SortSpec = { target: SortTarget; field: string; order: SortOrder } | null

type ChatMessage =
  | { role: "user"; content: string }
  | {
      role: "assistant"
      content: string
      payload?: BacktestRequest
      meta?: any
    }

function fmt(n: number | null | undefined, d = 2) {
  if (n == null || Number.isNaN(n)) return "-"
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
}

function fmtTime(iso: string) {
  return iso.replace("T", " ").slice(0, 16)
}

function toChartTime(iso: string): number {
  const utc = iso.endsWith("Z") ? iso : iso + "Z"
  return Math.floor(new Date(utc).getTime() / 1000)
}

function LineChart({
  data,
  color,
  title,
  height = 300,
  valueKey,
}: {
  data: { timestamp: string; [k: string]: any }[]
  color: string
  title: string
  height?: number
  valueKey: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!ref.current || data.length === 0) return
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const chart = createChart(ref.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.1)" },
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        horzLine: { labelBackgroundColor: "#374151" },
        vertLine: { labelBackgroundColor: "#374151" },
      },
    })
    chartRef.current = chart

    const series = chart.addSeries(LineSeries, {
      color,
      lineWidth: 2,
      title,
      priceLineVisible: false,
      lastValueVisible: true,
    })
    series.setData(
      data.map((d) => ({
        time: toChartTime(d.timestamp) as any,
        value: d[valueKey],
      }))
    )
    chart.timeScale().fitContent()

    const ro = new ResizeObserver((entries) => {
      for (const e of entries)
        chart.applyOptions({
          width: e.contentRect.width,
          height: e.contentRect.height,
        })
    })
    ro.observe(ref.current)
    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [data, color, title, valueKey])

  return <div ref={ref} style={{ height }} className="w-full" />
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  )
}

function safeParseDate(s: string): string | null {
  // expects YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return s
}

function sortArray<T extends Record<string, any>>(
  arr: T[],
  spec: SortSpec
): T[] {
  if (!spec) return arr
  const { field, order } = spec
  const dir = order === "asc" ? 1 : -1
  const copy = [...arr]
  copy.sort((a, b) => {
    const av = a[field]
    const bv = b[field]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir
    return String(av).localeCompare(String(bv)) * dir
  })
  return copy
}

export function AiBacktesterPage() {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const [underlyings, setUnderlyings] = useState<
    Record<string, UnderlyingMeta>
  >({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [sortSpec, setSortSpec] = useState<SortSpec>(null)
  const [lastPayload, setLastPayload] = useState<BacktestRequest | null>(null)
  const [lastMeta, setLastMeta] = useState<any>(null)

  const today = new Date().toISOString().split("T")[0]
  const weekAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .split("T")[0]

  const defaults: BacktestRequest = useMemo(
    () => ({
      underlying_scrip: "NIFTY",
      expiry_flag: "WEEK",
      expiry_code: 1,
      from_date: weekAgo,
      to_date: today,
      interval: "1",
      capital: 1_000_000,
      sizing_mode: "fixed_lots",
      lots: 1,
      fixed_money: null,
      fixed_percentage: null,
      roll_check_minutes: null,
      spot_move_pct: null,
    }),
    [today, weekAgo]
  )

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")

  useEffect(() => {
    request<{ underlyings: Record<string, UnderlyingMeta> }>(
      "/underlyings"
    ).then((r) => setUnderlyings(r.underlyings))
  }, [])
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  const handleRunFromText = async () => {
    const text = input.trim()
    if (!text) return

    setMessages((m) => [...m, { role: "user", content: text }])
    setInput("")
    setLoading(true)
    setResult(null)

    try {
      const resp = await request<{
        payload: BacktestRequest
        meta: any
        result: BacktestResult
      }>("/ai-backtest/run", {
        method: "POST",
        body: {
          prompt: text,
          defaults,
          response: { sort: null },
        },
      })

      setLastPayload(resp.payload)
      setLastMeta(resp.meta || null)
      setSortSpec(resp.meta?.sort || null)

      resp.result.trades.forEach((t, i) => (t.trade_no = i + 1))
      setResult(resp.result)
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `Backtest completed.`,
          payload: resp.payload,
          meta: resp.meta,
        },
      ])
    } catch (err: any) {
      const msg = err?.detail || err?.message || "AI backtest failed"
      setMessages((m) => [...m, { role: "assistant", content: msg }])
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const sortedTrades = useMemo(() => {
    if (!result) return []
    const spec = sortSpec?.target === "trades" ? sortSpec : null
    return sortArray(result.trades as any, spec as any)
  }, [result, sortSpec])

  const sortedDaily = useMemo(() => {
    if (!result) return []
    const spec = sortSpec?.target === "daily_pnl" ? sortSpec : null
    return sortArray(result.daily_pnl as any, spec as any)
  }, [result, sortSpec])

  const m = result?.metrics

  const applied = useMemo(() => {
    if (!lastPayload) return []
    const sources = lastMeta?.field_sources || {}
    const keys = Object.keys(lastPayload) as (keyof BacktestRequest)[]
    return keys.map((k) => ({
      key: String(k),
      value: (lastPayload as any)[k],
      source: sources[String(k)] || "default",
    }))
  }, [lastPayload, lastMeta])

  const handleMic = () => {
    const SpeechRecognition = getSpeechRecognition()

    if (!SpeechRecognition) {
      toast.error("Mic not supported in this browser")
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition

    recognition.lang = "en-IN"
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => setIsListening(true)

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setInput((prev) => (prev ? prev + " " + transcript : transcript))
    }

    recognition.onerror = () => {
      toast.error("Voice recognition failed")
      setIsListening(false)
    }

    recognition.onend = () => setIsListening(false)

    recognition.start()
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">AI Backtester</h1>
        <p className="text-sm text-muted-foreground">
          Describe your strategy and settings in chat. We’ll convert it into a
          backtest payload and run it.
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle>Chat</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-3">
            <div className="max-h-[260px] overflow-auto rounded-md border p-3">
              {messages.length === 0 && (
                <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  Tip: Try{" "}
                  <span className="font-mono">
                    NIFTY weekly last 7 days interval 1 min capital 10 lakh lots
                    1 spot trigger 0.5%
                  </span>
                </div>
              )}
              <div className="mt-3 flex flex-col gap-3">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={msg.role === "user" ? "text-right" : "text-left"}
                  >
                    <div className="inline-flex max-w-[90%] flex-col gap-2 rounded-lg border bg-card px-3 py-2">
                      <div className="text-xs text-muted-foreground">
                        {msg.role === "user" ? "You" : "Assistant"}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">
                        {msg.content}
                      </div>
                      {"meta" in msg && msg.meta?.warnings?.length > 0 && (
                        <div className="text-xs text-amber-500">
                          {msg.meta.warnings.map((w: string, i: number) => (
                            <div key={i}>{w}</div>
                          ))}
                        </div>
                      )}
                      {"payload" in msg && msg.payload && (
                        <details className="text-left">
                          <summary className="cursor-pointer text-xs text-muted-foreground">
                            Applied payload
                          </summary>
                          <pre className="mt-2 overflow-auto rounded-md bg-muted p-2 text-xs">
                            {JSON.stringify(msg.payload, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="text-left">
                    <div className="inline-flex max-w-[90%] flex-col gap-2 rounded-lg border bg-card px-3 py-2">
                      <div className="text-xs text-muted-foreground">
                        Assistant
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Running backtest…
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {lastPayload && (
              <div className="rounded-md border p-3">
                <div className="text-sm font-medium">Applied filters</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {applied.map((a) => (
                    <div
                      key={a.key}
                      className={
                        "rounded-full border px-2 py-1 text-xs " +
                        (a.source === "prompt"
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground")
                      }
                      title={
                        a.source === "prompt"
                          ? "From prompt"
                          : "Unable to read prompt; default value used"
                      }
                    >
                      <span className="font-medium">{a.key}</span>
                      <span className="mx-1">=</span>
                      <span className="font-mono">
                        {a.value === null ? "null" : String(a.value)}
                      </span>
                      {a.source !== "prompt" && (
                        <span className="ml-1">(default)</span>
                      )}
                    </div>
                  ))}
                </div>
                {lastMeta?.warnings?.length > 0 && (
                  <div className="mt-2 text-xs text-amber-500">
                    {lastMeta.warnings.map((w: string, i: number) => (
                      <div key={i}>{w}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your configuration in plain English…"
                  className="min-h-[90px] w-full rounded-md border bg-transparent px-3 py-2 pr-12 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />

                <button
                  type="button"
                  onClick={handleMic}
                  className={`absolute top-2 right-2 rounded-full border p-2 ${
                    isListening
                      ? "animate-pulse bg-red-500 text-white"
                      : "bg-muted"
                  }`}
                >
                  🎤
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  Note: mention weekly/monthly, interval, capital, lots, spot
                  trigger, roll every, and optional sort.
                </div>
                <Button
                  onClick={handleRunFromText}
                  disabled={loading || !input.trim()}
                >
                  {loading ? "Running..." : "Run"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Running backtest…
          </CardContent>
        </Card>
      )}

      {m && result && (
        <>
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Performance Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-3 gap-6 sm:grid-cols-4 lg:grid-cols-6">
                <Metric
                  label="Net P&L"
                  value={`₹${fmt(m.net_pnl)}`}
                  sub={`${m.return_pct}%`}
                />
                <Metric
                  label="Win Rate"
                  value={`${m.win_rate}%`}
                  sub={`${m.winning_trades}W / ${m.losing_trades}L`}
                />
                <Metric label="Total Trades" value={String(m.total_trades)} />
                <Metric label="Profit Factor" value={fmt(m.profit_factor)} />
                <Metric
                  label="Max Drawdown"
                  value={`${m.max_drawdown_pct}%`}
                  sub={`₹${fmt(m.max_drawdown)}`}
                />
                <Metric label="Sharpe" value={fmt(m.sharpe_ratio)} />
                <Metric label="Lots" value={`${m.lots} (${m.quantity} qty)`} />
                <Metric
                  label="Total Charges"
                  value={`₹${fmt(m.total_commissions)}`}
                />
              </div>
              <Separator className="my-4" />
              <div className="grid grid-cols-3 gap-6 sm:grid-cols-4 lg:grid-cols-7">
                <Metric
                  label="Total Turnover"
                  value={`₹${fmt(m.total_turnover)}`}
                />
                <Metric
                  label="Brokerage"
                  value={`₹${fmt(m.brokerage_total)}`}
                />
                <Metric label="STT" value={`₹${fmt(m.stt_total)}`} />
                <Metric
                  label="Exchange Txn"
                  value={`₹${fmt(m.exchange_txn_total)}`}
                />
                <Metric label="GST" value={`₹${fmt(m.gst_total)}`} />
                <Metric
                  label="Stamp Duty"
                  value={`₹${fmt(m.stamp_duty_total)}`}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Equity Curve</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <LineChart
                data={result.equity_curve}
                color="#22c55e"
                title="Equity"
                valueKey="equity"
                height={350}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Drawdown</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <LineChart
                data={result.drawdown_curve}
                color="#ef4444"
                title="Drawdown %"
                valueKey="drawdown_pct"
                height={250}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Trade Log ({sortedTrades.length} trades)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {[
                        "#",
                        "Entry",
                        "Exit",
                        "Strike",
                        "Spot In",
                        "Spot Out",
                        "CE In",
                        "PE In",
                        "CE Out",
                        "PE Out",
                        "Premium In",
                        "Premium Out",
                        "Lots",
                        "Margin",
                        "Turnover",
                        "Charges",
                        "Gross P&L",
                        "Net P&L",
                      ].map((h) => (
                        <TableHead
                          key={h}
                          className="sticky top-0 bg-card text-right whitespace-nowrap first:text-left"
                        >
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTrades.map((t) => (
                      <TableRow
                        key={t.trade_no}
                        className={t.net_pnl >= 0 ? "" : "text-red-400"}
                      >
                        <TableCell>{t.trade_no}</TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {fmtTime(t.entry_time)}
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {fmtTime(t.exit_time)}
                        </TableCell>
                        <TableCell className="text-right">
                          {t.strike_price}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(t.spot_at_entry)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(t.spot_at_exit)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(t.ce_entry)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(t.pe_entry)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(t.ce_exit)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(t.pe_exit)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(t.entry_premium)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(t.exit_premium)}
                        </TableCell>
                        <TableCell className="text-right">{t.lots}</TableCell>
                        <TableCell className="text-right">
                          {fmt(t.margin_blocked, 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(t.turnover, 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(t.total_charges)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(t.gross_pnl)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {fmt(t.net_pnl)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Daily P&L</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {[
                        "Date",
                        "Trades",
                        "Gross P&L",
                        "Commissions",
                        "Net P&L",
                        "Cumulative",
                        "Drawdown",
                      ].map((h) => (
                        <TableHead
                          key={h}
                          className="sticky top-0 bg-card text-right first:text-left"
                        >
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedDaily.map((d) => (
                      <TableRow
                        key={d.date}
                        className={d.net_pnl >= 0 ? "" : "text-red-400"}
                      >
                        <TableCell className="font-mono">{d.date}</TableCell>
                        <TableCell className="text-right">{d.trades}</TableCell>
                        <TableCell className="text-right">
                          {fmt(d.gross_pnl)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(d.commissions)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {fmt(d.net_pnl)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(d.cumulative_pnl)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(d.drawdown)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
