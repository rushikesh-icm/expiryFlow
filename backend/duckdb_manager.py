import logging
from pathlib import Path

import duckdb

logger = logging.getLogger(__name__)

DUCKDB_PATH = Path(__file__).parent / "options_data.duckdb"

_connection: duckdb.DuckDBPyConnection | None = None

CREATE_OHLCV_TABLE = """
CREATE TABLE IF NOT EXISTS expired_options_ohlcv (
    underlying_scrip    VARCHAR NOT NULL,
    exchange_segment    VARCHAR NOT NULL,
    instrument          VARCHAR NOT NULL,
    expiry_date         DATE NOT NULL,
    strike_price        DOUBLE NOT NULL,
    option_type         VARCHAR NOT NULL,
    timestamp           TIMESTAMP NOT NULL,
    open                DOUBLE,
    high                DOUBLE,
    low                 DOUBLE,
    close               DOUBLE,
    volume              BIGINT,
    oi                  BIGINT,
    iv                  DOUBLE,
    spot                DOUBLE,
    PRIMARY KEY (underlying_scrip, expiry_date, strike_price, option_type, timestamp)
);
"""

CREATE_METADATA_TABLE = """
CREATE TABLE IF NOT EXISTS download_metadata (
    id                  INTEGER PRIMARY KEY,
    underlying_scrip    VARCHAR NOT NULL,
    exchange_segment    VARCHAR NOT NULL,
    instrument          VARCHAR NOT NULL,
    expiry_date         DATE NOT NULL,
    strike_price        DOUBLE NOT NULL,
    option_type         VARCHAR NOT NULL,
    from_date           DATE NOT NULL,
    to_date             DATE NOT NULL,
    row_count           INTEGER NOT NULL DEFAULT 0,
    downloaded_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""

CREATE_METADATA_SEQ = """
CREATE SEQUENCE IF NOT EXISTS download_metadata_id_seq START 1;
"""


def _migrate_schema(conn: duckdb.DuckDBPyConnection):
    """Add columns that may be missing from older schema versions."""
    existing = [row[0] for row in conn.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'expired_options_ohlcv'").fetchall()]
    if "iv" not in existing:
        conn.execute("ALTER TABLE expired_options_ohlcv ADD COLUMN iv DOUBLE")
        logger.info("Added 'iv' column to expired_options_ohlcv")
    if "spot" not in existing:
        conn.execute("ALTER TABLE expired_options_ohlcv ADD COLUMN spot DOUBLE")
        logger.info("Added 'spot' column to expired_options_ohlcv")


def init_duckdb():
    global _connection
    _connection = duckdb.connect(str(DUCKDB_PATH))
    _connection.execute(CREATE_OHLCV_TABLE)
    _connection.execute(CREATE_METADATA_TABLE)
    _connection.execute(CREATE_METADATA_SEQ)
    _migrate_schema(_connection)
    logger.info("DuckDB initialized at %s", DUCKDB_PATH)


def get_duckdb():
    yield _connection


def close_duckdb():
    global _connection
    if _connection:
        _connection.close()
        _connection = None
        logger.info("DuckDB connection closed")
