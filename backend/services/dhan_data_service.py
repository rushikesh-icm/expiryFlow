import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import httpx

IST = ZoneInfo("Asia/Kolkata")

from config import DHAN_DATA_BASE_URL

logger = logging.getLogger(__name__)

REQUIRED_DATA_FIELDS = ["open", "high", "low", "close", "iv", "volume", "strike", "oi", "spot"]


def _parse_option_data(raw: dict, option_type: str) -> list[dict]:
    """Parse parallel arrays from Dhan response into list of bar dicts."""
    if not raw:
        return []

    timestamps = raw.get("timestamp", [])
    if not timestamps:
        return []

    length = len(timestamps)
    opens = raw.get("open", [])
    highs = raw.get("high", [])
    lows = raw.get("low", [])
    closes = raw.get("close", [])
    volumes = raw.get("volume", [])
    ois = raw.get("oi", [])
    ivs = raw.get("iv", [])
    spots = raw.get("spot", [])
    strikes = raw.get("strike", [])

    bars = []
    for i in range(length):
        ts = timestamps[i]
        if isinstance(ts, (int, float)):
            ts = datetime.fromtimestamp(ts, tz=IST).strftime("%Y-%m-%d %H:%M:%S")

        bars.append({
            "timestamp": ts,
            "open": opens[i] if i < len(opens) else None,
            "high": highs[i] if i < len(highs) else None,
            "low": lows[i] if i < len(lows) else None,
            "close": closes[i] if i < len(closes) else None,
            "volume": volumes[i] if i < len(volumes) else None,
            "oi": ois[i] if i < len(ois) else None,
            "iv": ivs[i] if i < len(ivs) else None,
            "spot": spots[i] if i < len(spots) else None,
            "strike_price": strikes[i] if i < len(strikes) else None,
            "option_type": option_type,
        })

    return bars


def build_strike_label(offset: int) -> str:
    """Build strike label for the API: ATM, ATM+1, ATM-1, etc."""
    if offset == 0:
        return "ATM"
    return f"ATM{offset:+d}"


def fetch_rolling_option(
    access_token: str,
    client_id: str,
    exchange_segment: str,
    security_id: int,
    instrument: str,
    expiry_flag: str,
    expiry_code: int,
    strike: str,
    drv_option_type: str,
    interval: str,
    from_date: str,
    to_date: str,
) -> dict[str, list[dict]]:
    """Fetch rolling expired options data.

    Args:
        strike: "ATM", "ATM+1", "ATM-1", "ATM+10", "ATM-10" etc.
        drv_option_type: "CALL" or "PUT"
        interval: "1", "5", "15", "25", "60"

    Returns dict keyed by option type ("CE"/"PE") with list of bar dicts.
    """
    url = f"{DHAN_DATA_BASE_URL}/v2/charts/rollingoption"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "access-token": access_token,
        "client-id": client_id,
    }
    payload = {
        "exchangeSegment": exchange_segment,
        "interval": interval,
        "securityId": security_id,
        "instrument": instrument,
        "expiryFlag": expiry_flag,
        "expiryCode": expiry_code,
        "strike": strike,
        "drvOptionType": drv_option_type,
        "requiredData": REQUIRED_DATA_FIELDS,
        "fromDate": from_date,
        "toDate": to_date,
    }
    logger.info(
        "Fetching: %s secId=%s %s %s/%s strike=%s [%s to %s]",
        exchange_segment, security_id, drv_option_type,
        expiry_flag, expiry_code, strike, from_date, to_date,
    )
    with httpx.Client(timeout=30.0) as client:
        response = client.post(url, headers=headers, json=payload)
        if response.status_code != 200:
            logger.error("API error %s: %s | payload: %s", response.status_code, response.text, payload)
        response.raise_for_status()
        data = response.json()

    result: dict[str, list[dict]] = {}

    if isinstance(data, dict) and "data" in data:
        inner = data["data"]
        if isinstance(inner, dict):
            for key in ("ce", "pe"):
                ot = key.upper()
                raw = inner.get(key)
                if raw:
                    bars = _parse_option_data(raw, ot)
                    if bars:
                        result[ot] = bars
                        logger.info("Parsed %d bars for strike=%s %s", len(bars), strike, ot)

    return result
