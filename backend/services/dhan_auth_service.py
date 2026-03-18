import logging

import httpx

from config import DHAN_AUTH_BASE_URL

logger = logging.getLogger(__name__)


def generate_access_token(client_id: str, pin: str, totp: str) -> dict:
    url = f"{DHAN_AUTH_BASE_URL}/app/generateAccessToken"
    params = {
        "dhanClientId": client_id,
        "pin": pin,
        "totp": totp,
    }
    logger.info("Requesting access token for client %s", client_id)
    with httpx.Client(timeout=30.0) as client:
        response = client.post(url, params=params)
        logger.info("Dhan auth response status: %s", response.status_code)
        response.raise_for_status()
        data = response.json()
        logger.info("Access token generated successfully for client %s, keys: %s", client_id, list(data.keys()))
        return data
