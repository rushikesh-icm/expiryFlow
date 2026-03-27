import logging
import os
from datetime import datetime, timedelta, timezone

import httpx

from config import DHAN_AUTH_BASE_URL

logger = logging.getLogger(__name__)


def _pick_str(data: dict, *keys: str) -> str | None:
    for key in keys:
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _extract_error_message(payload: dict) -> str | None:
    # Common error fields used by APIs
    direct = _pick_str(payload, "message", "error", "detail", "remarks")
    if direct:
        return direct

    # Nested wrappers like {"data": {...}} or {"result": {...}} or {"remarks": {...}}
    for key in ("data", "result", "remarks"):
        nested = payload.get(key)
        if isinstance(nested, dict):
            msg = _pick_str(nested, "message", "error", "detail", "remarks", "description")
            if msg:
                return msg

    # Sometimes status+reason are split
    status = _pick_str(payload, "status", "code")
    reason = _pick_str(payload, "reason", "description")
    if status and reason:
        return f"{status}: {reason}"
    if reason:
        return reason
    return None


def _normalize_auth_payload(payload: dict, requested_client_id: str) -> dict:
    # Dhan auth responses can be flat or nested under "data"/"result".
    body = payload
    nested = payload.get("data")
    if isinstance(nested, dict):
        body = nested
    elif isinstance(payload.get("result"), dict):
        body = payload["result"]

    access_token = _pick_str(
        body,
        "accessToken",
        "access_token",
        "token",
        "jwtToken",
        "jwt_token",
    ) or _pick_str(
        payload,
        "accessToken",
        "access_token",
        "token",
        "jwtToken",
        "jwt_token",
    )

    expiry_time = _pick_str(
        body,
        "expiryTime",
        "expiry_time",
        "expiresAt",
        "expires_at",
        "validTill",
        "valid_till",
    ) or _pick_str(
        payload,
        "expiryTime",
        "expiry_time",
        "expiresAt",
        "expires_at",
        "validTill",
        "valid_till",
    )

    # If upstream omits expiry, keep a safe short-lived fallback.
    if not expiry_time:
        expiry_time = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

    dhan_client_id = _pick_str(body, "dhanClientId", "dhan_client_id", "clientId") or _pick_str(
        payload, "dhanClientId", "dhan_client_id", "clientId"
    ) or requested_client_id
    dhan_client_name = _pick_str(body, "dhanClientName", "dhan_client_name", "clientName") or _pick_str(
        payload, "dhanClientName", "dhan_client_name", "clientName"
    ) or ""

    return {
        "dhanClientId": dhan_client_id,
        "dhanClientName": dhan_client_name,
        "accessToken": access_token,
        "expiryTime": expiry_time,
    }


def generate_access_token(client_id: str, pin: str, totp: str) -> dict:
    url = f"{DHAN_AUTH_BASE_URL}/app/generateAccessToken"
    params = {
        "dhanClientId": client_id,
        "pin": pin,
        "totp": totp,
    }
    logger.info("Requesting access token for client %s", client_id)
    # Corporate proxies (e.g. Netskope) often use a custom root CA that curl trusts via
    # system bundle, but Python may not. Prefer system CA bundle if available.
    verify: str | bool = os.getenv("SSL_CERT_FILE", "/etc/ssl/certs/ca-certificates.crt")
    if os.getenv("DHAN_SSL_VERIFY", "true").strip().lower() in {"0", "false", "no"}:
        verify = False
    with httpx.Client(timeout=30.0, verify=verify) as client:
        response = client.post(url, params=params)
        logger.info("Dhan auth response status: %s", response.status_code)
        response.raise_for_status()
        data = response.json()
        normalized = _normalize_auth_payload(data, requested_client_id=client_id)
        if not normalized.get("accessToken"):
            upstream_message = _extract_error_message(data)
            logger.error(
                "Dhan auth payload missing token. keys=%s message=%s payload=%s",
                list(data.keys()),
                upstream_message,
                data,
            )
            if upstream_message:
                raise ValueError(f"Dhan auth failed: {upstream_message}")
            raise ValueError("Dhan auth response did not include access token")
        logger.info("Access token generated successfully for client %s, keys: %s", client_id, list(data.keys()))
        return normalized
