import logging
from datetime import date

from fastapi import APIRouter, Query

from dependencies import ActiveSessionDep, DuckDbDep
from schemas import (
    StraddleDataResponse,
    StraddleDatesResponse,
    StraddleRow,
    StraddleUnderlyingsResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/straddle", tags=["straddle"])


@router.get("/underlyings", response_model=StraddleUnderlyingsResponse)
def straddle_underlyings(
    session: ActiveSessionDep,
    duck: DuckDbDep,
) -> StraddleUnderlyingsResponse:
    rows = duck.execute(
        "SELECT DISTINCT underlying_scrip FROM expired_options_ohlcv ORDER BY underlying_scrip"
    ).fetchall()
    return StraddleUnderlyingsResponse(underlyings=[r[0] for r in rows])


@router.get("/dates", response_model=StraddleDatesResponse)
def straddle_dates(
    session: ActiveSessionDep,
    duck: DuckDbDep,
    underlying_scrip: str = Query(...),
    expiry_flag: str = Query("WEEK"),
    expiry_code: int = Query(1),
) -> StraddleDatesResponse:
    rows = duck.execute(
        """
        SELECT DISTINCT CAST(timestamp AS DATE) AS dt
        FROM expired_options_ohlcv
        WHERE underlying_scrip = ?
          AND strike_label = 'ATM'
          AND expiry_flag = ?
          AND expiry_code = ?
        ORDER BY dt DESC
        """,
        [underlying_scrip, expiry_flag, expiry_code],
    ).fetchall()
    return StraddleDatesResponse(dates=[r[0].isoformat() for r in rows])


@router.get("/data", response_model=StraddleDataResponse)
def straddle_data(
    session: ActiveSessionDep,
    duck: DuckDbDep,
    underlying_scrip: str = Query(...),
    date: str = Query(...),
    expiry_flag: str = Query("WEEK"),
    expiry_code: int = Query(1),
) -> StraddleDataResponse:
    rows = duck.execute(
        """
        SELECT
            ce.timestamp,
            ce.strike_price,
            ce.open   AS ce_open,
            ce.high   AS ce_high,
            ce.low    AS ce_low,
            ce.close  AS ce_close,
            pe.open   AS pe_open,
            pe.high   AS pe_high,
            pe.low    AS pe_low,
            pe.close  AS pe_close,
            ce.close + pe.close AS combined_premium,
            ce.iv     AS ce_iv,
            pe.iv     AS pe_iv,
            ce.volume AS ce_volume,
            pe.volume AS pe_volume,
            ce.oi     AS ce_oi,
            pe.oi     AS pe_oi,
            ce.spot
        FROM expired_options_ohlcv ce
        JOIN expired_options_ohlcv pe
          ON ce.underlying_scrip = pe.underlying_scrip
         AND ce.expiry_flag      = pe.expiry_flag
         AND ce.expiry_code      = pe.expiry_code
         AND ce.interval         = pe.interval
         AND ce.strike_label     = pe.strike_label
         AND ce.timestamp        = pe.timestamp
        WHERE ce.underlying_scrip = ?
          AND ce.strike_label     = 'ATM'
          AND ce.option_type      = 'CE'
          AND pe.option_type      = 'PE'
          AND ce.expiry_flag      = ?
          AND ce.expiry_code      = ?
          AND CAST(ce.timestamp AS DATE) = CAST(? AS DATE)
        ORDER BY ce.timestamp
        """,
        [underlying_scrip, expiry_flag, expiry_code, date],
    ).fetchall()

    items = [
        StraddleRow(
            timestamp=r[0].isoformat(),
            strike_price=r[1],
            ce_open=r[2],
            ce_high=r[3],
            ce_low=r[4],
            ce_close=r[5],
            pe_open=r[6],
            pe_high=r[7],
            pe_low=r[8],
            pe_close=r[9],
            combined_premium=r[10],
            ce_iv=r[11],
            pe_iv=r[12],
            ce_volume=r[13],
            pe_volume=r[14],
            ce_oi=r[15],
            pe_oi=r[16],
            spot=r[17],
        )
        for r in rows
    ]

    return StraddleDataResponse(rows=items, total=len(items))
