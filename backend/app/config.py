from __future__ import annotations
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./plant_counselor.db"
    jwt_secret: str = "dev-secret"
    jwt_access_ttl: int = 15  # minutes
    jwt_refresh_ttl: int = 14  # days
    llm_api_key: str = ""
    key_encryption_secret: str = "dev-encryption-key-32chars-padded"
    cors_allow_origin: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()

