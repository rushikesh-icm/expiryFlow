import time
from collections import defaultdict
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from config import (
    AUTH_RATE_LIMIT_MAX,
    AUTH_RATE_LIMIT_WINDOW,
    GENERAL_RATE_LIMIT_MAX,
    GENERAL_RATE_LIMIT_WINDOW,
)
from database import get_db
from models import ActiveSession
from services.session_service import get_active_session, is_session_valid


class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)

    def __call__(self, request: Request):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        self._requests[client_ip] = [
            t for t in self._requests[client_ip] if now - t < self.window_seconds
        ]
        if len(self._requests[client_ip]) >= self.max_requests:
            raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")
        self._requests[client_ip].append(now)


auth_rate_limiter = RateLimiter(max_requests=AUTH_RATE_LIMIT_MAX, window_seconds=AUTH_RATE_LIMIT_WINDOW)
general_rate_limiter = RateLimiter(max_requests=GENERAL_RATE_LIMIT_MAX, window_seconds=GENERAL_RATE_LIMIT_WINDOW)

DbDep = Annotated[Session, Depends(get_db)]


def require_active_session(db: DbDep) -> ActiveSession:
    session = get_active_session(db)
    if not session or not is_session_valid(session):
        raise HTTPException(status_code=401, detail="No active session. Please log in.")
    return session


ActiveSessionDep = Annotated[ActiveSession, Depends(require_active_session)]
