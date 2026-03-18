from sqlalchemy import Column, Integer, Text
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


class ActiveSession(Base):
    __tablename__ = "active_session"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dhan_client_id = Column(Text, nullable=False)
    dhan_client_name = Column(Text, nullable=True)
    access_token = Column(Text, nullable=False)
    expiry_time = Column(Text, nullable=False)
    created_at = Column(Text, nullable=False, server_default=func.datetime("now"))
