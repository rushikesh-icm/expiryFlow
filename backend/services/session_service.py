from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from config import SESSION_CHECK_BUFFER_MINUTES
from models import ActiveSession


def _get_key(data: dict, *keys: str) -> str:
    for key in keys:
        if key in data:
            return data[key]
    raise KeyError(f"None of {keys} found in response")


def save_session(db: Session, data: dict) -> ActiveSession:
    db.query(ActiveSession).delete()
    session = ActiveSession(
        dhan_client_id=_get_key(data, "dhanClientId", "dhan_client_id", "clientId"),
        dhan_client_name=data.get("dhanClientName", data.get("dhan_client_name", "")),
        access_token=_get_key(data, "accessToken", "access_token"),
        expiry_time=_get_key(data, "expiryTime", "expiry_time"),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_active_session(db: Session) -> ActiveSession | None:
    return db.query(ActiveSession).first()


def is_session_valid(session: ActiveSession) -> bool:
    if not session:
        return False
    try:
        expiry = datetime.fromisoformat(session.expiry_time)
        buffer = timedelta(minutes=SESSION_CHECK_BUFFER_MINUTES)
        return datetime.now() < (expiry - buffer)
    except (ValueError, TypeError):
        return False


def clear_session(db: Session) -> None:
    db.query(ActiveSession).delete()
    db.commit()
