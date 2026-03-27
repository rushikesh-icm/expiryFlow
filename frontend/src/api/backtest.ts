import { request } from "./client"

export interface BacktestRequest {
  underlying_scrip: string
  expiry_flag: string
  expiry_code: number
  from_date: string
  to_date: string
  interval: string
  capital: number
  sizing_mode: string
  lots: number
  fixed_money: number | null
  fixed_percentage: number | null
  roll_check_minutes: number | null
  spot_move_pct: number | null
}

export interface BacktestTrade {
  trade_no: number
  entry_time: string
  exit_time: string
  strike_price: number
  spot_at_entry: number
  spot_at_exit: number
  ce_entry: number
  pe_entry: number
  ce_exit: number
  pe_exit: number
  entry_premium: number
  exit_premium: number
  lots: number
  quantity: number
  margin_blocked: number
  turnover: number
  brokerage: number
  stt: number
  exchange_txn: number
  gst: number
  sebi: number
  stamp_duty: number
  total_charges: number
  gross_pnl: number
  net_pnl: number
}

export interface BacktestDailyPnl {
  date: string
  trades: number
  gross_pnl: number
  commissions: number
  net_pnl: number
  cumulative_pnl: number
  drawdown: number
}

export interface BacktestMetrics {
  starting_capital: number
  ending_capital: number
  net_pnl: number
  return_pct: number
  total_trades: number
  winning_trades: number
  losing_trades: number
  win_rate: number
  avg_win: number
  avg_loss: number
  largest_win: number
  largest_loss: number
  profit_factor: number
  max_drawdown: number
  max_drawdown_pct: number
  sharpe_ratio: number
  avg_daily_pnl: number
  total_turnover: number
  total_commissions: number
  lots: number
  quantity: number
  lot_size: number
  brokerage_total: number
  stt_total: number
  exchange_txn_total: number
  gst_total: number
  sebi_total: number
  stamp_duty_total: number
}

export interface BacktestResult {
  metrics: BacktestMetrics
  equity_curve: { timestamp: string; equity: number }[]
  drawdown_curve: { timestamp: string; drawdown_pct: number }[]
  trades: BacktestTrade[]
  daily_pnl: BacktestDailyPnl[]
}

export const backtestApi = {
  run: (data: BacktestRequest) =>
    request<BacktestResult>("/backtest/run", { method: "POST", body: data }),
}

// Commission types
export interface CommissionSlab {
  slab_no: number
  turnover_from: number
  turnover_to: number
  brokerage_per_order: number
  stt_sell_rate: number
  exchange_txn_rate: number
  gst_rate: number
  sebi_per_crore: number
  stamp_duty_buy_rate: number
}

export interface LotSizeEntry {
  symbol: string
  lot_size: number
}

export const commissionsApi = {
  getSlabs: () => request<CommissionSlab[]>("/commissions/slabs"),
  updateSlabs: (slabs: CommissionSlab[]) =>
    request<{ message: string }>("/commissions/slabs", { method: "PUT", body: slabs }),
  getLotSizes: () => request<LotSizeEntry[]>("/commissions/lot-sizes"),
  updateLotSizes: (sizes: LotSizeEntry[]) =>
    request<{ message: string }>("/commissions/lot-sizes", { method: "PUT", body: sizes }),
}
