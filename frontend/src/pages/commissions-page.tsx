import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  commissionsApi,
  type CommissionSlab,
  type LotSizeEntry,
} from "@/api/backtest"

export function CommissionsPage() {
  const [slabs, setSlabs] = useState<CommissionSlab[]>([])
  const [lotSizes, setLotSizes] = useState<LotSizeEntry[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    commissionsApi.getSlabs().then(setSlabs).catch(() => toast.error("Failed to load slabs"))
    commissionsApi.getLotSizes().then(setLotSizes).catch(() => toast.error("Failed to load lot sizes"))
  }, [])

  const updateSlab = (idx: number, field: keyof CommissionSlab, value: string) => {
    const updated = [...slabs]
    ;(updated[idx] as any)[field] = parseFloat(value) || 0
    setSlabs(updated)
  }

  const updateLot = (idx: number, value: string) => {
    const updated = [...lotSizes]
    updated[idx] = { ...updated[idx], lot_size: parseInt(value) || 0 }
    setLotSizes(updated)
  }

  const handleSaveSlabs = async () => {
    setSaving(true)
    try {
      await commissionsApi.updateSlabs(slabs)
      toast.success("Commission slabs saved")
    } catch { toast.error("Failed to save slabs") }
    finally { setSaving(false) }
  }

  const handleSaveLots = async () => {
    setSaving(true)
    try {
      await commissionsApi.updateLotSizes(lotSizes)
      toast.success("Lot sizes saved")
    } catch { toast.error("Failed to save lot sizes") }
    finally { setSaving(false) }
  }

  const fmtRate = (r: number) => {
    if (r < 0.01) return `${(r * 100).toFixed(4)}%`
    return `${(r * 100).toFixed(2)}%`
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Commissions & Lot Sizes</h1>
        <p className="text-sm text-muted-foreground">
          Configure slab-based commission structure and lot sizes for backtesting
        </p>
      </div>

      {/* Lot Sizes */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Lot Sizes</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {lotSizes.map((ls, i) => (
              <div key={ls.symbol} className="flex items-center gap-3">
                <span className="w-24 text-sm font-medium">{ls.symbol}</span>
                <Input
                  type="number"
                  min="1"
                  value={ls.lot_size}
                  onChange={(e) => updateLot(i, e.target.value)}
                  className="w-24"
                />
              </div>
            ))}
          </div>
          <Button className="mt-4" size="sm" onClick={handleSaveLots} disabled={saving}>
            Save Lot Sizes
          </Button>
        </CardContent>
      </Card>

      {/* Commission Slabs */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Commission Slabs (Turnover Based)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slab</TableHead>
                  <TableHead className="text-right">Turnover From</TableHead>
                  <TableHead className="text-right">Turnover To</TableHead>
                  <TableHead className="text-right">Brokerage/Order</TableHead>
                  <TableHead className="text-right">STT (sell)</TableHead>
                  <TableHead className="text-right">Exchange Txn</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right">SEBI/Cr</TableHead>
                  <TableHead className="text-right">Stamp Duty (buy)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slabs.map((s, i) => (
                  <TableRow key={s.slab_no}>
                    <TableCell className="font-medium">Slab {s.slab_no}</TableCell>
                    <TableCell className="text-right">
                      <Input type="number" className="w-32 ml-auto text-right" value={s.turnover_from}
                        onChange={(e) => updateSlab(i, "turnover_from", e.target.value)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" className="w-32 ml-auto text-right" value={s.turnover_to}
                        onChange={(e) => updateSlab(i, "turnover_to", e.target.value)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" className="w-20 ml-auto text-right" value={s.brokerage_per_order}
                        onChange={(e) => updateSlab(i, "brokerage_per_order", e.target.value)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" step="0.0001" className="w-24 ml-auto text-right" value={s.stt_sell_rate}
                        onChange={(e) => updateSlab(i, "stt_sell_rate", e.target.value)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" step="0.0000001" className="w-28 ml-auto text-right" value={s.exchange_txn_rate}
                        onChange={(e) => updateSlab(i, "exchange_txn_rate", e.target.value)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" step="0.01" className="w-20 ml-auto text-right" value={s.gst_rate}
                        onChange={(e) => updateSlab(i, "gst_rate", e.target.value)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" className="w-20 ml-auto text-right" value={s.sebi_per_crore}
                        onChange={(e) => updateSlab(i, "sebi_per_crore", e.target.value)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input type="number" step="0.00001" className="w-28 ml-auto text-right" value={s.stamp_duty_buy_rate}
                        onChange={(e) => updateSlab(i, "stamp_duty_buy_rate", e.target.value)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="p-4">
            <Button size="sm" onClick={handleSaveSlabs} disabled={saving}>
              Save Commission Slabs
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
