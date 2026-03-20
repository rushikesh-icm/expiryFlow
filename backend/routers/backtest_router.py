import logging

from fastapi import APIRouter, HTTPException

from dependencies import ActiveSessionDep, DbDep, DuckDbDep
from schemas import BacktestRequest
from services.backtest_service import run_backtest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/backtest", tags=["backtest"])


@router.post("/run")
def run_backtest_endpoint(
    data: BacktestRequest,
    session: ActiveSessionDep,
    db: DbDep,
    duck: DuckDbDep,
) -> dict:
    result = run_backtest(duck, db, data)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result
