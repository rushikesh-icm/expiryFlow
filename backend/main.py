import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from duckdb_manager import close_duckdb, init_duckdb
from routers import auth_router, backtest_router, commissions_router, config_router, download_router, health_router, straddle_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting ExpiryFlow API")
    init_db()
    init_duckdb()
    yield
    close_duckdb()
    logger.info("Shutting down ExpiryFlow API")


app = FastAPI(
    title="ExpiryFlow API",
    description="Backend for Dhan F&O expiry tracking",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


app.include_router(health_router.router)
app.include_router(config_router.router)
app.include_router(auth_router.router)
app.include_router(download_router.router)
app.include_router(straddle_router.router)
app.include_router(backtest_router.router)
app.include_router(commissions_router.router)
