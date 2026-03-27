import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException

from dependencies import DbDep, auth_rate_limiter
from models import ApiConfig
from schemas import LoginRequest, LoginResponse, MessageResponse, SessionStatusResponse
from services.dhan_auth_service import generate_access_token
from services.session_service import clear_session, get_active_session, is_session_valid, save_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse, dependencies=[Depends(auth_rate_limiter)])
def login(data: LoginRequest, db: DbDep) -> LoginResponse:
    config = db.query(ApiConfig).first()
    if not config:
        raise HTTPException(status_code=400, detail="No API configuration found. Please set up first.")

    try:
        result = generate_access_token(
            client_id=config.client_id,
            pin=data.pin,
            totp=data.totp,
        )
    except httpx.HTTPStatusError as e:
        logger.warning("Dhan auth failed: status=%s body=%s", e.response.status_code, e.response.text)
        if e.response.status_code in (401, 403):
            raise HTTPException(status_code=401, detail="Authentication failed. Check your PIN and TOTP.")
        raise HTTPException(status_code=502, detail="Dhan API returned an error. Please try again.")
    except httpx.RequestError as e:
        logger.error("Dhan auth request error: %s", str(e))
        raise HTTPException(status_code=502, detail="Could not connect to Dhan API. Please check your network.")
    except ValueError as e:
        logger.warning("Dhan auth validation failed: %s", str(e))
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error during auth: %s", str(e), exc_info=True)
        raise HTTPException(status_code=502, detail=f"Authentication response parse failed: {str(e)}")

    try:
        session = save_session(db, result, fallback_client_id=config.client_id)
    except Exception as e:
        logger.error("Failed to save session: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to save session: {str(e)}")
    return LoginResponse(
        dhan_client_id=session.dhan_client_id,
        dhan_client_name=session.dhan_client_name or "",
        access_token=session.access_token,
        expiry_time=session.expiry_time,
    )


@router.get("/session", response_model=SessionStatusResponse)
def session_status(db: DbDep) -> SessionStatusResponse:
    session = get_active_session(db)
    if not session:
        return SessionStatusResponse(active=False, is_expired=True)

    valid = is_session_valid(session)
    return SessionStatusResponse(
        active=valid,
        dhan_client_id=session.dhan_client_id,
        dhan_client_name=session.dhan_client_name,
        expiry_time=session.expiry_time,
        is_expired=not valid,
    )


@router.post("/logout", response_model=MessageResponse)
def logout(db: DbDep) -> MessageResponse:
    clear_session(db)
    logger.info("Session cleared")
    return MessageResponse(message="Logged out successfully.")
