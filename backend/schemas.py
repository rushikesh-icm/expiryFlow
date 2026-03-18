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
