import logging
from typing import Any

from fastapi import APIRouter, HTTPException

from dependencies import ActiveSessionDep, DbDep, DuckDbDep
from schemas import BacktestRequest
from services.backtest_service import run_backtest
from services.nl_backtest_service import parse_backtest_prompt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai-backtest", tags=["ai-backtest"])


def _sort_array(arr: list[dict[str, Any]], field: str, order: str) -> list[dict[str, Any]]:
    reverse = str(order).lower() != "asc"

    def key_fn(x: dict[str, Any]):
        v = x.get(field)
        return (v is None, v)

    return sorted(arr, key=key_fn, reverse=reverse)


@router.post("/run")
def run_ai_backtest(
    body: dict,
    session: ActiveSessionDep,
    db: DbDep,
    duck: DuckDbDep,
) -> dict:
    """
    Accepts natural language prompt and runs backtest.

    Request body:
      - prompt: string (required)
      - defaults: BacktestRequest (optional) base values to start from
      - response: { sort?: {target, field, order}, limit_trades?: int, limit_daily?: int } (optional)
    """
    prompt = (body.get("prompt") or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    defaults_raw = body.get("defaults")
    defaults: BacktestRequest | None = None
    if isinstance(defaults_raw, dict):
        try:
            defaults = BacktestRequest(**defaults_raw)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid defaults: {str(e)}")

    req, meta = parse_backtest_prompt(prompt, defaults=defaults)
    result = run_backtest(duck, db, req)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    resp_cfg = body.get("response") if isinstance(body.get("response"), dict) else {}
    sort = resp_cfg.get("sort") or meta.get("sort")
    limit_trades = resp_cfg.get("limit_trades")
    limit_daily = resp_cfg.get("limit_daily")

    # optional server-side ordering/limiting for convenience
    if isinstance(sort, dict):
        target = sort.get("target")
        field = sort.get("field")
        order = sort.get("order", "desc")
        if target in ("trades", "daily_pnl") and isinstance(field, str) and field:
            try:
                result[target] = _sort_array(result.get(target, []), field=field, order=order)
            except Exception as e:
                logger.warning("Sort failed: %s", str(e))

    if isinstance(limit_trades, int) and limit_trades > 0:
        result["trades"] = (result.get("trades") or [])[:limit_trades]
    if isinstance(limit_daily, int) and limit_daily > 0:
        result["daily_pnl"] = (result.get("daily_pnl") or [])[:limit_daily]

    return {
        "prompt": prompt,
        "payload": req.model_dump(),
        "meta": meta,
        "result": result,
    }

