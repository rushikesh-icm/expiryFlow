import logging
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent / "expiry_tracker.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from models import ActiveSession, ApiConfig, CommissionSlab, LotSize  # noqa: F401

    Base.metadata.create_all(bind=engine)

    # Seed defaults
    db = SessionLocal()
    try:
        if db.query(CommissionSlab).count() == 0:
            db.add_all([
                CommissionSlab(slab_no=1, turnover_from=0, turnover_to=100_000,
                               brokerage_per_order=20, stt_sell_rate=0.001, exchange_txn_rate=0.0003553,
                               gst_rate=0.18, sebi_per_crore=10, stamp_duty_buy_rate=0.00004),
                CommissionSlab(slab_no=2, turnover_from=100_000, turnover_to=1_000_000,
                               brokerage_per_order=20, stt_sell_rate=0.001, exchange_txn_rate=0.0003553,
                               gst_rate=0.18, sebi_per_crore=10, stamp_duty_buy_rate=0.00003),
                CommissionSlab(slab_no=3, turnover_from=1_000_000, turnover_to=10_000_000,
                               brokerage_per_order=20, stt_sell_rate=0.001, exchange_txn_rate=0.0003553,
                               gst_rate=0.18, sebi_per_crore=10, stamp_duty_buy_rate=0.00003),
            ])
            db.commit()

        if db.query(LotSize).count() == 0:
            db.add_all([
                LotSize(symbol="NIFTY", lot_size=65),
                LotSize(symbol="BANKNIFTY", lot_size=30),
                LotSize(symbol="SENSEX", lot_size=20),
            ])
            db.commit()
    finally:
        db.close()

    logger.info("Database initialized at %s", DB_PATH)
