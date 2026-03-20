import { useEffect, useState, useRef } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  backtestApi,
  type BacktestRequest,
  type BacktestResult,
  type BacktestTrade,
} from "@/api/backtest"
import { request } from "@/api/client"
import {
  createChart, ColorType, LineStyle, type IChartApi,
} from "lightweight-charts"
// @ts-expect-error v5 runtime export
import { LineSeries } from "lightweight-charts"

interface UnderlyingMeta {
  security_id: number
  exchange_segment: string
  instrument: string
  strike_step: number
}

const INTERVALS = [
  { value: "1", label: "1 min" },
  { value: "5", label: "5 min" },
  { value: "15", label: "15 min" },
]

function fmt(n: number | null | undefined, d = 2) {
  if (n == null) return "-"
  return n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d })
}

function fmtTime(iso: string) {
  return iso.replace("T", " ").slice(0, 16)
}

function toChartTime(iso: string): number {
  const utc = iso.endsWith("Z") ? iso : iso + "Z"
  return Math.floor(new Date(utc).getTime() / 1000)
}

// --- Lightweight chart component ---
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
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }

    const chart = createChart(ref.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#9ca3af", fontSize: 12 },
      grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.1)" },
      timeScale: { borderColor: "rgba(255,255,255,0.1)", timeVisible: true, secondsVisible: false },
      crosshair: { horzLine: { labelBackgroundColor: "#374151" }, vertLine: { labelBackgroundColor: "#374151" } },
    })
    chartRef.current = chart

    const series = chart.addSeries(LineSeries, {
      color, lineWidth: 2, title, priceLineVisible: false, lastValueVisible: true,
    })
    series.setData(
      data.map((d) => ({ time: toChartTime(d.timestamp) as any, value: d[valueKey] }))
    )
    chart.timeScale().fitContent()

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) chart.applyOptions({ width: e.contentRect.width, height: e.contentRect.height })
    })
    ro.observe(ref.current)
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null }
  }, [data, color, title, valueKey])

  return <div ref={ref} style={{ height }} className="w-full" />
}

// --- Metric card ---
function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  )
}

export function BacktestPage() {
  const [underlyings, setUnderlyings] = useState<Record<string, UnderlyingMeta>>({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BacktestResult | null>(null)

  const today = new Date().toISOString().split("T")[0]
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]

  const [form, setForm] = useState({
    underlying_scrip: "NIFTY",
    expiry_flag: "WEEK",
    expiry_code: "1",
    from_date: weekAgo,
    to_date: today,
    interval: "1",
    capital: "1000000",
    sizing_mode: "fixed_lots",
    lots: "1",
    fixed_money: "",
    fixed_percentage: "",
  })

  useEffect(() => {
    request<{ underlyings: Record<string, UnderlyingMeta> }>("/underlyings").then((r) =>
      setUnderlyings(r.underlyings)
    )
  }, [])

  const handleRun = async () => {
    setLoading(true)
    setResult(null)
    try {
      const req: BacktestRequest = {
        underlying_scrip: form.underlying_scrip,
        expiry_flag: form.expiry_flag,
        expiry_code: parseInt(form.expiry_code),
        from_date: form.from_date,
        to_date: form.to_date,
        interval: form.interval,
        capital: parseFloat(form.capital),
        sizing_mode: form.sizing_mode,
        lots: parseInt(form.lots) || 1,
        fixed_money: form.fixed_money ? parseFloat(form.fixed_money) : null,
        fixed_percentage: form.fixed_percentage ? parseFloat(form.fixed_percentage) : null,
      }
      const res = await backtestApi.run(req)
      // Number the trades
      res.trades.forEach((t, i) => (t.trade_no = i + 1))
      setResult(res)
    } catch (err: any) {
      toast.error(err?.detail || "Backtest failed")
    } finally {
      setLoading(false)
    }
  }

  const m = result?.metrics

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dynamic Straddle Backtest</h1>
        <p className="text-sm text-muted-foreground">
          ATM straddle with rolling — exit and re-enter when ATM strike changes
        </p>
      </div>

      {/* --- Config --- */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Underlying</span>
              <Select value={form.underlying_scrip} onValueChange={(v) => setForm({ ...form, underlying_scrip: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(underlyings).map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Expiry</span>
              <Select value={form.expiry_flag} onValueChange={(v) => setForm({ ...form, expiry_flag: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEK">Weekly</SelectItem>
                  <SelectItem value="MONTH">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Expiry Code</span>
              <Select value={form.expiry_code} onValueChange={(v) => setForm({ ...form, expiry_code: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Current</SelectItem>
                  <SelectItem value="2">Next</SelectItem>
                  <SelectItem value="3">Far</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Interval</span>
              <Select value={form.interval} onValueChange={(v) => setForm({ ...form, interval: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERVALS.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">From</span>
              <Input type="date" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">To</span>
              <Input type="date" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} />
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Capital</span>
              <Input type="number" value={form.capital} onChange={(e) => setForm({ ...form, capital: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Sizing</span>
              <Select value={form.sizing_mode} onValueChange={(v) => setForm({ ...form, sizing_mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_lots">Fixed Lots</SelectItem>
                  <SelectItem value="fixed_money">Fixed Money</SelectItem>
                  <SelectItem value="fixed_percentage">Fixed %</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.sizing_mode === "fixed_lots" && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Lots</span>
                <Input type="number" min="1" value={form.lots} onChange={(e) => setForm({ ...form, lots: e.target.value })} />
              </div>
            )}
            {form.sizing_mode === "fixed_money" && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Amount</span>
                <Input type="number" value={form.fixed_money} onChange={(e) => setForm({ ...form, fixed_money: e.target.value })} />
              </div>
            )}
            {form.sizing_mode === "fixed_percentage" && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">% of Capital</span>
                <Input type="number" value={form.fixed_percentage} onChange={(e) => setForm({ ...form, fixed_percentage: e.target.value })} />
              </div>
            )}
          </div>

          <Button className="mt-4 w-full" onClick={handleRun} disabled={loading}>
            {loading ? "Running backtest..." : "Run Backtest"}
          </Button>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      )}

      {/* --- Results --- */}
      {m && result && (
        <>
          {/* Metrics */}
          <Card>
            <CardHeader className="border-b"><CardTitle>Performance Summary</CardTitle></CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-3 gap-6 sm:grid-cols-4 lg:grid-cols-6">
                <Metric label="Net P&L" value={`₹${fmt(m.net_pnl)}`} sub={`${m.return_pct}%`} />
                <Metric label="Win Rate" value={`${m.win_rate}%`} sub={`${m.winning_trades}W / ${m.losing_trades}L`} />
                <Metric label="Total Trades" value={String(m.total_trades)} />
                <Metric label="Profit Factor" value={fmt(m.profit_factor)} />
                <Metric label="Max Drawdown" value={`${m.max_drawdown_pct}%`} sub={`₹${fmt(m.max_drawdown)}`} />
                <Metric label="Sharpe" value={fmt(m.sharpe_ratio)} />
                <Metric label="Avg Win" value={`₹${fmt(m.avg_win)}`} />
                <Metric label="Avg Loss" value={`₹${fmt(m.avg_loss)}`} />
                <Metric label="Largest Win" value={`₹${fmt(m.largest_win)}`} />
                <Metric label="Largest Loss" value={`₹${fmt(m.largest_loss)}`} />
                <Metric label="Lots" value={`${m.lots} (${m.quantity} qty)`} />
                <Metric label="Avg Daily P&L" value={`₹${fmt(m.avg_daily_pnl)}`} />
              </div>
              <Separator className="my-4" />
              <div className="grid grid-cols-3 gap-6 sm:grid-cols-4 lg:grid-cols-7">
                <Metric label="Total Turnover" value={`₹${fmt(m.total_turnover)}`} />
                <Metric label="Total Charges" value={`₹${fmt(m.total_commissions)}`} />
                <Metric label="Brokerage" value={`₹${fmt(m.brokerage_total)}`} />
                <Metric label="STT" value={`₹${fmt(m.stt_total)}`} />
                <Metric label="Exchange Txn" value={`₹${fmt(m.exchange_txn_total)}`} />
                <Metric label="GST" value={`₹${fmt(m.gst_total)}`} />
                <Metric label="Stamp Duty" value={`₹${fmt(m.stamp_duty_total)}`} />
              </div>
            </CardContent>
          </Card>

          {/* Equity Curve */}
          <Card>
            <CardHeader className="border-b"><CardTitle>Equity Curve</CardTitle></CardHeader>
            <CardContent className="p-2">
              <LineChart data={result.equity_curve} color="#22c55e" title="Equity" valueKey="equity" height={350} />
            </CardContent>
          </Card>

          {/* Drawdown */}
          <Card>
            <CardHeader className="border-b"><CardTitle>Drawdown</CardTitle></CardHeader>
            <CardContent className="p-2">
              <LineChart data={result.drawdown_curve} color="#ef4444" title="Drawdown %" valueKey="drawdown_pct" height={250} />
            </CardContent>
          </Card>

          {/* Trade Table */}
          <Card>
            <CardHeader className="border-b"><CardTitle>Trade Log ({result.trades.length} trades)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {["#","Entry","Exit","Strike","Spot In","Spot Out","CE In","PE In","CE Out","PE Out","Premium In","Premium Out","Lots","Margin","Turnover","Charges","Gross P&L","Net P&L"].map((h) => (
                        <TableHead key={h} className="sticky top-0 bg-card text-right first:text-left whitespace-nowrap">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.trades.map((t) => (
                      <TableRow key={t.trade_no} className={t.net_pnl >= 0 ? "" : "text-red-400"}>
                        <TableCell>{t.trade_no}</TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{fmtTime(t.entry_time)}</TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{fmtTime(t.exit_time)}</TableCell>
                        <TableCell className="text-right">{t.strike_price}</TableCell>
                        <TableCell className="text-right">{fmt(t.spot_at_entry)}</TableCell>
                        <TableCell className="text-right">{fmt(t.spot_at_exit)}</TableCell>
                        <TableCell className="text-right">{fmt(t.ce_entry)}</TableCell>
                        <TableCell className="text-right">{fmt(t.pe_entry)}</TableCell>
                        <TableCell className="text-right">{fmt(t.ce_exit)}</TableCell>
                        <TableCell className="text-right">{fmt(t.pe_exit)}</TableCell>
                        <TableCell className="text-right">{fmt(t.entry_premium)}</TableCell>
                        <TableCell className="text-right">{fmt(t.exit_premium)}</TableCell>
                        <TableCell className="text-right">{t.lots}</TableCell>
                        <TableCell className="text-right">{fmt(t.margin_blocked, 0)}</TableCell>
                        <TableCell className="text-right">{fmt(t.turnover, 0)}</TableCell>
                        <TableCell className="text-right">{fmt(t.total_charges)}</TableCell>
                        <TableCell className="text-right">{fmt(t.gross_pnl)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(t.net_pnl)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Daily P&L */}
          <Card>
            <CardHeader className="border-b"><CardTitle>Daily P&L</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {["Date","Trades","Gross P&L","Commissions","Net P&L","Cumulative","Drawdown"].map((h) => (
                        <TableHead key={h} className="sticky top-0 bg-card text-right first:text-left">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.daily_pnl.map((d) => (
                      <TableRow key={d.date} className={d.net_pnl >= 0 ? "" : "text-red-400"}>
                        <TableCell className="font-mono">{d.date}</TableCell>
                        <TableCell className="text-right">{d.trades}</TableCell>
                        <TableCell className="text-right">{fmt(d.gross_pnl)}</TableCell>
                        <TableCell className="text-right">{fmt(d.commissions)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(d.net_pnl)}</TableCell>
                        <TableCell className="text-right">{fmt(d.cumulative_pnl)}</TableCell>
                        <TableCell className="text-right">{fmt(d.drawdown)}</TableCell>
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
