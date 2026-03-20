import logging

from fastapi import APIRouter
from pydantic import BaseModel

from dependencies import ActiveSessionDep, DbDep
from models import CommissionSlab, LotSize

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/commissions", tags=["commissions"])


class SlabUpdate(BaseModel):
    slab_no: int
    turnover_from: float
    turnover_to: float
    brokerage_per_order: float
    stt_sell_rate: float
    exchange_txn_rate: float
    gst_rate: float
    sebi_per_crore: float
    stamp_duty_buy_rate: float


class LotSizeUpdate(BaseModel):
    symbol: str
    lot_size: int


@router.get("/slabs")
def get_slabs(session: ActiveSessionDep, db: DbDep) -> list[dict]:
    slabs = db.query(CommissionSlab).order_by(CommissionSlab.slab_no).all()
    return [
        {
            "slab_no": s.slab_no,
            "turnover_from": s.turnover_from,
            "turnover_to": s.turnover_to,
            "brokerage_per_order": s.brokerage_per_order,
            "stt_sell_rate": s.stt_sell_rate,
            "exchange_txn_rate": s.exchange_txn_rate,
            "gst_rate": s.gst_rate,
            "sebi_per_crore": s.sebi_per_crore,
            "stamp_duty_buy_rate": s.stamp_duty_buy_rate,
        }
        for s in slabs
    ]


@router.put("/slabs")
def update_slabs(slabs: list[SlabUpdate], session: ActiveSessionDep, db: DbDep) -> dict:
    db.query(CommissionSlab).delete()
    for s in slabs:
        db.add(CommissionSlab(**s.model_dump()))
    db.commit()
    return {"message": f"Saved {len(slabs)} commission slabs"}


@router.get("/lot-sizes")
def get_lot_sizes(session: ActiveSessionDep, db: DbDep) -> list[dict]:
    lots = db.query(LotSize).order_by(LotSize.symbol).all()
    return [{"symbol": l.symbol, "lot_size": l.lot_size} for l in lots]


@router.put("/lot-sizes")
def update_lot_sizes(lot_sizes: list[LotSizeUpdate], session: ActiveSessionDep, db: DbDep) -> dict:
    db.query(LotSize).delete()
    for ls in lot_sizes:
        db.add(LotSize(**ls.model_dump()))
    db.commit()
    return {"message": f"Saved {len(lot_sizes)} lot sizes"}
