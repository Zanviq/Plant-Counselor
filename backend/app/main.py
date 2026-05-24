from __future__ import annotations
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.base import Base
from app.db.session import engine
from app.routers import auth, buds, chat, conversations, me, notifications, plants, stats


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    from app.scheduler.jobs import setup_scheduler

    sched = setup_scheduler()
    yield
    sched.shutdown()


app = FastAPI(title="Plant Counselor API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_allow_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
for _router in [
    auth.router,
    me.router,
    plants.router,
    buds.router,
    stats.router,
    chat.router,
    conversations.router,
    notifications.router,
]:
    app.include_router(_router, prefix=PREFIX)


@app.get("/health")
def health():
    return {"status": "ok"}

