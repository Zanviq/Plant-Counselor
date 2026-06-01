from __future__ import annotations
from contextlib import asynccontextmanager
from urllib.parse import urlsplit

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import admin, buds, chat, conversations, me, notifications, plants, stats


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Tables are managed by Supabase migrations — no create_all needed.
    from app.scheduler.jobs import setup_scheduler
    sched = setup_scheduler()
    yield
    sched.shutdown()


api = FastAPI(title="Plant Counselor API", version="0.2.0", lifespan=lifespan)

def _parse_cors_origins(raw: str) -> list[str]:
    """Return exact browser origins and reject unsafe deployment settings."""
    origins: list[str] = []
    for candidate in raw.split(","):
        origin = candidate.strip()
        if not origin:
            continue
        if origin in {"*", "null"}:
            raise ValueError("CORS_ALLOW_ORIGIN must list explicit http(s) origins; wildcard and null are not allowed")

        parsed = urlsplit(origin)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or parsed.username
            or parsed.password
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError(f"Invalid CORS origin: {origin!r}")

        normalized = f"{parsed.scheme}://{parsed.netloc}"
        if normalized not in origins:
            origins.append(normalized)

    if not origins:
        raise ValueError("CORS_ALLOW_ORIGIN must include at least one explicit http(s) origin")
    return origins


# CORS_ALLOW_ORIGIN may be a single origin or a comma-separated list, e.g.
# "http://localhost:3000,https://my-app.vercel.app" — so local dev and the
# deployed frontend can both be allowed at the same time.
_cors_origins = _parse_cors_origins(settings.cors_allow_origin)

PREFIX = "/api/v1"
for _router in [
    me.router,
    plants.router,
    buds.router,
    stats.router,
    chat.router,
    conversations.router,
    notifications.router,
    admin.router,
]:
    api.include_router(_router, prefix=PREFIX)


@api.get("/health")
def health():
    return {"status": "ok"}


# Wrap the entire FastAPI application so even unhandled 500 responses include
# CORS headers. Without the outer wrapper, browsers can report a misleading
# CORS failure instead of exposing the underlying server error.
app = CORSMiddleware(
    app=api,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
