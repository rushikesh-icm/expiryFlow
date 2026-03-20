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
    expiry_flag         VARCHAR NOT NULL,
    expiry_code         INTEGER NOT NULL,
    interval            VARCHAR NOT NULL,
    strike_label        VARCHAR NOT NULL,
    strike_price        DOUBLE,
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
    PRIMARY KEY (underlying_scrip, expiry_flag, expiry_code, interval, strike_label, option_type, timestamp)
);
"""

CREATE_METADATA_TABLE = """
CREATE TABLE IF NOT EXISTS download_metadata (
    id                  INTEGER PRIMARY KEY,
    underlying_scrip    VARCHAR NOT NULL,
    exchange_segment    VARCHAR NOT NULL,
    instrument          VARCHAR NOT NULL,
    expiry_flag         VARCHAR NOT NULL,
    expiry_code         INTEGER NOT NULL,
    interval            VARCHAR NOT NULL,
    strike_label        VARCHAR NOT NULL,
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


def init_duckdb():
    global _connection
    _connection = duckdb.connect(str(DUCKDB_PATH))

    # Drop old schema if it has the legacy expiry_date column
    tables = [r[0] for r in _connection.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'").fetchall()]
    if "expired_options_ohlcv" in tables:
        cols = [r[0] for r in _connection.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'expired_options_ohlcv'").fetchall()]
        if "expiry_date" in cols:
            logger.info("Dropping legacy tables with old schema")
            _connection.execute("DROP TABLE IF EXISTS expired_options_ohlcv")
            _connection.execute("DROP TABLE IF EXISTS download_metadata")
            _connection.execute("DROP SEQUENCE IF EXISTS download_metadata_id_seq")

    _connection.execute(CREATE_OHLCV_TABLE)
    _connection.execute(CREATE_METADATA_TABLE)
    _connection.execute(CREATE_METADATA_SEQ)

    # Migrate existing UTC timestamps to IST (+5:30)
    _migrate_utc_to_ist(_connection)

    logger.info("DuckDB initialized at %s", DUCKDB_PATH)


def _migrate_utc_to_ist(conn: duckdb.DuckDBPyConnection):
    """One-time migration: shift timestamps from UTC to IST.

    Uses a migration flag table to ensure this only runs once.
    """
    conn.execute("CREATE TABLE IF NOT EXISTS _migrations (name VARCHAR PRIMARY KEY)")
    already = conn.execute(
        "SELECT 1 FROM _migrations WHERE name = 'utc_to_ist'"
    ).fetchone()
    if already:
        return

    row_count = conn.execute("SELECT COUNT(*) FROM expired_options_ohlcv").fetchone()
    if row_count and row_count[0] > 0:
        logger.info("Migrating %d rows from UTC to IST (rebuild)", row_count[0])
        # Cannot UPDATE in-place because PK includes timestamp — rebuild via temp table
        conn.execute("""
            CREATE TABLE _ohlcv_tmp AS
            SELECT
                underlying_scrip, exchange_segment, instrument,
                expiry_flag, expiry_code, interval, strike_label, strike_price,
                option_type,
                timestamp + INTERVAL '5 hours 30 minutes' AS timestamp,
                open, high, low, close, volume, oi, iv, spot
            FROM expired_options_ohlcv
        """)
        conn.execute("DROP TABLE expired_options_ohlcv")
        conn.execute(CREATE_OHLCV_TABLE)
        conn.execute("""
            INSERT INTO expired_options_ohlcv
            SELECT * FROM _ohlcv_tmp
        """)
        conn.execute("DROP TABLE _ohlcv_tmp")
        logger.info("UTC to IST migration complete")

    conn.execute("INSERT INTO _migrations VALUES ('utc_to_ist')")
    logger.info("Recorded utc_to_ist migration")


def get_duckdb():
    yield _connection


def close_duckdb():
    global _connection
    if _connection:
        _connection.close()
        _connection = None
        logger.info("DuckDB connection closed")
