from __future__ import annotations
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Database (Supabase PostgreSQL) ────────────────────────────────────
    database_url: str = "postgresql+psycopg2://postgres:password@db.mnqwrofidwotcsvsymnd.supabase.co:5432/postgres"

    # ── Supabase Auth ─────────────────────────────────────────────────────
    # Get JWT secret from: Supabase Dashboard → Settings → API → JWT Secret
    supabase_jwt_secret: str = ""
    supabase_url: str = "https://mnqwrofidwotcsvsymnd.supabase.co"
    # Service role key for PostgREST access (bypasses RLS)
    supabase_service_role_key: str = ""

    # ── LLM ───────────────────────────────────────────────────────────────
    llm_api_key: str = ""

    # ── API key encryption (Fernet) ───────────────────────────────────────
    key_encryption_secret: str = "dev-encryption-key-32chars-padded"

    # ── CORS ──────────────────────────────────────────────────────────────
    cors_allow_origin: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()
