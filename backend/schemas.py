from pydantic import BaseModel, field_validator


class ConfigCreate(BaseModel):
    client_id: str
    api_key: str
    api_secret: str

    @field_validator("client_id", "api_key", "api_secret")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be empty")
        return v.strip()


class ConfigResponse(BaseModel):
    client_id: str
    api_key_masked: str
    api_secret_masked: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class ConfigExistsResponse(BaseModel):
    exists: bool
    client_id: str | None = None


class LoginRequest(BaseModel):
    pin: str
    totp: str

    @field_validator("pin", "totp")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be empty")
        return v.strip()


class LoginResponse(BaseModel):
    dhan_client_id: str
    dhan_client_name: str
    access_token: str
    expiry_time: str


class SessionStatusResponse(BaseModel):
    active: bool
    dhan_client_id: str | None = None
    dhan_client_name: str | None = None
    expiry_time: str | None = None
    is_expired: bool = True


class MessageResponse(BaseModel):
    message: str


# --- Download schemas ---
class DownloadRequest(BaseModel):
    underlying_scrip: str
    exchange_segment: str
    instrument: str
    security_id: int
    option_type: str          # "CALL", "PUT", "BOTH"
    expiry_flag: str          # "MONTH" or "WEEK"
    expiry_code: int = 1      # API: 1=current/near, 2=next, 3=far (docs say 0-based but API rejects 0)
    strike_range: int = 10    # ATM +/- N
    interval: str = "1"       # "1","5","15","25","60","D"
    from_date: str
    to_date: str

    @field_validator("underlying_scrip", "exchange_segment", "instrument", "option_type", "expiry_flag", "interval", "from_date", "to_date")
    @classmethod
    def not_empty_str(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field cannot be empty")
        return v.strip()


class DownloadProgress(BaseModel):
    job_id: str
    status: str
    total_requests: int
    completed_requests: int
    skipped_requests: int
    failed_requests: int
    rows_downloaded: int
    error_message: str | None = None
    started_at: str | None = None
    completed_at: str | None = None


class DownloadHistoryItem(BaseModel):
    underlying_scrip: str
    expiry_flag: str
    expiry_code: int
    interval: str
    strike_label: str
    option_type: str
    from_date: str
    to_date: str
    row_count: int
    downloaded_at: str


class DownloadHistoryResponse(BaseModel):
    items: list[DownloadHistoryItem]
    total: int


class RateLimitStatus(BaseModel):
    requests_today: int
    daily_limit: int
    daily_remaining: int


# --- Straddle schemas ---
class StraddleUnderlyingsResponse(BaseModel):
    underlyings: list[str]


class StraddleDatesResponse(BaseModel):
    dates: list[str]


class StraddleRow(BaseModel):
    timestamp: str
    strike_price: float | None
    ce_open: float | None
    ce_high: float | None
    ce_low: float | None
    ce_close: float | None
    pe_open: float | None
    pe_high: float | None
    pe_low: float | None
    pe_close: float | None
    combined_premium: float | None
    ce_iv: float | None
    pe_iv: float | None
    ce_volume: int | None
    pe_volume: int | None
    ce_oi: int | None
    pe_oi: int | None
    spot: float | None


class StraddleDataResponse(BaseModel):
    rows: list[StraddleRow]
    total: int
