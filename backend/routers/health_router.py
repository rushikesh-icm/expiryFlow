from fastapi import APIRouter

from dependencies import DbDep
from models import ApiConfig
from schemas import ConfigExistsResponse

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


@router.get("/config/exists", response_model=ConfigExistsResponse)
def config_exists(db: DbDep) -> ConfigExistsResponse:
    config = db.query(ApiConfig).first()
    if config:
        return ConfigExistsResponse(exists=True, client_id=config.client_id)
    return ConfigExistsResponse(exists=False)
