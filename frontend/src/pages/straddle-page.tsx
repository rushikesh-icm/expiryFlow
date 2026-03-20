import { useEffect, useState, useCallback, useRef } from "react"
import { straddleApi } from "@/api/straddle"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import type { StraddleRow } from "@/types"
import {
  createChart,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts"

// @ts-expect-error v5 exports LineSeries as runtime object, typings miss the export
import { LineSeries } from "lightweight-charts"

function formatTime(isoString: string) {
  const d = new Date(isoString)
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function formatNum(val: number | null, decimals = 2) {
  if (val == null) return "-"
  return val.toFixed(decimals)
}

function toChartTime(isoString: string): number {
  // Data is stored as IST (UTC+5:30) without timezone info.
  // lightweight-charts renders timestamps as UTC.
  // Treat the raw string as UTC so the chart displays IST labels.
  const utcString = isoString.endsWith("Z") ? isoString : isoString + "Z"
  return Math.floor(new Date(utcString).getTime() / 1000)
}

function StraddleChart({
  rows,
  showSpot,
}: {
  rows: StraddleRow[]
  showSpot: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const spotSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)

  useEffect(() => {
    if (!containerRef.current || rows.length === 0) return

    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        horzLine: { labelBackgroundColor: "#374151" },
        vertLine: { labelBackgroundColor: "#374151" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.1)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: { mouseWheel: true, pinch: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
    })

    chartRef.current = chart

    // Straddle combined premium line
    const straddleSeries = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 2,
      title: "Straddle",
      priceLineVisible: true,
      lastValueVisible: true,
    })

    const straddleData = rows
      .filter((r) => r.combined_premium != null)
      .map((r) => ({
        time: toChartTime(r.timestamp) as any,
        value: r.combined_premium!,
      }))
    straddleSeries.setData(straddleData)

    // Spot price on separate scale (conditionally)
    if (showSpot) {
      const spotSeries = chart.addSeries(LineSeries, {
        color: "#6366f1",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        title: "Spot",
        priceLineVisible: false,
        lastValueVisible: true,
        priceScaleId: "spot",
      })
      chart.priceScale("spot").applyOptions({
        scaleMargins: { top: 0.1, bottom: 0.1 },
      })
      const spotData = rows
        .filter((r) => r.spot != null)
        .map((r) => ({
          time: toChartTime(r.timestamp) as any,
          value: r.spot!,
        }))
      spotSeries.setData(spotData)
      spotSeriesRef.current = spotSeries
    }

    chart.timeScale().fitContent()

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        chart.applyOptions({ width, height })
      }
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [rows, showSpot])

  return <div ref={containerRef} className="h-[400px] w-full" />
}

const EXPIRY_FLAGS = [
  { value: "WEEK", label: "Weekly" },
  { value: "MONTH", label: "Monthly" },
]

const EXPIRY_CODES = [
  { value: "1", label: "Current" },
  { value: "2", label: "Next" },
  { value: "3", label: "Far" },
]

export function StraddlePage() {
  const [underlyings, setUnderlyings] = useState<string[]>([])
  const [selectedUnderlying, setSelectedUnderlying] = useState("")
  const [expiryFlag, setExpiryFlag] = useState("WEEK")
  const [expiryCode, setExpiryCode] = useState(1)
  const [dates, setDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState("")
  const [rows, setRows] = useState<StraddleRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSpot, setShowSpot] = useState(false)

  useEffect(() => {
    straddleApi
      .underlyings()
      .then((res) => {
        setUnderlyings(res.underlyings)
        if (res.underlyings.length > 0) {
          setSelectedUnderlying(res.underlyings[0])
        }
      })
      .catch(() => setError("Failed to load underlyings"))
  }, [])

  // Reload dates when underlying, expiryFlag, or expiryCode changes
  useEffect(() => {
    if (!selectedUnderlying) return
    setDates([])
    setSelectedDate("")
    setRows([])
    straddleApi
      .dates(selectedUnderlying, expiryFlag, expiryCode)
      .then((res) => {
        setDates(res.dates)
        const today = new Date().toISOString().slice(0, 10)
        if (res.dates.includes(today)) {
          setSelectedDate(today)
        } else if (res.dates.length > 0) {
          setSelectedDate(res.dates[0])
        }
      })
      .catch(() => setError("Failed to load dates"))
  }, [selectedUnderlying, expiryFlag, expiryCode])

  const loadData = useCallback(async () => {
    if (!selectedUnderlying || !selectedDate) return
    setLoading(true)
    setError(null)
    try {
      const res = await straddleApi.data(selectedUnderlying, selectedDate, expiryFlag, expiryCode)
      setRows(res.rows)
    } catch {
      setError("Failed to load straddle data")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [selectedUnderlying, selectedDate, expiryFlag, expiryCode])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">ATM Straddle</h1>
        <p className="text-sm text-muted-foreground">
          Combined CE + PE premium for ATM strike
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Underlying
          </span>
          <Select
            value={selectedUnderlying}
            onValueChange={setSelectedUnderlying}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select underlying" />
            </SelectTrigger>
            <SelectContent>
              {underlyings.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Expiry
          </span>
          <Select value={expiryFlag} onValueChange={setExpiryFlag}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPIRY_FLAGS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Expiry Code
          </span>
          <Select
            value={String(expiryCode)}
            onValueChange={(v) => setExpiryCode(Number(v))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPIRY_CODES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Date
          </span>
          <Select value={selectedDate} onValueChange={setSelectedDate}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select date" />
            </SelectTrigger>
            <SelectContent>
              {dates.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {rows.length > 0 && (
          <div className="ml-auto text-sm text-muted-foreground">
            {rows.length} candles
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Chart */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>
            {selectedUnderlying} Straddle Premium
            {selectedDate && ` - ${selectedDate}`}
            {rows.length > 0 && rows[0].strike_price != null && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                Strike: {rows[0].strike_price}
              </span>
            )}
          </CardTitle>
          <CardAction>
            <Button
              variant={showSpot ? "default" : "outline"}
              size="sm"
              onClick={() => setShowSpot((v) => !v)}
            >
              Spot
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="p-2">
          {loading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : rows.length === 0 ? (
            <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
              {selectedDate
                ? "No ATM straddle data available for this date"
                : "Select an underlying and date to view straddle data"}
            </div>
          ) : (
            <StraddleChart rows={rows} showSpot={showSpot} />
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Intraday Data</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!loading && rows.length > 0 && (
            <div className="max-h-[calc(100vh-320px)] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky top-0 bg-card">Time</TableHead>
                    <TableHead className="sticky top-0 bg-card text-right">
                      Strike
                    </TableHead>
                    <TableHead className="sticky top-0 bg-card text-right">
                      Spot
                    </TableHead>
                    <TableHead className="sticky top-0 bg-card text-right">
                      CE Close
                    </TableHead>
                    <TableHead className="sticky top-0 bg-card text-right">
                      PE Close
                    </TableHead>
                    <TableHead className="sticky top-0 bg-card text-right font-semibold">
                      Straddle
                    </TableHead>
                    <TableHead className="sticky top-0 bg-card text-right">
                      CE IV
                    </TableHead>
                    <TableHead className="sticky top-0 bg-card text-right">
                      PE IV
                    </TableHead>
                    <TableHead className="sticky top-0 bg-card text-right">
                      CE Vol
                    </TableHead>
                    <TableHead className="sticky top-0 bg-card text-right">
                      PE Vol
                    </TableHead>
                    <TableHead className="sticky top-0 bg-card text-right">
                      CE OI
                    </TableHead>
                    <TableHead className="sticky top-0 bg-card text-right">
                      PE OI
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">
                        {formatTime(row.timestamp)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNum(row.strike_price, 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNum(row.spot)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNum(row.ce_close)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNum(row.pe_close)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatNum(row.combined_premium)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatNum(row.ce_iv)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatNum(row.pe_iv)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.ce_volume?.toLocaleString() ?? "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.pe_volume?.toLocaleString() ?? "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.ce_oi?.toLocaleString() ?? "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.pe_oi?.toLocaleString() ?? "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
