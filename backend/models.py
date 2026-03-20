from sqlalchemy import Column, Float, Integer, Text
from sqlalchemy.sql import func

from database import Base


class ApiConfig(Base):
    __tablename__ = "api_config"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Text, nullable=False)
    api_key = Column(Text, nullable=False)
    api_secret = Column(Text, nullable=False)
    created_at = Column(Text, nullable=False, server_default=func.datetime("now"))
    updated_at = Column(Text, nullable=False, server_default=func.datetime("now"), onupdate=func.datetime("now"))


class CommissionSlab(Base):
    __tablename__ = "commission_slabs"

    slab_no = Column(Integer, primary_key=True)
    turnover_from = Column(Float, nullable=False, default=0)
    turnover_to = Column(Float, nullable=False, default=999_999_999_999)
    brokerage_per_order = Column(Float, nullable=False, default=20)
    stt_sell_rate = Column(Float, nullable=False, default=0.001)
    exchange_txn_rate = Column(Float, nullable=False, default=0.0003553)
    gst_rate = Column(Float, nullable=False, default=0.18)
    sebi_per_crore = Column(Float, nullable=False, default=10)
    stamp_duty_buy_rate = Column(Float, nullable=False, default=0.00004)


class LotSize(Base):
    __tablename__ = "lot_sizes"

    symbol = Column(Text, primary_key=True)
    lot_size = Column(Integer, nullable=False)


class ActiveSession(Base):
    __tablename__ = "active_session"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dhan_client_id = Column(Text, nullable=False)
    dhan_client_name = Column(Text, nullable=True)
    access_token = Column(Text, nullable=False)
    expiry_time = Column(Text, nullable=False)
    created_at = Column(Text, nullable=False, server_default=func.datetime("now"))
