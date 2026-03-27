"""Dynamic ATM Straddle Backtester.

Strategy:
  - First bar of each day: SELL ATM straddle (CE + PE)
  - Every bar: if spot-derived ATM strike changes, exit old straddle, sell new
  - Last bar of day: exit straddle (no overnight positions)
"""

import logging
import math
from collections import defaultdict
from datetime import datetime

import duckdb
from sqlalchemy.orm import Session

from config import MARGIN_RATE, UNDERLYING_META
from models import CommissionSlab, LotSize

logger = logging.getLogger(__name__)


def _get_slab(db: Session, cumulative_turnover: float) -> dict:
    """Get the commission slab for the given cumulative turnover."""
    slab = (
        db.query(CommissionSlab)
        .filter(CommissionSlab.turnover_from <= cumulative_turnover)
        .filter(CommissionSlab.turnover_to > cumulative_turnover)
        .first()
    )
    if not slab:
        slab = db.query(CommissionSlab).order_by(CommissionSlab.slab_no.desc()).first()
    return {
        "brokerage_per_order": slab.brokerage_per_order,
        "stt_sell_rate": slab.stt_sell_rate,
        "exchange_txn_rate": slab.exchange_txn_rate,
        "gst_rate": slab.gst_rate,
        "sebi_per_crore": slab.sebi_per_crore,
        "stamp_duty_buy_rate": slab.stamp_duty_buy_rate,
    }


def _calculate_charges(num_orders: int, sell_turnover: float, buy_turnover: float, slab: dict) -> dict:
    total_turnover = sell_turnover + buy_turnover
    brokerage = num_orders * slab["brokerage_per_order"]
    stt = sell_turnover * slab["stt_sell_rate"]
    exchange_txn = total_turnover * slab["exchange_txn_rate"]
    sebi = total_turnover * slab["sebi_per_crore"] / 1e7
    gst = slab["gst_rate"] * (brokerage + exchange_txn + sebi)
    stamp_duty = buy_turnover * slab["stamp_duty_buy_rate"]
    total = brokerage + stt + exchange_txn + gst + sebi + stamp_duty
    return {
        "brokerage": round(brokerage, 2),
        "stt": round(stt, 2),
        "exchange_txn": round(exchange_txn, 2),
        "gst": round(gst, 2),
        "sebi": round(sebi, 2),
        "stamp_duty": round(stamp_duty, 2),
        "total_charges": round(total, 2),
    }


def _nearest_strike(spot: float, strike_step: int) -> float:
    return round(spot / strike_step) * strike_step


def _is_roll_check_bar(ts: datetime, roll_check_minutes: int | None) -> bool:
    if roll_check_minutes is None:
        return True
    minute_of_day = ts.hour * 60 + ts.minute
    return minute_of_day % roll_check_minutes == 0


def _spot_move_hit(spot_in: float, spot_out: float, trigger_pct: float | None) -> bool:
    """Return True when Spot In/Out move hits configured percentage trigger."""
    if trigger_pct is None or spot_in <= 0:
        return False
    move_pct = abs((spot_out - spot_in) / spot_in) * 100
    # Small epsilon to avoid floating-point misses at boundary (e.g., 0.9999999 vs 1.0)
    return move_pct + 1e-9 >= trigger_pct


def run_backtest(duck: duckdb.DuckDBPyConnection, db: Session, params) -> dict:
    underlying = params.underlying_scrip
    meta = UNDERLYING_META[underlying]
    strike_step = meta["strike_step"]
    roll_check_minutes = getattr(params, "roll_check_minutes", None)
    spot_move_pct = getattr(params, "spot_move_pct", None)

    # Read lot size from SQLite
    lot_row = db.query(LotSize).filter(LotSize.symbol == underlying).first()
    lot_size = lot_row.lot_size if lot_row else 65

    # --- Load data ---
    rows = duck.execute(
        """
        SELECT timestamp, strike_price, option_type, close, spot
        FROM expired_options_ohlcv
        WHERE underlying_scrip = ?
          AND expiry_flag = ?
          AND expiry_code = ?
          AND interval = ?
          AND CAST(timestamp AS DATE) >= CAST(? AS DATE)
          AND CAST(timestamp AS DATE) <= CAST(? AS DATE)
          AND option_type IN ('CE', 'PE')
        ORDER BY timestamp
        """,
        [underlying, params.expiry_flag, params.expiry_code, params.interval,
         params.from_date, params.to_date],
    ).fetchall()

    if not rows:
        return {"error": "No data found for the given parameters"}

    # Build lookup: {timestamp: {strike_price: {'CE': close, 'PE': close}}, spot_by_ts
    ts_data: dict[datetime, dict[float, dict[str, float]]] = defaultdict(lambda: defaultdict(dict))
    spot_by_ts: dict[datetime, float] = {}
    for ts, sp, ot, close_px, spot in rows:
        ts_data[ts][sp][ot] = close_px
        spot_by_ts[ts] = spot

    timestamps = sorted(ts_data.keys())

    # --- Position sizing ---
    first_spot = spot_by_ts[timestamps[0]]
    margin_per_lot = MARGIN_RATE * first_spot * lot_size

    if params.sizing_mode == "fixed_lots":
        num_lots = params.lots
    elif params.sizing_mode == "fixed_money":
        num_lots = max(1, int((params.fixed_money or params.capital) / margin_per_lot))
    elif params.sizing_mode == "fixed_percentage":
        alloc = params.capital * (params.fixed_percentage or 10) / 100
        num_lots = max(1, int(alloc / margin_per_lot))
    else:
        num_lots = 1

    quantity = num_lots * lot_size
    capital = params.capital

    # --- Strategy state ---
    position = None  # {strike, ce_entry, pe_entry, entry_time, spot_entry}
    current_strike = None
    trades = []
    equity_curve = []
    drawdown_curve = []
    realized_pnl = 0.0
    total_comm = 0.0
    cumulative_turnover = 0.0
    peak_equity = capital
    charge_totals = defaultdict(float)

    # Group timestamps by date
    day_map: dict[str, list[datetime]] = defaultdict(list)
    for ts in timestamps:
        day_map[ts.strftime("%Y-%m-%d")].append(ts)

    for day_str in sorted(day_map.keys()):
        day_ts = day_map[day_str]

        for idx, ts in enumerate(day_ts):
            spot = spot_by_ts.get(ts, 0)
            if spot == 0:
                continue

            atm = _nearest_strike(spot, strike_step)
            strikes = ts_data[ts]
            is_last_bar = idx == len(day_ts) - 1

            # --- Exit at end of day ---
            if is_last_bar and position:
                slab = _get_slab(db, cumulative_turnover)
                trade = _close_position(position, ts, spot, strikes, current_strike, quantity, num_lots, lot_size, slab)
                if trade:
                    trades.append(trade)
                    realized_pnl += trade["net_pnl"]
                    total_comm += trade["total_charges"]
                    cumulative_turnover += trade["turnover"]
                    for k in ("brokerage", "stt", "exchange_txn", "gst", "sebi", "stamp_duty"):
                        charge_totals[k] += trade[k]
                position = None
                current_strike = None

                # record equity at close
                eq = capital + realized_pnl
                equity_curve.append({"timestamp": ts.isoformat(), "equity": round(eq, 2)})
                peak_equity = max(peak_equity, eq)
                dd_pct = ((eq - peak_equity) / peak_equity * 100) if peak_equity > 0 else 0
                drawdown_curve.append({"timestamp": ts.isoformat(), "drawdown_pct": round(dd_pct, 4)})
                continue

            should_check_roll = _is_roll_check_bar(ts, roll_check_minutes)
            # If spot-move trigger is configured, use it as the roll driver.
            # Keep strike-change roll behavior only when spot trigger is disabled.
            strike_roll = (spot_move_pct is None) and should_check_roll and atm != current_strike

            spot_roll = False
            if position and position.get("spot_entry") is not None:
                spot_roll = _spot_move_hit(position["spot_entry"], spot, spot_move_pct)

            need_roll = position is None or strike_roll or spot_roll

            if need_roll:
                # Exit current position
                if position:
                    slab = _get_slab(db, cumulative_turnover)
                    trade = _close_position(position, ts, spot, strikes, current_strike, quantity, num_lots, lot_size, slab)
                    if trade:
                        trades.append(trade)
                        realized_pnl += trade["net_pnl"]
                        total_comm += trade["total_charges"]
                        cumulative_turnover += trade["turnover"]
                        for k in ("brokerage", "stt", "exchange_txn", "gst", "sebi", "stamp_duty"):
                            charge_totals[k] += trade[k]
                    position = None

                # Enter new straddle
                ce = strikes.get(atm, {}).get("CE")
                pe = strikes.get(atm, {}).get("PE")
                if ce is not None and pe is not None:
                    position = {
                        "strike": atm,
                        "ce_entry": ce,
                        "pe_entry": pe,
                        "entry_time": ts,
                        "spot_entry": spot,
                    }
                    current_strike = atm

            # --- Equity tracking ---
            unrealized = 0.0
            if position:
                ce_now = strikes.get(current_strike, {}).get("CE", position["ce_entry"])
                pe_now = strikes.get(current_strike, {}).get("PE", position["pe_entry"])
                unrealized = (position["ce_entry"] - ce_now + position["pe_entry"] - pe_now) * quantity

            eq = capital + realized_pnl + unrealized
            equity_curve.append({"timestamp": ts.isoformat(), "equity": round(eq, 2)})
            peak_equity = max(peak_equity, eq)
            dd_pct = ((eq - peak_equity) / peak_equity * 100) if peak_equity > 0 else 0
            drawdown_curve.append({"timestamp": ts.isoformat(), "drawdown_pct": round(dd_pct, 4)})

    # --- Compute metrics ---
    ending_capital = capital + realized_pnl
    net_pnls = [t["net_pnl"] for t in trades]
    wins = [p for p in net_pnls if p > 0]
    losses = [p for p in net_pnls if p <= 0]

    gross_wins = sum(wins)
    gross_losses = abs(sum(losses))

    # Daily P&L
    daily_pnl_map: dict[str, dict] = {}
    for t in trades:
        day = t["exit_time"][:10]
        if day not in daily_pnl_map:
            daily_pnl_map[day] = {"date": day, "trades": 0, "gross_pnl": 0, "commissions": 0, "net_pnl": 0}
        daily_pnl_map[day]["trades"] += 1
        daily_pnl_map[day]["gross_pnl"] += t["gross_pnl"]
        daily_pnl_map[day]["commissions"] += t["total_charges"]
        daily_pnl_map[day]["net_pnl"] += t["net_pnl"]

    daily_pnl = []
    cum = 0.0
    peak_cum = 0.0
    for day in sorted(daily_pnl_map.keys()):
        d = daily_pnl_map[day]
        cum += d["net_pnl"]
        peak_cum = max(peak_cum, cum)
        daily_pnl.append({
            "date": d["date"],
            "trades": d["trades"],
            "gross_pnl": round(d["gross_pnl"], 2),
            "commissions": round(d["commissions"], 2),
            "net_pnl": round(d["net_pnl"], 2),
            "cumulative_pnl": round(cum, 2),
            "drawdown": round(cum - peak_cum, 2),
        })

    daily_returns = [d["net_pnl"] / capital for d in daily_pnl] if daily_pnl else []
    avg_daily = sum(daily_returns) / len(daily_returns) if daily_returns else 0
    std_daily = (sum((r - avg_daily) ** 2 for r in daily_returns) / len(daily_returns)) ** 0.5 if len(daily_returns) > 1 else 0

    # Max drawdown from equity curve
    max_dd = 0.0
    max_dd_pct = 0.0
    if drawdown_curve:
        max_dd_pct = min(d["drawdown_pct"] for d in drawdown_curve)
        max_dd = max_dd_pct / 100 * capital

    total_turnover = sum(t["turnover"] for t in trades)

    metrics = {
        "starting_capital": capital,
        "ending_capital": round(ending_capital, 2),
        "net_pnl": round(realized_pnl, 2),
        "return_pct": round((realized_pnl / capital) * 100, 2),
        "total_trades": len(trades),
        "winning_trades": len(wins),
        "losing_trades": len(losses),
        "win_rate": round(len(wins) / len(trades) * 100, 2) if trades else 0,
        "avg_win": round(sum(wins) / len(wins), 2) if wins else 0,
        "avg_loss": round(sum(losses) / len(losses), 2) if losses else 0,
        "largest_win": round(max(wins), 2) if wins else 0,
        "largest_loss": round(min(losses), 2) if losses else 0,
        "profit_factor": round(gross_wins / gross_losses, 2) if gross_losses > 0 else float("inf"),
        "max_drawdown": round(max_dd, 2),
        "max_drawdown_pct": round(max_dd_pct, 2),
        "sharpe_ratio": round((avg_daily / std_daily) * math.sqrt(252), 2) if std_daily > 0 else 0,
        "avg_daily_pnl": round(avg_daily * capital, 2),
        "total_turnover": round(total_turnover, 2),
        "total_commissions": round(total_comm, 2),
        "lots": num_lots,
        "quantity": quantity,
        "lot_size": lot_size,
        "brokerage_total": round(charge_totals["brokerage"], 2),
        "stt_total": round(charge_totals["stt"], 2),
        "exchange_txn_total": round(charge_totals["exchange_txn"], 2),
        "gst_total": round(charge_totals["gst"], 2),
        "sebi_total": round(charge_totals["sebi"], 2),
        "stamp_duty_total": round(charge_totals["stamp_duty"], 2),
    }

    return {
        "metrics": metrics,
        "equity_curve": equity_curve,
        "drawdown_curve": drawdown_curve,
        "trades": trades,
        "daily_pnl": daily_pnl,
    }


def _close_position(
    position: dict,
    ts: datetime,
    spot: float,
    strikes: dict,
    current_strike: float,
    quantity: int,
    num_lots: int,
    lot_size: int,
    slab: dict,
) -> dict | None:
    ce_exit = strikes.get(current_strike, {}).get("CE")
    pe_exit = strikes.get(current_strike, {}).get("PE")
    if ce_exit is None or pe_exit is None:
        return None

    ce_pnl = (position["ce_entry"] - ce_exit) * quantity
    pe_pnl = (position["pe_entry"] - pe_exit) * quantity
    gross_pnl = ce_pnl + pe_pnl

    # Sell side = entry (we sold to open)
    sell_turnover = (position["ce_entry"] + position["pe_entry"]) * quantity
    # Buy side = exit (we bought to close)
    buy_turnover = (ce_exit + pe_exit) * quantity
    total_turnover = sell_turnover + buy_turnover

    charges = _calculate_charges(4, sell_turnover, buy_turnover, slab)
    net_pnl = gross_pnl - charges["total_charges"]

    margin_blocked = MARGIN_RATE * position["spot_entry"] * lot_size * num_lots

    return {
        "trade_no": 0,  # set by caller
        "entry_time": position["entry_time"].isoformat(),
        "exit_time": ts.isoformat(),
        "strike_price": current_strike,
        "spot_at_entry": round(position["spot_entry"], 2),
        "spot_at_exit": round(spot, 2),
        "ce_entry": round(position["ce_entry"], 2),
        "pe_entry": round(position["pe_entry"], 2),
        "ce_exit": round(ce_exit, 2),
        "pe_exit": round(pe_exit, 2),
        "entry_premium": round(position["ce_entry"] + position["pe_entry"], 2),
        "exit_premium": round(ce_exit + pe_exit, 2),
        "lots": num_lots,
        "quantity": quantity,
        "margin_blocked": round(margin_blocked, 2),
        "turnover": round(total_turnover, 2),
        **charges,
        "gross_pnl": round(gross_pnl, 2),
        "net_pnl": round(net_pnl, 2),
    }
