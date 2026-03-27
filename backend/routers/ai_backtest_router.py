import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from dependencies import ActiveSessionDep, DbDep, DuckDbDep
from schemas import BacktestRequest
from services.backtest_service import run_backtest
from services.nl_backtest_service import parse_backtest_prompt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai-backtest", tags=["ai-backtest"])


# -------------------- Request Schema -------------------- #
class AIBacktestRequest(BaseModel):
    prompt: str
    response: Optional[Dict[str, Any]] = None


# -------------------- Constants -------------------- #
ALLOWED_SORT_FIELDS = {"net_pnl", "pnl", "timestamp", "date"}

# -------------------- Utils -------------------- #
def _sort_array(arr: list[dict[str, Any]], field: str, order: str) -> list[dict[str, Any]]:
    reverse = str(order).lower() != "asc"

    def key_fn(x: dict[str, Any]):
        v = x.get(field)
        return (v is None, v)

    return sorted(arr, key=key_fn, reverse=reverse)


# -------------------- Route -------------------- #
@router.post("/run")
def run_ai_backtest(
    body: AIBacktestRequest,
    session: ActiveSessionDep,
    db: DbDep,
    duck: DuckDbDep,
) -> dict:
    """
    Accepts natural language prompt and runs backtest.

    Request body:
      - prompt: string (required)
      - response: { sort?: {target, field, order}, limit_trades?: int, limit_daily?: int } (optional)
    """

    prompt = body.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    # -------------------- Parse Prompt (NO DEFAULTS) -------------------- #
    req, meta = parse_backtest_prompt(prompt, defaults=None)

    if not req:
        raise HTTPException(status_code=400, detail="Invalid prompt: no parameters extracted")

    # -------------------- Run Backtest -------------------- #
    result = run_backtest(duck, db, req)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    # -------------------- Response Config -------------------- #
    resp_cfg = body.response or {}
    sort = resp_cfg.get("sort")
    limit_trades = resp_cfg.get("limit_trades")
    limit_daily = resp_cfg.get("limit_daily")

    # -------------------- Sorting -------------------- #
    if isinstance(sort, dict):
        target = sort.get("target")
        field = sort.get("field")
        order = sort.get("order", "desc")

        if target in ("trades", "daily_pnl") and field in ALLOWED_SORT_FIELDS:
            try:
                result[target] = _sort_array(
                    result.get(target, []),
                    field=field,
                    order=order,
                )
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid sort config: {str(e)}")
        else:
            raise HTTPException(status_code=400, detail="Invalid sort field or target")

    # -------------------- Limiting -------------------- #
    if isinstance(limit_trades, int) and limit_trades > 0:
        result["trades"] = (result.get("trades") or [])[:limit_trades]

    if isinstance(limit_daily, int) and limit_daily > 0:
        result["daily_pnl"] = (result.get("daily_pnl") or [])[:limit_daily]

    # -------------------- Response -------------------- #
    return {
        "prompt": prompt,
        "payload": req.model_dump(exclude_none=True),
        "meta": meta,
        "result": result,
    }