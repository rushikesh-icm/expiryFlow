import re
from datetime import date, timedelta

from schemas import BacktestRequest


def _today_iso() -> str:
    return date.today().isoformat()


def _week_ago_iso() -> str:
    return (date.today() - timedelta(days=7)).isoformat()


def _safe_date(s: str) -> str | None:
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s.strip()):
        return s.strip()
    return None


def _parse_inr_amount(lower: str) -> float | None:
    """
    Parse Indian-style money like:
      - "10 lakh", "10 lakhs" => 1_000_000
      - "1.2 crore" => 12_000_000
      - "1000000", "1,000,000" => 1_000_000
    """
    m = re.search(r"\b(\d+(?:\.\d+)?)\s*(lakh|lakhs|crore|cr)\b", lower)
    if m:
        n = float(m.group(1))
        unit = m.group(2)
        if unit in ("lakh", "lakhs"):
            return n * 100_000
        return n * 10_000_000

    m = re.search(r"\b(\d[\d,]*(?:\.\d+)?)\b", lower)
    if m:
        try:
            return float(m.group(1).replace(",", ""))
        except Exception:
            return None
    return None


def parse_backtest_prompt(prompt_raw: str, defaults: BacktestRequest | None = None) -> tuple[BacktestRequest, dict]:
    """
    Deterministic "AI-like" parser: converts simple English into BacktestRequest.
    Returns: (BacktestRequest, meta) where meta includes parse notes and optional sort settings.
    """
    prompt = (prompt_raw or "").strip()
    lower = prompt.lower()

    base = defaults or BacktestRequest(
        underlying_scrip="NIFTY",
        expiry_flag="WEEK",
        expiry_code=1,
        from_date=_week_ago_iso(),
        to_date=_today_iso(),
        interval="1",
        capital=1_000_000,
        sizing_mode="fixed_lots",
        lots=1,
        fixed_money=None,
        fixed_percentage=None,
        roll_check_minutes=None,
        spot_move_pct=None,
    )

    data = base.model_dump()
    sources: dict[str, str] = {k: "default" for k in data.keys()}
    warnings: list[str] = []

    # underlying
    for u in ("NIFTY", "BANKNIFTY", "SENSEX"):
        if re.search(rf"\b{u.lower()}\b", lower):
            data["underlying_scrip"] = u
            sources["underlying_scrip"] = "prompt"

    # expiry flag
    if re.search(r"\bweekly\b|\bweek\b", lower):
        data["expiry_flag"] = "WEEK"
        sources["expiry_flag"] = "prompt"
    if re.search(r"\bmonthly\b|\bmonth\b", lower):
        data["expiry_flag"] = "MONTH"
        sources["expiry_flag"] = "prompt"

    # expiry code
    if re.search(r"\bcurrent\b", lower):
        data["expiry_code"] = 1
        sources["expiry_code"] = "prompt"
    if re.search(r"\bnext\b", lower):
        data["expiry_code"] = 2
        sources["expiry_code"] = "prompt"
    if re.search(r"\bfar\b", lower):
        data["expiry_code"] = 3
        sources["expiry_code"] = "prompt"
    m = re.search(r"\bexpiry\s*code\s*(\d)\b", lower)
    if m:
        data["expiry_code"] = max(1, min(3, int(m.group(1))))
        sources["expiry_code"] = "prompt"

    # date range
    m = re.search(r"from\s+(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})", lower)
    if m:
        f = _safe_date(m.group(1))
        t = _safe_date(m.group(2))
        if f:
            data["from_date"] = f
            sources["from_date"] = "prompt"
        if t:
            data["to_date"] = t
            sources["to_date"] = "prompt"
    else:
        if re.search(r"\blast\s+(\d+)\s+days?\b", lower):
            mm = re.search(r"\blast\s+(\d+)\s+days?\b", lower)
            if mm:
                days = int(mm.group(1))
                data["to_date"] = _today_iso()
                data["from_date"] = (date.today() - timedelta(days=days)).isoformat()
                sources["from_date"] = "prompt"
                sources["to_date"] = "prompt"
        m1 = re.search(r"\bfrom\s+(\d{4}-\d{2}-\d{2})\b", lower)
        m2 = re.search(r"\bto\s+(\d{4}-\d{2}-\d{2})\b", lower)
        if m1 and _safe_date(m1.group(1)):
            data["from_date"] = m1.group(1)
            sources["from_date"] = "prompt"
        if m2 and _safe_date(m2.group(1)):
            data["to_date"] = m2.group(1)
            sources["to_date"] = "prompt"

    # interval
    m = re.search(r"\binterval\s*(\d{1,3})\s*(m|min|minutes)?\b", lower) or re.search(r"\b(\d{1,3})\s*(m|min|minutes)\b", lower)
    if m:
        data["interval"] = str(int(m.group(1)))
        sources["interval"] = "prompt"

    # capital
    if "capital" in lower:
        after = lower.split("capital", 1)[1]
        amt = _parse_inr_amount(after)
        if amt is not None:
            data["capital"] = float(amt)
            sources["capital"] = "prompt"
        else:
            warnings.append("Could not parse capital from prompt; using default.")

    # sizing
    if re.search(r"\bfixed\s*lots\b", lower):
        data["sizing_mode"] = "fixed_lots"
        sources["sizing_mode"] = "prompt"
    if re.search(r"\bfixed\s*money\b", lower):
        data["sizing_mode"] = "fixed_money"
        sources["sizing_mode"] = "prompt"
    if re.search(r"\bfixed\s*%|\bpercentage\b", lower):
        data["sizing_mode"] = "fixed_percentage"
        sources["sizing_mode"] = "prompt"

    m = re.search(r"\blots?\s*[:=]?\s*(\d+)\b", lower)
    if m:
        data["lots"] = max(1, int(m.group(1)))
        sources["lots"] = "prompt"

    if "amount" in lower:
        after = lower.split("amount", 1)[1]
        amt = _parse_inr_amount(after)
        if amt is not None:
            data["fixed_money"] = float(amt)
            sources["fixed_money"] = "prompt"
        else:
            warnings.append("Could not parse amount from prompt; using default.")

    m = re.search(r"\b(\d+(?:\.\d+)?)\s*%\s*of\s*capital\b", lower)
    if m:
        data["fixed_percentage"] = float(m.group(1))
        sources["fixed_percentage"] = "prompt"

    # roll check minutes
    m = re.search(r"\broll\s*(check)?\s*(every)?\s*(\d{1,3})\s*(m|min|minutes)\b", lower)
    if m:
        data["roll_check_minutes"] = int(m.group(3))
        sources["roll_check_minutes"] = "prompt"

    # spot move trigger pct
    m = re.search(r"\bspot\s*(move|trigger)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%\b", lower)
    if m:
        data["spot_move_pct"] = float(m.group(2))
        sources["spot_move_pct"] = "prompt"

    # optional sort directive (client-side ordering in response)
    sort = None
    m = re.search(r"\bsort\s+(trades|daily|daily pnl)\s+by\s+([a-z_ ]+?)(?:\s+(asc|desc))?\b", lower)
    if m:
        target = "trades" if m.group(1).startswith("trade") else "daily_pnl"
        field = m.group(2).strip().replace(" ", "_")
        order = (m.group(3) or "desc").lower()
        sort = {"target": target, "field": field, "order": order}

    # Post-parse: if sizing_mode fixed_money/percentage but missing its value, warn.
    if data.get("sizing_mode") == "fixed_money" and data.get("fixed_money") in (None, "", 0):
        warnings.append("Sizing is fixed_money but amount was not provided; using default sizing values.")
    if data.get("sizing_mode") == "fixed_percentage" and data.get("fixed_percentage") in (None, "", 0):
        warnings.append("Sizing is fixed_percentage but % was not provided; using default sizing values.")

    meta = {
        "note": "Generated payload from natural language.",
        "sort": sort,
        "field_sources": sources,
        "warnings": warnings,
    }
    return BacktestRequest(**data), meta

