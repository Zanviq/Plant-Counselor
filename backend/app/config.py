from __future__ import annotations
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── Database (PostgreSQL 16) ──────────────────────────────────────────
    # psycopg conninfo URL. docker-compose builds this from POSTGRES_* values.
    database_url: str = "postgresql://plant:plant@localhost:5432/plant_counselor"
    database_pool_size: int = 10

    # ── Session auth (httpOnly cookie carrying an HS256 JWT) ──────────────
    session_secret: str = "change-me-in-.env"
    session_cookie_name: str = "pc_session"
    session_ttl_hours: int = 24 * 7
    # Set true when the app is served over HTTPS.
    cookie_secure: bool = False

    # ── CORS ──────────────────────────────────────────────────────────────
    cors_allow_origin: str = "http://localhost:3000"


settings = Settings()
