import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from dependencies import DbDep
from models import ApiConfig
from schemas import ConfigCreate, ConfigResponse, MessageResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/config", tags=["config"])


def _mask(value: str) -> str:
    if len(value) <= 4:
        return "****"
    return "*" * (len(value) - 4) + value[-4:]


def _to_response(config: ApiConfig) -> ConfigResponse:
    return ConfigResponse(
        client_id=config.client_id,
        api_key_masked=_mask(config.api_key),
        api_secret_masked=_mask(config.api_secret),
        created_at=config.created_at or "",
        updated_at=config.updated_at or "",
    )


@router.post("", response_model=ConfigResponse, status_code=201)
def create_config(data: ConfigCreate, db: DbDep) -> ConfigResponse:
    existing = db.query(ApiConfig).first()
    if existing:
        raise HTTPException(status_code=409, detail="Configuration already exists. Use PUT to update.")
    config = ApiConfig(
        client_id=data.client_id,
        api_key=data.api_key,
        api_secret=data.api_secret,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    logger.info("Configuration created for client %s", data.client_id)
    return _to_response(config)


@router.get("", response_model=ConfigResponse)
def get_config(db: DbDep) -> ConfigResponse:
    config = db.query(ApiConfig).first()
    if not config:
        raise HTTPException(status_code=404, detail="No configuration found. Please set up first.")
    return _to_response(config)


@router.put("", response_model=ConfigResponse)
def update_config(data: ConfigCreate, db: DbDep) -> ConfigResponse:
    config = db.query(ApiConfig).first()
    if not config:
        raise HTTPException(status_code=404, detail="No configuration found. Please create first.")
    config.client_id = data.client_id
    config.api_key = data.api_key
    config.api_secret = data.api_secret
    config.updated_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    db.refresh(config)
    logger.info("Configuration updated for client %s", data.client_id)
    return _to_response(config)


@router.delete("", response_model=MessageResponse)
def delete_config(db: DbDep) -> MessageResponse:
    from models import ActiveSession

    db.query(ActiveSession).delete()
    db.query(ApiConfig).delete()
    db.commit()
    logger.info("Configuration and session deleted")
    return MessageResponse(message="Configuration deleted successfully.")
