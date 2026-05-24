# Backend AI Layer, Auth, Routers, Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete FastAPI backend for Plant Counselor — repositories, services, AI layer (14 skills + orchestrator), JWT auth, 8 routers, and APScheduler job.

**Architecture:** Layered: Repositories (SQLAlchemy CRUD) → Services (domain logic) → AI Layer (Skill dispatch + LLM streaming) → Routers (FastAPI). All imports are absolute (`from app.xxx`). Services are instantiated at module level in each router file via a `get_*_service()` helper that uses `Depends(get_db)`.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, python-jose, passlib[argon2], anthropic SDK, APScheduler, python-ulid, cryptography, pydantic-settings

---

## File Map

| File | Responsibility |
|------|---------------|
| `app/schemas/bud.py` | BudOut, BudUpdate, BudWithHistory, BudListResponse |
| `app/schemas/chat.py` | ChatRequest, ApiSuccess, SummaryStats |
| `app/schemas/conversation.py` | ConversationOut, MessageOut, SearchRequest |
| `app/schemas/notification.py` | NotificationOut |
| `app/repositories/__init__.py` | empty |
| `app/repositories/user_repo.py` | UserRepo CRUD |
| `app/repositories/plant_repo.py` | PlantRepo CRUD + search |
| `app/repositories/bud_repo.py` | BudRepo CRUD + history |
| `app/repositories/garden_state_repo.py` | GardenStateRepo |
| `app/repositories/conversation_repo.py` | ConversationRepo |
| `app/repositories/notification_repo.py` | NotificationRepo |
| `app/services/__init__.py` | empty |
| `app/services/exceptions.py` | DomainError |
| `app/services/user_service.py` | UserService |
| `app/services/plant_service.py` | PlantService |
| `app/services/bud_service.py` | BudService |
| `app/services/garden_state_service.py` | GardenStateService |
| `app/services/conversation_service.py` | ConversationService |
| `app/services/notification_service.py` | NotificationService |
| `app/services/transition_service.py` | TransitionService (background) |
| `app/deps.py` | get_db, get_current_user, require_user |
| `app/ai/__init__.py` | empty |
| `app/ai/skill_base.py` | SkillBase, SkillResult, SkillContext |
| `app/ai/skill_registry.py` | SkillRegistry |
| `app/ai/skills/__init__.py` | empty |
| `app/ai/skills/match_plant.py` | MatchPlantSkill |
| `app/ai/skills/create_plant.py` | CreatePlantSkill |
| `app/ai/skills/delete_plant.py` | DeletePlantSkill |
| `app/ai/skills/create_bud.py` | CreateBudSkill |
| `app/ai/skills/update_bud_status.py` | UpdateBudStatusSkill |
| `app/ai/skills/update_bud_progress.py` | UpdateBudProgressSkill |
| `app/ai/skills/set_deadline.py` | SetDeadlineSkill |
| `app/ai/skills/abandon_bud.py` | AbandonBudSkill |
| `app/ai/skills/harvest_bud.py` | HarvestBudSkill |
| `app/ai/skills/list_plants.py` | ListPlantsSkill |
| `app/ai/skills/list_buds.py` | ListBudsSkill |
| `app/ai/skills/get_statistics.py` | GetStatisticsSkill |
| `app/ai/skills/get_garden_briefing.py` | GetGardenBriefingSkill |
| `app/ai/skills/search_conversation.py` | SearchConversationSkill |
| `app/ai/prompt_builder.py` | PromptBuilder |
| `app/ai/llm_client.py` | LLMClient (sync + async stream) |
| `app/ai/chat_orchestrator.py` | ChatOrchestrator |
| `app/auth/__init__.py` | empty |
| `app/auth/jwt.py` | create/decode JWT tokens |
| `app/routers/__init__.py` | empty |
| `app/routers/auth.py` | signup, login, refresh, logout |
| `app/routers/me.py` | profile CRUD, password, delete, api-key |
| `app/routers/plants.py` | plant CRUD |
| `app/routers/buds.py` | bud list/detail/patch |
| `app/routers/stats.py` | summary, full, calendar, briefing |
| `app/routers/notifications.py` | list, ack |
| `app/routers/chat.py` | SSE streaming chat |
| `app/routers/conversations.py` | history, search |
| `app/scheduler/__init__.py` | empty |
| `app/scheduler/jobs.py` | APScheduler setup |
| `app/main.py` | FastAPI app, CORS, lifespan, router registration |

---

## Task 1: Remaining Schemas

**Files:**
- Create: `backend/app/schemas/bud.py`
- Create: `backend/app/schemas/chat.py`
- Create: `backend/app/schemas/conversation.py`
- Create: `backend/app/schemas/notification.py`

- [ ] **Step 1: Write bud.py**

```python
# backend/app/schemas/bud.py
from datetime import datetime, date
from typing import Any
from pydantic import BaseModel, ConfigDict


class BudOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    plant_id: str
    title: str
    detail: str
    type: str
    status: str
    progress: int
    deadline: date | None
    last_progress_at: datetime | None
    disappeared_at: datetime | None
    created_at: datetime
    updated_at: datetime


class BudHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    bud_id: str
    from_status: str
    to_status: str
    at: datetime
    reason: str


class BudWithHistory(BaseModel):
    bud: BudOut
    history: list[BudHistoryOut]


class BudUpdate(BaseModel):
    title: str | None = None
    detail: str | None = None


class BudListResponse(BaseModel):
    items: list[BudOut]
```

- [ ] **Step 2: Write chat.py**

```python
# backend/app/schemas/chat.py
from pydantic import BaseModel


class ChatRequest(BaseModel):
    text: str
    scope: str = "global"
    scope_id: str | None = None
    current_screen: str = "홈"


class ApiSuccess(BaseModel):
    ok: bool = True
    data: dict = {}


class SummaryStats(BaseModel):
    active_concerns: int
    active_schedules: int
    harvested_this_month: int
    wilting_count: int
    rot_count: int
    total_plants: int
```

- [ ] **Step 3: Write conversation.py**

```python
# backend/app/schemas/conversation.py
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    role: str
    text: str
    skill_call: dict | None
    at: datetime


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    scope: str
    scope_id: str | None
    created_at: datetime
    updated_at: datetime
    messages: list[MessageOut] = []


class SearchRequest(BaseModel):
    query: str
    scope: str = "global"
    scope_id: str | None = None
    limit: int = 10
```

- [ ] **Step 4: Write notification.py**

```python
# backend/app/schemas/notification.py
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    kind: str
    payload: dict
    created_at: datetime
    acked_at: datetime | None
```

- [ ] **Step 5: Verify imports**

```bash
cd C:/Users/jaemi/Documents/Project/plant-counselor/backend
python -c "from app.schemas.bud import BudOut, BudUpdate; from app.schemas.chat import ChatRequest, SummaryStats; from app.schemas.conversation import MessageOut, SearchRequest; from app.schemas.notification import NotificationOut; print('schemas OK')"
```
Expected: `schemas OK`

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" add backend/app/schemas/
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" commit -m "feat(schemas): add bud, chat, conversation, notification schemas"
```

---

## Task 2: Repositories

**Files:**
- Create: `backend/app/repositories/__init__.py`
- Create: `backend/app/repositories/user_repo.py`
- Create: `backend/app/repositories/plant_repo.py`
- Create: `backend/app/repositories/bud_repo.py`
- Create: `backend/app/repositories/garden_state_repo.py`
- Create: `backend/app/repositories/conversation_repo.py`
- Create: `backend/app/repositories/notification_repo.py`

- [ ] **Step 1: Write `__init__.py`** (empty file — write a single newline)

- [ ] **Step 2: Write user_repo.py**

```python
# backend/app/repositories/user_repo.py
from sqlalchemy.orm import Session
from app.db.models.user import User


class UserRepo:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: str) -> User | None:
        return self.db.get(User, user_id)

    def get_by_nickname(self, nickname: str) -> User | None:
        return self.db.query(User).filter(User.nickname == nickname).first()

    def create(self, user: User) -> User:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update(self, user: User) -> User:
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete(self, user: User) -> None:
        self.db.delete(user)
        self.db.commit()
```

- [ ] **Step 3: Write plant_repo.py**

```python
# backend/app/repositories/plant_repo.py
from sqlalchemy.orm import Session
from app.db.models.plant import Plant


class PlantRepo:
    def __init__(self, db: Session):
        self.db = db

    def get(self, plant_id: str) -> Plant | None:
        return self.db.get(Plant, plant_id)

    def list_by_user(self, user_id: str, include_archived: bool = False) -> list[Plant]:
        q = self.db.query(Plant).filter(Plant.user_id == user_id)
        if not include_archived:
            q = q.filter(Plant.status != "archived")
        return q.order_by(Plant.last_activity_at.desc().nullslast()).all()

    def create(self, plant: Plant) -> Plant:
        self.db.add(plant)
        self.db.commit()
        self.db.refresh(plant)
        return plant

    def update(self, plant: Plant) -> Plant:
        self.db.commit()
        self.db.refresh(plant)
        return plant

    def delete(self, plant: Plant) -> None:
        self.db.delete(plant)
        self.db.commit()

    def search_by_name(self, user_id: str, query: str) -> list[Plant]:
        return (
            self.db.query(Plant)
            .filter(Plant.user_id == user_id, Plant.status != "archived")
            .filter(Plant.name.ilike(f"%{query}%"))
            .limit(10)
            .all()
        )
```

- [ ] **Step 4: Write bud_repo.py**

```python
# backend/app/repositories/bud_repo.py
from sqlalchemy.orm import Session
from app.db.models.bud import Bud, BudHistory


class BudRepo:
    def __init__(self, db: Session):
        self.db = db

    def get(self, bud_id: str) -> Bud | None:
        return self.db.get(Bud, bud_id)

    def list_by_user(self, user_id: str, plant_id: str | None = None,
                     statuses: list[str] | None = None,
                     bud_type: str | None = None,
                     wilting_only: bool = False) -> list[Bud]:
        q = self.db.query(Bud).filter(Bud.user_id == user_id,
                                       Bud.disappeared_at.is_(None))
        if plant_id:
            q = q.filter(Bud.plant_id == plant_id)
        if statuses:
            q = q.filter(Bud.status.in_(statuses))
        if bud_type:
            q = q.filter(Bud.type == bud_type)
        if wilting_only:
            q = q.filter(Bud.status == "wilting")
        return q.order_by(Bud.created_at.desc()).all()

    def create(self, bud: Bud) -> Bud:
        self.db.add(bud)
        self.db.commit()
        self.db.refresh(bud)
        return bud

    def update(self, bud: Bud) -> Bud:
        self.db.commit()
        self.db.refresh(bud)
        return bud

    def add_history(self, history: BudHistory) -> BudHistory:
        self.db.add(history)
        self.db.commit()
        return history

    def get_history(self, bud_id: str) -> list[BudHistory]:
        return (
            self.db.query(BudHistory)
            .filter(BudHistory.bud_id == bud_id)
            .order_by(BudHistory.at.asc())
            .all()
        )
```

- [ ] **Step 5: Write garden_state_repo.py**

```python
# backend/app/repositories/garden_state_repo.py
from sqlalchemy.orm import Session
from app.db.models.garden_state import GardenState


class GardenStateRepo:
    def __init__(self, db: Session):
        self.db = db

    def get_by_user(self, user_id: str) -> GardenState | None:
        return self.db.query(GardenState).filter(
            GardenState.user_id == user_id
        ).first()

    def create(self, gs: GardenState) -> GardenState:
        self.db.add(gs)
        self.db.commit()
        self.db.refresh(gs)
        return gs

    def update(self, gs: GardenState) -> GardenState:
        self.db.commit()
        self.db.refresh(gs)
        return gs
```

- [ ] **Step 6: Write conversation_repo.py**

```python
# backend/app/repositories/conversation_repo.py
from sqlalchemy.orm import Session
from app.db.models.conversation import Conversation, ConversationMessage


class ConversationRepo:
    def __init__(self, db: Session):
        self.db = db

    def get_or_create(self, user_id: str, scope: str,
                      scope_id: str | None) -> Conversation:
        conv = (
            self.db.query(Conversation)
            .filter(
                Conversation.user_id == user_id,
                Conversation.scope == scope,
                Conversation.scope_id == scope_id,
            )
            .first()
        )
        if conv:
            return conv
        from python_ulid import ULID
        conv = Conversation(
            id=str(ULID()),
            user_id=user_id,
            scope=scope,
            scope_id=scope_id,
        )
        self.db.add(conv)
        self.db.commit()
        self.db.refresh(conv)
        return conv

    def list_by_user(self, user_id: str) -> list[Conversation]:
        return (
            self.db.query(Conversation)
            .filter(Conversation.user_id == user_id)
            .order_by(Conversation.updated_at.desc())
            .all()
        )

    def get_messages(self, conversation_id: str,
                     limit: int = 20) -> list[ConversationMessage]:
        return (
            self.db.query(ConversationMessage)
            .filter(ConversationMessage.conversation_id == conversation_id)
            .order_by(ConversationMessage.at.desc())
            .limit(limit)
            .all()
        )

    def add_message(self, msg: ConversationMessage) -> ConversationMessage:
        self.db.add(msg)
        self.db.commit()
        return msg

    def search_messages(self, user_id: str, query: str,
                        limit: int = 10) -> list[ConversationMessage]:
        conv_ids = [
            c.id for c in self.db.query(Conversation.id)
            .filter(Conversation.user_id == user_id).all()
        ]
        if not conv_ids:
            return []
        return (
            self.db.query(ConversationMessage)
            .filter(
                ConversationMessage.conversation_id.in_(conv_ids),
                ConversationMessage.text.ilike(f"%{query}%"),
            )
            .order_by(ConversationMessage.at.desc())
            .limit(limit)
            .all()
        )
```

- [ ] **Step 7: Write notification_repo.py**

```python
# backend/app/repositories/notification_repo.py
from sqlalchemy.orm import Session
from app.db.models.notification import Notification


class NotificationRepo:
    def __init__(self, db: Session):
        self.db = db

    def create(self, n: Notification) -> Notification:
        self.db.add(n)
        self.db.commit()
        self.db.refresh(n)
        return n

    def list_unread(self, user_id: str) -> list[Notification]:
        return (
            self.db.query(Notification)
            .filter(Notification.user_id == user_id,
                    Notification.acked_at.is_(None))
            .order_by(Notification.created_at.desc())
            .all()
        )

    def get(self, notification_id: str) -> Notification | None:
        return self.db.get(Notification, notification_id)

    def update(self, n: Notification) -> Notification:
        self.db.commit()
        self.db.refresh(n)
        return n
```

- [ ] **Step 8: Verify imports**

```bash
cd C:/Users/jaemi/Documents/Project/plant-counselor/backend
python -c "
from app.repositories.user_repo import UserRepo
from app.repositories.plant_repo import PlantRepo
from app.repositories.bud_repo import BudRepo
from app.repositories.garden_state_repo import GardenStateRepo
from app.repositories.conversation_repo import ConversationRepo
from app.repositories.notification_repo import NotificationRepo
print('repos OK')
"
```
Expected: `repos OK`

- [ ] **Step 9: Commit**

```bash
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" add backend/app/repositories/
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" commit -m "feat(repos): add all repository classes"
```

---

## Task 3: Services — Exceptions + UserService

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/exceptions.py`
- Create: `backend/app/services/user_service.py`

- [ ] **Step 1: Write `__init__.py`** (empty)

- [ ] **Step 2: Write exceptions.py**

```python
# backend/app/services/exceptions.py

class DomainError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)
```

- [ ] **Step 3: Write user_service.py**

```python
# backend/app/services/user_service.py
from datetime import datetime
from python_ulid import ULID
from passlib.context import CryptContext
from cryptography.fernet import Fernet
import base64

from sqlalchemy.orm import Session
from app.db.models.user import User
from app.db.models.garden_state import GardenState
from app.repositories.user_repo import UserRepo
from app.repositories.garden_state_repo import GardenStateRepo
from app.services.exceptions import DomainError
from app.config import settings

_pwd = CryptContext(schemes=["argon2"], deprecated="auto")


def _make_fernet() -> Fernet:
    key = settings.key_encryption_secret.encode()
    key = key[:32].ljust(32, b"x")
    return Fernet(base64.urlsafe_b64encode(key))


class UserService:
    def __init__(self, db: Session):
        self.db = db
        self._user_repo = UserRepo(db)
        self._gs_repo = GardenStateRepo(db)

    def signup(self, nickname: str, password: str) -> User:
        if len(password) < 8:
            raise DomainError("password_too_short", "비밀번호는 8자 이상이어야 합니다.")
        if self._user_repo.get_by_nickname(nickname):
            raise DomainError("nickname_taken", "이미 사용 중인 닉네임입니다.")
        user = User(
            id=str(ULID()),
            nickname=nickname,
            password_hash=_pwd.hash(password),
        )
        self._user_repo.create(user)
        # Initialize GardenState
        gs = GardenState(id=str(ULID()), user_id=user.id)
        self._gs_repo.create(gs)
        return user

    def authenticate(self, nickname: str, password: str) -> User:
        user = self._user_repo.get_by_nickname(nickname)
        if not user or not _pwd.verify(password, user.password_hash):
            raise DomainError("invalid_credentials", "닉네임 또는 비밀번호가 틀렸습니다.")
        return user

    def get_me(self, user_id: str) -> User:
        user = self._user_repo.get_by_id(user_id)
        if not user:
            raise DomainError("not_found", "사용자를 찾을 수 없습니다.")
        return user

    def update_profile(self, user_id: str, fields: dict) -> User:
        user = self.get_me(user_id)
        for key, value in fields.items():
            if value is not None and hasattr(user, key):
                setattr(user, key, value)
        user.updated_at = datetime.utcnow()
        return self._user_repo.update(user)

    def change_password(self, user_id: str, old: str, new: str) -> None:
        user = self.get_me(user_id)
        if not _pwd.verify(old, user.password_hash):
            raise DomainError("wrong_password", "현재 비밀번호가 틀렸습니다.")
        if len(new) < 8:
            raise DomainError("password_too_short", "새 비밀번호는 8자 이상이어야 합니다.")
        user.password_hash = _pwd.hash(new)
        user.updated_at = datetime.utcnow()
        self._user_repo.update(user)

    def delete_account(self, user_id: str, confirm_nickname: str) -> None:
        user = self.get_me(user_id)
        if user.nickname != confirm_nickname:
            raise DomainError("nickname_mismatch", "닉네임이 일치하지 않습니다.")
        self._user_repo.delete(user)

    def set_api_key(self, user_id: str, api_key: str) -> None:
        user = self.get_me(user_id)
        f = _make_fernet()
        user.encrypted_api_key = f.encrypt(api_key.encode()).decode()
        user.updated_at = datetime.utcnow()
        self._user_repo.update(user)

    def get_api_key(self, user_id: str) -> str | None:
        user = self.get_me(user_id)
        if not user.encrypted_api_key:
            return None
        f = _make_fernet()
        return f.decrypt(user.encrypted_api_key.encode()).decode()
```

- [ ] **Step 4: Commit**

```bash
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" add backend/app/services/
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" commit -m "feat(services): add DomainError and UserService"
```

---

## Task 4: Services — PlantService + BudService

**Files:**
- Create: `backend/app/services/plant_service.py`
- Create: `backend/app/services/bud_service.py`

- [ ] **Step 1: Write plant_service.py**

```python
# backend/app/services/plant_service.py
from datetime import datetime
from python_ulid import ULID
from sqlalchemy.orm import Session

from app.db.models.plant import Plant
from app.repositories.plant_repo import PlantRepo
from app.services.exceptions import DomainError


class PlantService:
    def __init__(self, db: Session):
        self.db = db
        self._repo = PlantRepo(db)

    def create(self, user_id: str, name: str, description: str = "",
               species: str = "tree_oak", color: str = "brand.primary_leaf") -> Plant:
        plant = Plant(
            id=str(ULID()),
            user_id=user_id,
            name=name,
            description=description,
            species=species,
            color=color,
            last_activity_at=datetime.utcnow(),
        )
        return self._repo.create(plant)

    def get(self, user_id: str, plant_id: str) -> Plant:
        plant = self._repo.get(plant_id)
        if not plant or plant.user_id != user_id:
            raise DomainError("not_found", "식물을 찾을 수 없습니다.")
        return plant

    def list(self, user_id: str, include_dormant: bool = True,
             sort: str = "activity") -> list[Plant]:
        plants = self._repo.list_by_user(user_id, include_archived=False)
        if not include_dormant:
            plants = [p for p in plants if p.status != "dormant"]
        if sort == "name":
            plants.sort(key=lambda p: p.name)
        elif sort == "created":
            plants.sort(key=lambda p: p.created_at, reverse=True)
        return plants

    def update(self, user_id: str, plant_id: str, fields: dict) -> Plant:
        plant = self.get(user_id, plant_id)
        for key, value in fields.items():
            if value is not None and hasattr(plant, key):
                setattr(plant, key, value)
        plant.updated_at = datetime.utcnow()
        return self._repo.update(plant)

    def delete(self, user_id: str, plant_id: str, archive: bool = True) -> None:
        plant = self.get(user_id, plant_id)
        if archive:
            plant.status = "archived"
            plant.updated_at = datetime.utcnow()
            self._repo.update(plant)
        else:
            self._repo.delete(plant)

    def find_matches(self, user_id: str, query: str,
                     top_k: int = 3) -> list[dict]:
        plants = self._repo.search_by_name(user_id, query)[:top_k]
        return [{"id": p.id, "name": p.name, "species": p.species,
                 "status": p.status} for p in plants]

    def increment_harvest(self, user_id: str, plant_id: str) -> None:
        plant = self.get(user_id, plant_id)
        stats = dict(plant.stats)
        stats["harvested_count"] = stats.get("harvested_count", 0) + 1
        plant.stats = stats
        plant.last_activity_at = datetime.utcnow()
        plant.updated_at = datetime.utcnow()
        self._repo.update(plant)

    def increment_rot(self, user_id: str, plant_id: str) -> None:
        plant = self.get(user_id, plant_id)
        stats = dict(plant.stats)
        stats["rot_count"] = stats.get("rot_count", 0) + 1
        plant.stats = stats
        plant.updated_at = datetime.utcnow()
        self._repo.update(plant)

    def mark_dormant(self, user_id: str, plant_id: str) -> None:
        plant = self.get(user_id, plant_id)
        plant.status = "dormant"
        plant.updated_at = datetime.utcnow()
        self._repo.update(plant)
```

- [ ] **Step 2: Write bud_service.py**

```python
# backend/app/services/bud_service.py
from datetime import datetime, date
from python_ulid import ULID
from sqlalchemy.orm import Session

from app.db.models.bud import Bud, BudHistory
from app.repositories.bud_repo import BudRepo
from app.services.exceptions import DomainError

VALID_TRANSITIONS = {
    "seed":      {"bud", "wilting", "rot"},
    "bud":       {"flower", "wilting", "rot"},
    "flower":    {"fruit", "wilting", "rot"},
    "fruit":     {"harvested", "wilting", "rot"},
    "wilting":   {"bud", "flower", "rot"},
    "harvested": set(),
    "rot":       set(),
}

ACTIVE_STATUSES = {"seed", "bud", "flower", "fruit", "wilting"}


class BudService:
    def __init__(self, db: Session):
        self.db = db
        self._repo = BudRepo(db)

    def create(self, user_id: str, plant_id: str, title: str,
               bud_type: str = "concern", detail: str = "",
               deadline: date | None = None,
               initial_status: str = "seed") -> Bud:
        bud = Bud(
            id=str(ULID()),
            user_id=user_id,
            plant_id=plant_id,
            title=title,
            type=bud_type,
            detail=detail or "",
            deadline=deadline,
            status=initial_status,
            last_progress_at=datetime.utcnow(),
        )
        bud = self._repo.create(bud)
        self._record_history(bud.id, "none", initial_status, "user:created")
        return bud

    def get(self, user_id: str, bud_id: str) -> Bud:
        bud = self._repo.get(bud_id)
        if not bud or bud.user_id != user_id:
            raise DomainError("not_found", "봉우리를 찾을 수 없습니다.")
        return bud

    def list(self, user_id: str, filters: dict) -> list[Bud]:
        return self._repo.list_by_user(
            user_id,
            plant_id=filters.get("plant_id"),
            statuses=filters.get("statuses"),
            bud_type=filters.get("type"),
            wilting_only=filters.get("wilting_only", False),
        )

    def update_status(self, user_id: str, bud_id: str,
                      to_status: str, reason: str = "") -> Bud:
        bud = self.get(user_id, bud_id)
        allowed = VALID_TRANSITIONS.get(bud.status, set())
        if to_status not in allowed:
            raise DomainError(
                "invalid_transition",
                f"{bud.status} → {to_status} 전이는 허용되지 않습니다."
            )
        from_status = bud.status
        bud.status = to_status
        bud.updated_at = datetime.utcnow()
        bud = self._repo.update(bud)
        self._record_history(bud.id, from_status, to_status,
                             reason or f"user:{to_status}")
        return bud

    def update_progress(self, user_id: str, bud_id: str,
                        progress: int, auto_transition: bool = True,
                        note: str = "") -> Bud:
        bud = self.get(user_id, bud_id)
        bud.progress = max(0, min(100, progress))
        bud.last_progress_at = datetime.utcnow()
        bud.updated_at = datetime.utcnow()
        if auto_transition and bud.status in ACTIVE_STATUSES:
            if progress >= 90 and bud.status in ("bud", "flower"):
                self._try_transition(bud, "fruit", "auto:progress_90")
            elif progress >= 50 and bud.status == "bud":
                self._try_transition(bud, "flower", "auto:progress_50")
        return self._repo.update(bud)

    def set_deadline(self, user_id: str, bud_id: str,
                     deadline: date) -> Bud:
        bud = self.get(user_id, bud_id)
        bud.deadline = deadline
        bud.updated_at = datetime.utcnow()
        return self._repo.update(bud)

    def abandon(self, user_id: str, bud_id: str,
                reason: str = "") -> Bud:
        bud = self.get(user_id, bud_id)
        from_status = bud.status
        bud.status = "rot"
        bud.updated_at = datetime.utcnow()
        bud = self._repo.update(bud)
        self._record_history(bud.id, from_status, "rot",
                             reason or "user:abandon")
        return bud

    def harvest(self, user_id: str, bud_id: str, note: str = "") -> Bud:
        bud = self.get(user_id, bud_id)
        if bud.status == "harvested":
            return bud
        from_status = bud.status
        bud.status = "harvested"
        bud.progress = 100
        bud.updated_at = datetime.utcnow()
        bud = self._repo.update(bud)
        self._record_history(bud.id, from_status, "harvested",
                             note or "user:harvest")
        return bud

    def mark_wilting(self, user_id: str, bud_id: str) -> Bud:
        bud = self.get(user_id, bud_id)
        if bud.status not in ACTIVE_STATUSES - {"wilting"}:
            return bud
        from_status = bud.status
        bud.status = "wilting"
        bud.updated_at = datetime.utcnow()
        bud = self._repo.update(bud)
        self._record_history(bud.id, from_status, "wilting",
                             "auto:wilting_threshold")
        return bud

    def purge_disappeared(self, user_id: str, older_than_days: int) -> int:
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=older_than_days)
        buds = self._repo.list_by_user(user_id)
        count = 0
        for bud in buds:
            if bud.status == "rot" and bud.updated_at < cutoff:
                bud.disappeared_at = datetime.utcnow()
                self._repo.update(bud)
                count += 1
        return count

    def _try_transition(self, bud: Bud, to_status: str, reason: str) -> None:
        allowed = VALID_TRANSITIONS.get(bud.status, set())
        if to_status in allowed:
            from_status = bud.status
            bud.status = to_status
            self._record_history(bud.id, from_status, to_status, reason)

    def _record_history(self, bud_id: str, from_status: str,
                        to_status: str, reason: str) -> None:
        h = BudHistory(
            id=str(ULID()),
            bud_id=bud_id,
            from_status=from_status,
            to_status=to_status,
            reason=reason,
        )
        self._repo.add_history(h)
```

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" add backend/app/services/plant_service.py backend/app/services/bud_service.py
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" commit -m "feat(services): add PlantService and BudService"
```

---

## Task 5: Services — GardenStateService, ConversationService, NotificationService, TransitionService

**Files:**
- Create: `backend/app/services/garden_state_service.py`
- Create: `backend/app/services/conversation_service.py`
- Create: `backend/app/services/notification_service.py`
- Create: `backend/app/services/transition_service.py`

- [ ] **Step 1: Write garden_state_service.py**

```python
# backend/app/services/garden_state_service.py
from datetime import datetime, date
from sqlalchemy.orm import Session

from app.repositories.garden_state_repo import GardenStateRepo
from app.repositories.bud_repo import BudRepo
from app.repositories.plant_repo import PlantRepo
from app.services.exceptions import DomainError


class GardenStateService:
    def __init__(self, db: Session):
        self.db = db
        self._gs_repo = GardenStateRepo(db)
        self._bud_repo = BudRepo(db)
        self._plant_repo = PlantRepo(db)

    def refresh_summary(self, user_id: str) -> dict:
        buds = self._bud_repo.list_by_user(user_id)
        plants = self._plant_repo.list_by_user(user_id, include_archived=False)
        now = datetime.utcnow()

        summary = {
            "active_concerns": sum(
                1 for b in buds
                if b.type == "concern" and b.status not in ("harvested", "rot")
            ),
            "active_schedules": sum(
                1 for b in buds
                if b.type == "schedule" and b.status not in ("harvested", "rot")
            ),
            "harvested_this_month": sum(
                1 for b in buds
                if b.status == "harvested"
                and b.updated_at.year == now.year
                and b.updated_at.month == now.month
            ),
            "wilting_count": sum(1 for b in buds if b.status == "wilting"),
            "rot_count": sum(1 for b in buds if b.status == "rot"),
            "total_plants": len([p for p in plants if p.status == "active"]),
        }

        gs = self._gs_repo.get_by_user(user_id)
        if gs:
            gs.summary_cache = summary
            gs.updated_at = datetime.utcnow()
            self._gs_repo.update(gs)
        return summary

    def get_summary(self, user_id: str) -> dict:
        gs = self._gs_repo.get_by_user(user_id)
        if gs:
            return gs.summary_cache
        return self.refresh_summary(user_id)

    def compute_stats(self, user_id: str, scope: str = "global",
                      plant_id: str | None = None,
                      period: str = "this_month") -> dict:
        buds = self._bud_repo.list_by_user(user_id, plant_id=plant_id)
        now = datetime.utcnow()

        def in_period(b):
            if period == "this_month":
                return b.created_at.year == now.year and b.created_at.month == now.month
            if period == "this_year":
                return b.created_at.year == now.year
            return True

        filtered = [b for b in buds if in_period(b)]
        return {
            "total": len(filtered),
            "harvested": sum(1 for b in filtered if b.status == "harvested"),
            "abandoned": sum(1 for b in filtered if b.status == "rot"),
            "active": sum(1 for b in filtered if b.status not in ("harvested", "rot")),
            "wilting": sum(1 for b in filtered if b.status == "wilting"),
            "concerns": sum(1 for b in filtered if b.type == "concern"),
            "schedules": sum(1 for b in filtered if b.type == "schedule"),
            "avg_progress": (
                sum(b.progress for b in filtered) // len(filtered)
                if filtered else 0
            ),
            "period": period,
            "scope": scope,
        }

    def build_briefing(self, user_id: str, as_of: date | None = None) -> str:
        summary = self.get_summary(user_id)
        buds = self._bud_repo.list_by_user(user_id)
        wilting = [b for b in buds if b.status == "wilting"]
        near_deadline = []
        if as_of is None:
            as_of = datetime.utcnow().date()
        from datetime import timedelta
        for b in buds:
            if b.deadline and b.status not in ("harvested", "rot"):
                days = (b.deadline - as_of).days
                if 0 <= days <= 3:
                    near_deadline.append((b, days))

        lines = [
            f"오늘의 정원 브리핑 ({as_of})",
            f"활성 고민: {summary.get('active_concerns', 0)}개, "
            f"일정: {summary.get('active_schedules', 0)}개",
        ]
        if wilting:
            lines.append(f"시들고 있는 봉우리 {len(wilting)}개가 관심이 필요합니다.")
        if near_deadline:
            for b, days in near_deadline:
                lines.append(f"'{b.title}' 마감 {days}일 남았습니다.")
        if summary.get("harvested_this_month", 0) > 0:
            lines.append(f"이번 달 {summary['harvested_this_month']}개를 수확했습니다!")
        return "\n".join(lines)

    def mark_opened(self, user_id: str) -> None:
        gs = self._gs_repo.get_by_user(user_id)
        if gs:
            gs.last_opened_at = datetime.utcnow()
            self._gs_repo.update(gs)
```

- [ ] **Step 2: Write conversation_service.py**

```python
# backend/app/services/conversation_service.py
from datetime import datetime
from python_ulid import ULID
from sqlalchemy.orm import Session

from app.db.models.conversation import ConversationMessage
from app.repositories.conversation_repo import ConversationRepo


class ConversationService:
    def __init__(self, db: Session):
        self.db = db
        self._repo = ConversationRepo(db)

    def append(self, user_id: str, scope: str, scope_id: str | None,
               role: str, text: str,
               skill_call: dict | None = None) -> ConversationMessage:
        conv = self._repo.get_or_create(user_id, scope, scope_id)
        msg = ConversationMessage(
            id=str(ULID()),
            conversation_id=conv.id,
            role=role,
            text=text,
            skill_call=skill_call,
            at=datetime.utcnow(),
        )
        return self._repo.add_message(msg)

    def get_history(self, user_id: str, scope: str,
                    scope_id: str | None, limit: int = 20) -> list[ConversationMessage]:
        conv = self._repo.get_or_create(user_id, scope, scope_id)
        msgs = self._repo.get_messages(conv.id, limit=limit)
        return list(reversed(msgs))

    def search(self, user_id: str, query: str,
               scope: str = "global", scope_id: str | None = None,
               limit: int = 10) -> list[ConversationMessage]:
        return self._repo.search_messages(user_id, query, limit=limit)

    def list_conversations(self, user_id: str):
        return self._repo.list_by_user(user_id)
```

- [ ] **Step 3: Write notification_service.py**

```python
# backend/app/services/notification_service.py
from datetime import datetime
from python_ulid import ULID
from sqlalchemy.orm import Session

from app.db.models.notification import Notification
from app.repositories.notification_repo import NotificationRepo
from app.services.exceptions import DomainError


class NotificationService:
    def __init__(self, db: Session):
        self.db = db
        self._repo = NotificationRepo(db)

    def push(self, user_id: str, kind: str, payload: dict) -> Notification:
        n = Notification(
            id=str(ULID()),
            user_id=user_id,
            kind=kind,
            payload=payload,
        )
        return self._repo.create(n)

    def list_unread(self, user_id: str) -> list[Notification]:
        return self._repo.list_unread(user_id)

    def ack(self, user_id: str, notification_id: str) -> Notification:
        n = self._repo.get(notification_id)
        if not n or n.user_id != user_id:
            raise DomainError("not_found", "알림을 찾을 수 없습니다.")
        n.acked_at = datetime.utcnow()
        return self._repo.update(n)
```

- [ ] **Step 4: Write transition_service.py**

```python
# backend/app/services/transition_service.py
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.repositories.bud_repo import BudRepo
from app.repositories.plant_repo import PlantRepo
from app.repositories.user_repo import UserRepo
from app.repositories.notification_repo import NotificationRepo
from app.db.models.bud import BudHistory
from app.db.models.notification import Notification
from python_ulid import ULID


class TransitionService:
    def __init__(self, db: Session):
        self.db = db
        self._bud_repo = BudRepo(db)
        self._plant_repo = PlantRepo(db)
        self._user_repo = UserRepo(db)
        self._notif_repo = NotificationRepo(db)

    def scan_all(self, db: Session | None = None) -> None:
        """Scan all users. db param ignored — use self.db."""
        users = self.db.query(self._user_repo.db.get_bind()
                              .execute("SELECT id FROM users").fetchall()
                              if False else [])
        # Use ORM instead
        from app.db.models.user import User
        for user in self.db.query(User).all():
            try:
                self.scan_user(user.id)
            except Exception:
                pass

    def scan_user(self, user_id: str) -> None:
        self.check_wilting(user_id)
        self.check_rot_disappear(user_id)
        self.check_deadlines(user_id)
        self._update_plant_dormancy(user_id)

    def check_wilting(self, user_id: str) -> None:
        from app.db.models.user import User
        user = self.db.get(User, user_id)
        if not user:
            return
        rules = user.garden_rules or {}
        wilting_days = rules.get("wilting_days", 7)
        auto_transition = rules.get("auto_transition", True)
        if not auto_transition:
            return

        cutoff = datetime.utcnow() - timedelta(days=wilting_days)
        active_statuses = {"seed", "bud", "flower", "fruit"}
        buds = self._bud_repo.list_by_user(user_id)
        for bud in buds:
            if bud.status not in active_statuses:
                continue
            last = bud.last_progress_at or bud.created_at
            if last < cutoff:
                from_status = bud.status
                bud.status = "wilting"
                bud.updated_at = datetime.utcnow()
                self._bud_repo.update(bud)
                h = BudHistory(
                    id=str(ULID()),
                    bud_id=bud.id,
                    from_status=from_status,
                    to_status="wilting",
                    reason="auto:wilting_threshold",
                )
                self._bud_repo.add_history(h)
                n = Notification(
                    id=str(ULID()),
                    user_id=user_id,
                    kind="wilting",
                    payload={"bud_id": bud.id, "title": bud.title},
                )
                self._notif_repo.create(n)

    def check_rot_disappear(self, user_id: str) -> None:
        from app.db.models.user import User
        user = self.db.get(User, user_id)
        if not user:
            return
        rules = user.garden_rules or {}
        rot_days = rules.get("rot_disappear_days", 14)
        cutoff = datetime.utcnow() - timedelta(days=rot_days)
        buds = self._bud_repo.list_by_user(user_id)
        for bud in buds:
            if bud.status == "rot" and bud.disappeared_at is None:
                if bud.updated_at < cutoff:
                    bud.disappeared_at = datetime.utcnow()
                    self._bud_repo.update(bud)

    def check_deadlines(self, user_id: str) -> None:
        from app.db.models.user import User
        user = self.db.get(User, user_id)
        if not user:
            return
        rules = user.garden_rules or {}
        warn_days = rules.get("deadline_warn_days", 3)
        today = datetime.utcnow().date()
        buds = self._bud_repo.list_by_user(user_id)
        for bud in buds:
            if not bud.deadline:
                continue
            if bud.status in ("harvested", "rot"):
                continue
            days_left = (bud.deadline - today).days
            if 0 <= days_left <= warn_days:
                n = Notification(
                    id=str(ULID()),
                    user_id=user_id,
                    kind="deadline_warning",
                    payload={
                        "bud_id": bud.id,
                        "title": bud.title,
                        "days_left": days_left,
                    },
                )
                self._notif_repo.create(n)

    def _update_plant_dormancy(self, user_id: str) -> None:
        plants = self._plant_repo.list_by_user(user_id)
        for plant in plants:
            if plant.status != "active":
                continue
            buds = self._bud_repo.list_by_user(user_id, plant_id=plant.id)
            active = [b for b in buds
                      if b.status not in ("harvested", "rot")
                      and b.disappeared_at is None]
            if not active:
                plant.status = "dormant"
                plant.updated_at = datetime.utcnow()
                self._plant_repo.update(plant)
```

- [ ] **Step 5: Verify imports**

```bash
cd C:/Users/jaemi/Documents/Project/plant-counselor/backend
python -c "
from app.services.garden_state_service import GardenStateService
from app.services.conversation_service import ConversationService
from app.services.notification_service import NotificationService
from app.services.transition_service import TransitionService
print('services OK')
"
```
Expected: `services OK`

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" add backend/app/services/
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" commit -m "feat(services): add GardenStateService, ConversationService, NotificationService, TransitionService"
```

---

## Task 6: deps.py + auth/jwt.py

**Files:**
- Create: `backend/app/deps.py`
- Create: `backend/app/auth/__init__.py`
- Create: `backend/app/auth/jwt.py`

- [ ] **Step 1: Write auth/jwt.py**

```python
# backend/app/auth/jwt.py
from datetime import datetime, timedelta
from jose import jwt, JWTError
from app.config import settings


def create_access_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "access",
        "exp": datetime.utcnow() + timedelta(minutes=settings.jwt_access_ttl),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": datetime.utcnow() + timedelta(days=settings.jwt_refresh_ttl),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except JWTError:
        return None
```

- [ ] **Step 2: Write deps.py**

```python
# backend/app/deps.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.db.models.user import User
from app.auth.jwt import decode_token

_bearer = HTTPBearer(auto_error=False)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User | None:
    if credentials is None:
        return None
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        return None
    user = db.get(User, payload["sub"])
    return user


def require_user(user: User | None = Depends(get_current_user)) -> User:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증이 필요합니다.",
        )
    return user
```

- [ ] **Step 3: Verify**

```bash
cd C:/Users/jaemi/Documents/Project/plant-counselor/backend
python -c "
from app.auth.jwt import create_access_token, decode_token
tok = create_access_token('test-user')
payload = decode_token(tok)
assert payload['sub'] == 'test-user'
assert payload['type'] == 'access'
print('jwt OK')
from app.deps import get_db, require_user
print('deps OK')
"
```
Expected: `jwt OK` then `deps OK`

- [ ] **Step 4: Commit**

```bash
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" add backend/app/auth/ backend/app/deps.py
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" commit -m "feat(auth): add JWT helpers and FastAPI deps"
```

---

## Task 7: AI Layer — skill_base, skill_registry, prompt_builder

**Files:**
- Create: `backend/app/ai/__init__.py`
- Create: `backend/app/ai/skill_base.py`
- Create: `backend/app/ai/skill_registry.py`
- Create: `backend/app/ai/prompt_builder.py`

- [ ] **Step 1: Write ai/__init__.py** (empty)

- [ ] **Step 2: Write skill_base.py**

```python
# backend/app/ai/skill_base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class SkillResult:
    ok: bool
    message: str
    data: dict = field(default_factory=dict)
    error_code: str = ""


@dataclass
class SkillContext:
    user_id: str
    db: Any  # SQLAlchemy Session
    plant_service: Any = None
    bud_service: Any = None
    garden_state_service: Any = None
    conversation_service: Any = None


class SkillBase(ABC):
    name: str = ""
    description: str = ""
    parameters: dict = {}
    requires_confirmation: bool = False

    @abstractmethod
    def run(self, args: dict, ctx: SkillContext) -> SkillResult: ...

    def to_tool_spec(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.parameters,
        }
```

- [ ] **Step 3: Write skill_registry.py**

```python
# backend/app/ai/skill_registry.py
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class SkillRegistry:
    def __init__(self):
        self._skills: dict[str, SkillBase] = {}

    def register(self, skill: SkillBase) -> None:
        self._skills[skill.name] = skill

    def get(self, name: str) -> SkillBase | None:
        return self._skills.get(name)

    def list(self) -> list[SkillBase]:
        return list(self._skills.values())

    def build_catalog(self) -> list[dict]:
        return [s.to_tool_spec() for s in self._skills.values()]

    def dispatch(self, name: str, args: dict,
                 ctx: SkillContext) -> SkillResult:
        skill = self.get(name)
        if not skill:
            return SkillResult(ok=False, message=f"Unknown skill: {name}",
                               error_code="not_found")

        # Ownership guard
        if "plant_id" in args and ctx.plant_service:
            try:
                ctx.plant_service.get(ctx.user_id, args["plant_id"])
            except Exception:
                return SkillResult(ok=False,
                                   message="접근 권한이 없습니다.",
                                   error_code="forbidden")

        if "bud_id" in args and ctx.bud_service:
            try:
                ctx.bud_service.get(ctx.user_id, args["bud_id"])
            except Exception:
                return SkillResult(ok=False,
                                   message="접근 권한이 없습니다.",
                                   error_code="forbidden")

        try:
            return skill.run(args, ctx)
        except Exception as e:
            return SkillResult(ok=False, message=str(e),
                               error_code="skill_error")
```

- [ ] **Step 4: Write prompt_builder.py**

```python
# backend/app/ai/prompt_builder.py
from app.ai.skill_base import SkillContext


class PromptBuilder:
    def build_system(self, ctx: SkillContext,
                     current_screen: str = "홈",
                     stats: dict | None = None,
                     plants: list | None = None) -> str:
        stats = stats or {}
        plant_list = ""
        if plants:
            plant_list = ", ".join(
                f"{p.get('name', '?')}({p.get('status', '?')})"
                for p in plants
            )
        else:
            plant_list = "없음"

        return f"""당신은 "Plant Counselor"의 AI 정원사입니다.
사용자의 발화를 듣고 적절한 Skill을 호출해 식물과 봉우리를 관리합니다.

현재 화면: {current_screen}

정원 상태:
- 활성 고민: {stats.get('active_concerns', 0)}개 / 활성 일정: {stats.get('active_schedules', 0)}개
- 시들고 있는 봉우리: {stats.get('wilting_count', 0)}개 / 이번 달 수확: {stats.get('harvested_this_month', 0)}개

식물 목록: {plant_list}

응답 규칙:
- 짧고 부드럽게 답변
- 새 고민/일정 언급 시 먼저 match_plant 호출
- 매칭 식물이 있으면 새 식물 만들지 말고 기존에 봉우리 추가
- 데이터 변경 Skill 호출 전 사용자 동의 필요 (create_plant, delete_plant, abandon_bud, set_deadline)
- 정보 부족 시 한 번에 한 가지만 질문"""
```

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" add backend/app/ai/
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" commit -m "feat(ai): add skill_base, skill_registry, prompt_builder"
```

---

## Task 8: All 14 Skills

**Files:** `backend/app/ai/skills/__init__.py` + 14 skill files

- [ ] **Step 1: Write skills/__init__.py** (empty)

- [ ] **Step 2: Write match_plant.py**

```python
# backend/app/ai/skills/match_plant.py
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class MatchPlantSkill(SkillBase):
    name = "match_plant"
    description = "사용자의 발화에서 기존 식물(분야)을 찾습니다."
    parameters = {
        "type": "object",
        "properties": {"query": {"type": "string", "description": "검색할 키워드"}},
        "required": ["query"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        matches = ctx.plant_service.find_matches(ctx.user_id, args["query"])
        return SkillResult(
            ok=True,
            message=f"{len(matches)}개 식물 매칭",
            data={"matches": matches},
        )
```

- [ ] **Step 3: Write create_plant.py**

```python
# backend/app/ai/skills/create_plant.py
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class CreatePlantSkill(SkillBase):
    name = "create_plant"
    description = "새 식물(분야)을 생성합니다."
    requires_confirmation = True
    parameters = {
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": "식물 이름"},
            "description": {"type": "string", "description": "설명"},
            "species": {"type": "string", "description": "종류"},
            "color": {"type": "string", "description": "색상 토큰"},
        },
        "required": ["name"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        plant = ctx.plant_service.create(
            user_id=ctx.user_id,
            name=args["name"],
            description=args.get("description", ""),
            species=args.get("species", "tree_oak"),
            color=args.get("color", "brand.primary_leaf"),
        )
        data = {col: getattr(plant, col)
                for col in plant.__table__.columns.keys()}
        return SkillResult(ok=True, message=f"식물 '{plant.name}' 생성됨",
                           data={"plant": data})
```

- [ ] **Step 4: Write delete_plant.py**

```python
# backend/app/ai/skills/delete_plant.py
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class DeletePlantSkill(SkillBase):
    name = "delete_plant"
    description = "식물을 삭제(아카이브)합니다."
    requires_confirmation = True
    parameters = {
        "type": "object",
        "properties": {
            "plant_id": {"type": "string", "description": "식물 ID"},
        },
        "required": ["plant_id"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        ctx.plant_service.delete(ctx.user_id, args["plant_id"])
        return SkillResult(ok=True, message="식물이 삭제되었습니다.",
                           data={"plant_id": args["plant_id"]})
```

- [ ] **Step 5: Write create_bud.py**

```python
# backend/app/ai/skills/create_bud.py
from datetime import date
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class CreateBudSkill(SkillBase):
    name = "create_bud"
    description = "식물에 새 봉우리(고민/일정)를 추가합니다."
    parameters = {
        "type": "object",
        "properties": {
            "plant_id": {"type": "string"},
            "title": {"type": "string"},
            "type": {"type": "string", "enum": ["concern", "schedule"]},
            "detail": {"type": "string"},
            "deadline": {"type": "string", "description": "YYYY-MM-DD"},
        },
        "required": ["plant_id", "title", "type"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        deadline = None
        if args.get("deadline"):
            deadline = date.fromisoformat(args["deadline"])
        bud = ctx.bud_service.create(
            user_id=ctx.user_id,
            plant_id=args["plant_id"],
            title=args["title"],
            bud_type=args["type"],
            detail=args.get("detail", ""),
            deadline=deadline,
        )
        data = {col: str(getattr(bud, col))
                for col in bud.__table__.columns.keys()}
        return SkillResult(ok=True, message=f"봉우리 '{bud.title}' 생성됨",
                           data={"bud": data})
```

- [ ] **Step 6: Write update_bud_status.py**

```python
# backend/app/ai/skills/update_bud_status.py
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class UpdateBudStatusSkill(SkillBase):
    name = "update_bud_status"
    description = "봉우리의 상태를 변경합니다."
    parameters = {
        "type": "object",
        "properties": {
            "bud_id": {"type": "string"},
            "to_status": {
                "type": "string",
                "enum": ["seed", "bud", "flower", "fruit", "harvested", "wilting", "rot"],
            },
            "reason": {"type": "string"},
        },
        "required": ["bud_id", "to_status"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        bud = ctx.bud_service.update_status(
            ctx.user_id, args["bud_id"],
            args["to_status"], args.get("reason", "")
        )
        return SkillResult(ok=True,
                           message=f"상태 변경: {bud.status}",
                           data={"bud_id": bud.id, "status": bud.status})
```

- [ ] **Step 7: Write update_bud_progress.py**

```python
# backend/app/ai/skills/update_bud_progress.py
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class UpdateBudProgressSkill(SkillBase):
    name = "update_bud_progress"
    description = "봉우리의 진행률(0-100)을 업데이트합니다."
    parameters = {
        "type": "object",
        "properties": {
            "bud_id": {"type": "string"},
            "progress": {"type": "integer", "minimum": 0, "maximum": 100},
        },
        "required": ["bud_id", "progress"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        bud = ctx.bud_service.update_progress(
            ctx.user_id, args["bud_id"], args["progress"]
        )
        return SkillResult(ok=True,
                           message=f"진행률 {bud.progress}%",
                           data={"bud_id": bud.id, "progress": bud.progress})
```

- [ ] **Step 8: Write set_deadline.py**

```python
# backend/app/ai/skills/set_deadline.py
from datetime import date
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class SetDeadlineSkill(SkillBase):
    name = "set_deadline"
    description = "봉우리에 마감일을 설정합니다."
    requires_confirmation = True
    parameters = {
        "type": "object",
        "properties": {
            "bud_id": {"type": "string"},
            "deadline": {"type": "string", "description": "YYYY-MM-DD"},
        },
        "required": ["bud_id", "deadline"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        d = date.fromisoformat(args["deadline"])
        bud = ctx.bud_service.set_deadline(ctx.user_id, args["bud_id"], d)
        return SkillResult(ok=True,
                           message=f"마감일 설정: {bud.deadline}",
                           data={"bud_id": bud.id,
                                 "deadline": str(bud.deadline)})
```

- [ ] **Step 9: Write abandon_bud.py**

```python
# backend/app/ai/skills/abandon_bud.py
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class AbandonBudSkill(SkillBase):
    name = "abandon_bud"
    description = "봉우리를 포기합니다(rot 전이)."
    requires_confirmation = True
    parameters = {
        "type": "object",
        "properties": {
            "bud_id": {"type": "string"},
            "reason": {"type": "string"},
        },
        "required": ["bud_id"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        bud = ctx.bud_service.abandon(
            ctx.user_id, args["bud_id"], args.get("reason", "")
        )
        return SkillResult(ok=True, message="봉우리가 포기되었습니다.",
                           data={"bud_id": bud.id, "status": bud.status})
```

- [ ] **Step 10: Write harvest_bud.py**

```python
# backend/app/ai/skills/harvest_bud.py
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class HarvestBudSkill(SkillBase):
    name = "harvest_bud"
    description = "봉우리를 수확(완료)합니다."
    parameters = {
        "type": "object",
        "properties": {
            "bud_id": {"type": "string"},
            "note": {"type": "string"},
        },
        "required": ["bud_id"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        bud = ctx.bud_service.harvest(
            ctx.user_id, args["bud_id"], args.get("note", "")
        )
        return SkillResult(ok=True, message="수확 완료!",
                           data={"bud_id": bud.id, "status": bud.status})
```

- [ ] **Step 11: Write list_plants.py**

```python
# backend/app/ai/skills/list_plants.py
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class ListPlantsSkill(SkillBase):
    name = "list_plants"
    description = "사용자의 식물 목록을 조회합니다."
    parameters = {
        "type": "object",
        "properties": {
            "include_dormant": {"type": "boolean"},
            "sort": {"type": "string", "enum": ["activity", "name", "created"]},
        },
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        plants = ctx.plant_service.list(
            ctx.user_id,
            include_dormant=args.get("include_dormant", True),
            sort=args.get("sort", "activity"),
        )
        data = [
            {col: str(getattr(p, col)) for col in p.__table__.columns.keys()}
            for p in plants
        ]
        return SkillResult(ok=True, message=f"{len(data)}개 식물",
                           data={"plants": data})
```

- [ ] **Step 12: Write list_buds.py**

```python
# backend/app/ai/skills/list_buds.py
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class ListBudsSkill(SkillBase):
    name = "list_buds"
    description = "봉우리 목록을 조회합니다."
    parameters = {
        "type": "object",
        "properties": {
            "plant_id": {"type": "string"},
            "status": {"type": "string"},
            "type": {"type": "string", "enum": ["concern", "schedule"]},
        },
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        filters = {
            "plant_id": args.get("plant_id"),
            "statuses": [args["status"]] if args.get("status") else None,
            "type": args.get("type"),
        }
        buds = ctx.bud_service.list(ctx.user_id, filters)
        data = [
            {col: str(getattr(b, col)) for col in b.__table__.columns.keys()}
            for b in buds
        ]
        return SkillResult(ok=True, message=f"{len(data)}개 봉우리",
                           data={"buds": data})
```

- [ ] **Step 13: Write get_statistics.py**

```python
# backend/app/ai/skills/get_statistics.py
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class GetStatisticsSkill(SkillBase):
    name = "get_statistics"
    description = "정원 통계를 조회합니다."
    parameters = {
        "type": "object",
        "properties": {
            "period": {
                "type": "string",
                "enum": ["this_month", "this_year", "all"],
            },
            "plant_id": {"type": "string"},
        },
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        stats = ctx.garden_state_service.compute_stats(
            ctx.user_id,
            scope="global",
            plant_id=args.get("plant_id"),
            period=args.get("period", "this_month"),
        )
        return SkillResult(ok=True, message="통계 조회 완료",
                           data={"stats": stats})
```

- [ ] **Step 14: Write get_garden_briefing.py**

```python
# backend/app/ai/skills/get_garden_briefing.py
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class GetGardenBriefingSkill(SkillBase):
    name = "get_garden_briefing"
    description = "오늘의 정원 브리핑을 생성합니다."
    parameters = {"type": "object", "properties": {}}

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        briefing = ctx.garden_state_service.build_briefing(ctx.user_id)
        return SkillResult(ok=True, message="브리핑 생성 완료",
                           data={"briefing": briefing})
```

- [ ] **Step 15: Write search_conversation.py**

```python
# backend/app/ai/skills/search_conversation.py
from app.ai.skill_base import SkillBase, SkillResult, SkillContext


class SearchConversationSkill(SkillBase):
    name = "search_conversation"
    description = "과거 대화를 검색합니다."
    parameters = {
        "type": "object",
        "properties": {
            "query": {"type": "string"},
            "limit": {"type": "integer"},
        },
        "required": ["query"],
    }

    def run(self, args: dict, ctx: SkillContext) -> SkillResult:
        msgs = ctx.conversation_service.search(
            ctx.user_id,
            args["query"],
            limit=args.get("limit", 10),
        )
        data = [{"id": m.id, "role": m.role, "text": m.text,
                 "at": str(m.at)} for m in msgs]
        return SkillResult(ok=True, message=f"{len(data)}개 결과",
                           data={"messages": data})
```

- [ ] **Step 16: Verify skill imports**

```bash
cd C:/Users/jaemi/Documents/Project/plant-counselor/backend
python -c "
from app.ai.skills.match_plant import MatchPlantSkill
from app.ai.skills.create_plant import CreatePlantSkill
from app.ai.skills.delete_plant import DeletePlantSkill
from app.ai.skills.create_bud import CreateBudSkill
from app.ai.skills.update_bud_status import UpdateBudStatusSkill
from app.ai.skills.update_bud_progress import UpdateBudProgressSkill
from app.ai.skills.set_deadline import SetDeadlineSkill
from app.ai.skills.abandon_bud import AbandonBudSkill
from app.ai.skills.harvest_bud import HarvestBudSkill
from app.ai.skills.list_plants import ListPlantsSkill
from app.ai.skills.list_buds import ListBudsSkill
from app.ai.skills.get_statistics import GetStatisticsSkill
from app.ai.skills.get_garden_briefing import GetGardenBriefingSkill
from app.ai.skills.search_conversation import SearchConversationSkill
print('all 14 skills OK')
"
```
Expected: `all 14 skills OK`

- [ ] **Step 17: Commit**

```bash
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" add backend/app/ai/skills/
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" commit -m "feat(ai/skills): add all 14 skill implementations"
```

---

## Task 9: LLMClient + ChatOrchestrator

**Files:**
- Create: `backend/app/ai/llm_client.py`
- Create: `backend/app/ai/chat_orchestrator.py`

- [ ] **Step 1: Write llm_client.py**

```python
# backend/app/ai/llm_client.py
import anthropic


class LLMClient:
    MODEL = "claude-opus-4-7"

    def __init__(self, api_key: str):
        self._key = api_key

    async def chat_stream(self, messages: list[dict],
                          tools: list[dict], system: str):
        """Async generator yielding raw Anthropic stream events."""
        if not self._key:
            yield {"type": "content_block_delta",
                   "delta": {"type": "text_delta", "text": "API 키가 없습니다."}}
            return

        async with anthropic.AsyncAnthropic(api_key=self._key).messages.stream(
            model=self.MODEL,
            max_tokens=1024,
            system=system,
            messages=messages,
            tools=tools or [],
        ) as stream:
            async for event in stream:
                yield event

    def chat(self, messages: list[dict],
             tools: list[dict], system: str) -> dict:
        """Synchronous call — returns {text, tool_use}."""
        if not self._key:
            return {"text": "API 키가 설정되지 않았습니다.", "tool_use": None}

        client = anthropic.Anthropic(api_key=self._key)
        resp = client.messages.create(
            model=self.MODEL,
            max_tokens=1024,
            system=system,
            messages=messages,
            tools=tools or [],
        )
        text = ""
        tool_use = None
        for block in resp.content:
            if block.type == "text":
                text += block.text
            elif block.type == "tool_use":
                tool_use = {"name": block.name, "input": block.input,
                            "id": block.id}
        return {"text": text, "tool_use": tool_use}
```

- [ ] **Step 2: Write chat_orchestrator.py**

```python
# backend/app/ai/chat_orchestrator.py
import json
from app.ai.skill_registry import SkillRegistry
from app.ai.llm_client import LLMClient
from app.ai.prompt_builder import PromptBuilder
from app.ai.skill_base import SkillContext


def _build_registry() -> SkillRegistry:
    from app.ai.skills.match_plant import MatchPlantSkill
    from app.ai.skills.create_plant import CreatePlantSkill
    from app.ai.skills.delete_plant import DeletePlantSkill
    from app.ai.skills.create_bud import CreateBudSkill
    from app.ai.skills.update_bud_status import UpdateBudStatusSkill
    from app.ai.skills.update_bud_progress import UpdateBudProgressSkill
    from app.ai.skills.set_deadline import SetDeadlineSkill
    from app.ai.skills.abandon_bud import AbandonBudSkill
    from app.ai.skills.harvest_bud import HarvestBudSkill
    from app.ai.skills.list_plants import ListPlantsSkill
    from app.ai.skills.list_buds import ListBudsSkill
    from app.ai.skills.get_statistics import GetStatisticsSkill
    from app.ai.skills.get_garden_briefing import GetGardenBriefingSkill
    from app.ai.skills.search_conversation import SearchConversationSkill

    reg = SkillRegistry()
    for cls in [
        MatchPlantSkill, CreatePlantSkill, DeletePlantSkill,
        CreateBudSkill, UpdateBudStatusSkill, UpdateBudProgressSkill,
        SetDeadlineSkill, AbandonBudSkill, HarvestBudSkill,
        ListPlantsSkill, ListBudsSkill, GetStatisticsSkill,
        GetGardenBriefingSkill, SearchConversationSkill,
    ]:
        reg.register(cls())
    return reg


class ChatOrchestrator:
    def __init__(self, api_key: str):
        self.llm = LLMClient(api_key)
        self.registry = _build_registry()
        self.builder = PromptBuilder()

    async def run_stream(self, user_id: str, text: str,
                         scope: str, scope_id: str | None,
                         current_screen: str, db):
        """Async generator yielding SSE-formatted strings."""
        from app.services.plant_service import PlantService
        from app.services.bud_service import BudService
        from app.services.garden_state_service import GardenStateService
        from app.services.conversation_service import ConversationService

        plant_svc = PlantService(db)
        bud_svc = BudService(db)
        gs_svc = GardenStateService(db)
        conv_svc = ConversationService(db)

        ctx = SkillContext(
            user_id=user_id,
            db=db,
            plant_service=plant_svc,
            bud_service=bud_svc,
            garden_state_service=gs_svc,
            conversation_service=conv_svc,
        )

        # Record user message
        conv_svc.append(user_id, scope, scope_id, "user", text)

        # Build system prompt
        stats = gs_svc.get_summary(user_id)
        plants = plant_svc.find_matches(user_id, "", top_k=20)
        system = self.builder.build_system(ctx, current_screen, stats, plants)

        tools = self.registry.build_catalog()
        messages = [{"role": "user", "content": text}]

        # If no API key, return dummy response
        if not self.llm._key:
            dummy = "안녕하세요! 정원사입니다. API 키를 설정하면 대화를 시작할 수 있어요."
            yield f"event: token\ndata: {json.dumps({'text': dummy})}\n\n"
            conv_svc.append(user_id, scope, scope_id, "assistant", dummy)
            yield f"event: done\ndata: {json.dumps({})}\n\n"
            return

        full_text = ""
        tool_use_block = None

        # Stream LLM response
        async for event in self.llm.chat_stream(messages, tools, system):
            event_type = getattr(event, "type", None)
            if event_type == "content_block_delta":
                delta = getattr(event, "delta", None)
                if delta and getattr(delta, "type", None) == "text_delta":
                    token = delta.text
                    full_text += token
                    yield f"event: token\ndata: {json.dumps({'text': token})}\n\n"
            elif event_type == "content_block_start":
                block = getattr(event, "content_block", None)
                if block and getattr(block, "type", None) == "tool_use":
                    tool_use_block = {"id": block.id, "name": block.name, "input": {}}
            elif event_type == "input_json_delta" and tool_use_block:
                # Accumulate JSON
                pass
            elif event_type == "message_stop":
                pass

        # If tool_use was signaled, do a non-streaming call to get full tool_use
        if tool_use_block is None and not full_text:
            result = self.llm.chat(messages, tools, system)
            full_text = result["text"]
            tool_use_block = result.get("tool_use")
            if full_text:
                yield f"event: token\ndata: {json.dumps({'text': full_text})}\n\n"

        # Dispatch skill if any
        if tool_use_block:
            name = tool_use_block["name"]
            args = tool_use_block.get("input", {})
            yield f"event: tool_call\ndata: {json.dumps({'skill': name, 'args': args})}\n\n"

            skill_result = self.registry.dispatch(name, args, ctx)
            yield f"event: tool_result\ndata: {json.dumps({'ok': skill_result.ok, 'message': skill_result.message, 'data': skill_result.data})}\n\n"

            # Second LLM call with tool result
            messages2 = messages + [
                {"role": "assistant", "content": [
                    {"type": "tool_use", "id": tool_use_block.get("id", "0"),
                     "name": name, "input": args}
                ]},
                {"role": "user", "content": [
                    {"type": "tool_result",
                     "tool_use_id": tool_use_block.get("id", "0"),
                     "content": json.dumps(skill_result.data)}
                ]},
            ]
            result2 = self.llm.chat(messages2, tools, system)
            if result2["text"]:
                full_text = (full_text + " " + result2["text"]).strip()
                yield f"event: token\ndata: {json.dumps({'text': result2['text']})}\n\n"

        # Record assistant response
        conv_svc.append(user_id, scope, scope_id, "assistant", full_text,
                        skill_call=tool_use_block)
        yield f"event: done\ndata: {json.dumps({})}\n\n"
```

- [ ] **Step 3: Verify imports**

```bash
cd C:/Users/jaemi/Documents/Project/plant-counselor/backend
python -c "
from app.ai.llm_client import LLMClient
from app.ai.chat_orchestrator import ChatOrchestrator
print('llm_client and orchestrator OK')
"
```
Expected: `llm_client and orchestrator OK`

- [ ] **Step 4: Commit**

```bash
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" add backend/app/ai/llm_client.py backend/app/ai/chat_orchestrator.py
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" commit -m "feat(ai): add LLMClient and ChatOrchestrator with SSE streaming"
```

---

## Task 10: All Routers

**Files:** `backend/app/routers/__init__.py` + 8 router files

- [ ] **Step 1: Write routers/__init__.py** (empty)

- [ ] **Step 2: Write routers/auth.py**

```python
# backend/app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, Response, Cookie
from sqlalchemy.orm import Session

from app.deps import get_db
from app.schemas.user import UserCreate, UserLogin, TokenResponse, UserOut
from app.services.user_service import UserService
from app.services.exceptions import DomainError
from app.auth.jwt import create_access_token, create_refresh_token, decode_token
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup")
def signup(body: UserCreate, db: Session = Depends(get_db)):
    svc = UserService(db)
    try:
        svc.signup(body.nickname, body.password)
    except DomainError as e:
        raise HTTPException(status_code=400, detail=e.message)
    return {"ok": True, "data": {"message": "회원가입 완료. 로그인해주세요."}}


@router.post("/login")
def login(body: UserLogin, response: Response,
          db: Session = Depends(get_db)):
    svc = UserService(db)
    try:
        user = svc.authenticate(body.nickname, body.password)
    except DomainError as e:
        raise HTTPException(status_code=401, detail=e.message)

    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)

    response.set_cookie(
        key="refresh",
        value=refresh,
        httponly=True,
        samesite="lax",
        max_age=settings.jwt_refresh_ttl * 24 * 3600,
        path="/api/v1/auth",
    )
    return {
        "ok": True,
        "data": {
            "access_token": access,
            "token_type": "bearer",
            "user": UserOut.model_validate(user).model_dump(),
        },
    }


@router.post("/refresh")
def refresh_token(response: Response,
                  refresh: str | None = Cookie(default=None),
                  db: Session = Depends(get_db)):
    if not refresh:
        raise HTTPException(status_code=401, detail="리프레시 토큰이 없습니다.")
    payload = decode_token(refresh)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
    from app.db.models.user import User
    user = db.get(User, payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다.")

    new_access = create_access_token(user.id)
    new_refresh = create_refresh_token(user.id)
    response.set_cookie(
        key="refresh",
        value=new_refresh,
        httponly=True,
        samesite="lax",
        max_age=settings.jwt_refresh_ttl * 24 * 3600,
        path="/api/v1/auth",
    )
    return {"ok": True, "data": {"access_token": new_access}}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("refresh", path="/api/v1/auth")
    return {"ok": True, "data": {}}
```

- [ ] **Step 3: Write routers/me.py**

```python
# backend/app/routers/me.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_db, require_user
from app.db.models.user import User
from app.schemas.user import UserOut, UserUpdate, PasswordChange, ApiKeySet
from app.services.user_service import UserService
from app.services.exceptions import DomainError

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=None)
def get_me(user: User = Depends(require_user)):
    return {"ok": True, "data": UserOut.model_validate(user).model_dump()}


@router.patch("")
def update_me(body: UserUpdate, user: User = Depends(require_user),
              db: Session = Depends(get_db)):
    svc = UserService(db)
    updated = svc.update_profile(user.id, body.model_dump(exclude_none=True))
    return {"ok": True, "data": UserOut.model_validate(updated).model_dump()}


@router.post("/password")
def change_password(body: PasswordChange, user: User = Depends(require_user),
                    db: Session = Depends(get_db)):
    svc = UserService(db)
    try:
        svc.change_password(user.id, body.old_password, body.new_password)
    except DomainError as e:
        raise HTTPException(status_code=400, detail=e.message)
    return {"ok": True, "data": {}}


@router.delete("")
def delete_account(body: dict, user: User = Depends(require_user),
                   db: Session = Depends(get_db)):
    confirm_nickname = body.get("confirm_nickname", "")
    svc = UserService(db)
    try:
        svc.delete_account(user.id, confirm_nickname)
    except DomainError as e:
        raise HTTPException(status_code=400, detail=e.message)
    return {"ok": True, "data": {}}


@router.put("/api-key")
def set_api_key(body: ApiKeySet, user: User = Depends(require_user),
                db: Session = Depends(get_db)):
    svc = UserService(db)
    svc.set_api_key(user.id, body.api_key)
    return {"ok": True, "data": {}}
```

- [ ] **Step 4: Write routers/plants.py**

```python
# backend/app/routers/plants.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.deps import get_db, require_user
from app.db.models.user import User
from app.schemas.plant import PlantOut, PlantUpdate
from app.services.plant_service import PlantService
from app.services.exceptions import DomainError

router = APIRouter(prefix="/plants", tags=["plants"])


@router.get("")
def list_plants(
    sort: str = Query("activity"),
    include_dormant: bool = Query(True),
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    svc = PlantService(db)
    plants = svc.list(user.id, include_dormant=include_dormant, sort=sort)
    return {"ok": True, "data": {"items": [PlantOut.model_validate(p).model_dump() for p in plants]}}


@router.get("/{plant_id}")
def get_plant(plant_id: str, user: User = Depends(require_user),
              db: Session = Depends(get_db)):
    svc = PlantService(db)
    try:
        plant = svc.get(user.id, plant_id)
    except DomainError as e:
        raise HTTPException(status_code=404, detail=e.message)
    return {"ok": True, "data": PlantOut.model_validate(plant).model_dump()}


@router.patch("/{plant_id}")
def update_plant(plant_id: str, body: PlantUpdate,
                 user: User = Depends(require_user),
                 db: Session = Depends(get_db)):
    svc = PlantService(db)
    try:
        plant = svc.update(user.id, plant_id,
                           body.model_dump(exclude_none=True))
    except DomainError as e:
        raise HTTPException(status_code=404, detail=e.message)
    return {"ok": True, "data": PlantOut.model_validate(plant).model_dump()}


@router.delete("/{plant_id}")
def delete_plant(plant_id: str, user: User = Depends(require_user),
                 db: Session = Depends(get_db)):
    svc = PlantService(db)
    try:
        svc.delete(user.id, plant_id)
    except DomainError as e:
        raise HTTPException(status_code=404, detail=e.message)
    return {"ok": True, "data": {}}
```

- [ ] **Step 5: Write routers/buds.py**

```python
# backend/app/routers/buds.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import list as List

from app.deps import get_db, require_user
from app.db.models.user import User
from app.schemas.bud import BudOut, BudUpdate, BudWithHistory, BudHistoryOut
from app.services.bud_service import BudService
from app.services.exceptions import DomainError
from app.repositories.bud_repo import BudRepo

router = APIRouter(prefix="/buds", tags=["buds"])


@router.get("")
def list_buds(
    plant_id: str | None = Query(None),
    statuses: str | None = Query(None),
    bud_type: str | None = Query(None, alias="type"),
    wilting_only: bool = Query(False),
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    svc = BudService(db)
    filters = {
        "plant_id": plant_id,
        "statuses": statuses.split(",") if statuses else None,
        "type": bud_type,
        "wilting_only": wilting_only,
    }
    buds = svc.list(user.id, filters)
    return {"ok": True, "data": {"items": [BudOut.model_validate(b).model_dump() for b in buds]}}


@router.get("/{bud_id}")
def get_bud(bud_id: str, user: User = Depends(require_user),
            db: Session = Depends(get_db)):
    svc = BudService(db)
    repo = BudRepo(db)
    try:
        bud = svc.get(user.id, bud_id)
    except DomainError as e:
        raise HTTPException(status_code=404, detail=e.message)
    history = repo.get_history(bud_id)
    return {
        "ok": True,
        "data": {
            "bud": BudOut.model_validate(bud).model_dump(),
            "history": [BudHistoryOut.model_validate(h).model_dump() for h in history],
        },
    }


@router.patch("/{bud_id}")
def update_bud(bud_id: str, body: BudUpdate,
               user: User = Depends(require_user),
               db: Session = Depends(get_db)):
    svc = BudService(db)
    try:
        bud = svc.get(user.id, bud_id)
    except DomainError as e:
        raise HTTPException(status_code=404, detail=e.message)
    if body.title is not None:
        bud.title = body.title
    if body.detail is not None:
        bud.detail = body.detail
    from app.repositories.bud_repo import BudRepo
    updated = BudRepo(db).update(bud)
    return {"ok": True, "data": BudOut.model_validate(updated).model_dump()}
```

- [ ] **Step 6: Write routers/stats.py**

```python
# backend/app/routers/stats.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date

from app.deps import get_db, require_user
from app.db.models.user import User
from app.services.garden_state_service import GardenStateService
from app.services.bud_service import BudService

router = APIRouter(tags=["stats"])


@router.get("/stats/summary")
def summary(user: User = Depends(require_user),
            db: Session = Depends(get_db)):
    svc = GardenStateService(db)
    data = svc.refresh_summary(user.id)
    return {"ok": True, "data": data}


@router.get("/stats/full")
def full_stats(period: str = Query("this_month"),
               plant_id: str | None = Query(None),
               user: User = Depends(require_user),
               db: Session = Depends(get_db)):
    svc = GardenStateService(db)
    data = svc.compute_stats(user.id, period=period, plant_id=plant_id)
    return {"ok": True, "data": data}


@router.get("/calendar")
def calendar(
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    bud_svc = BudService(db)
    all_buds = bud_svc.list(user.id, {})
    events = []
    for b in all_buds:
        if b.deadline and from_date <= b.deadline <= to_date:
            events.append({
                "bud_id": b.id,
                "title": b.title,
                "deadline": str(b.deadline),
                "status": b.status,
                "type": b.type,
            })
    return {"ok": True, "data": {"events": events}}


@router.get("/briefing/today")
def today_briefing(user: User = Depends(require_user),
                   db: Session = Depends(get_db)):
    svc = GardenStateService(db)
    briefing = svc.build_briefing(user.id)
    svc.mark_opened(user.id)
    return {"ok": True, "data": {"briefing": briefing}}
```

- [ ] **Step 7: Write routers/notifications.py**

```python
# backend/app/routers/notifications.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_db, require_user
from app.db.models.user import User
from app.schemas.notification import NotificationOut
from app.services.notification_service import NotificationService
from app.services.exceptions import DomainError

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(user: User = Depends(require_user),
                       db: Session = Depends(get_db)):
    svc = NotificationService(db)
    items = svc.list_unread(user.id)
    return {"ok": True, "data": {"items": [
        NotificationOut.model_validate(n).model_dump() for n in items
    ]}}


@router.post("/{notification_id}/ack")
def ack_notification(notification_id: str,
                     user: User = Depends(require_user),
                     db: Session = Depends(get_db)):
    svc = NotificationService(db)
    try:
        svc.ack(user.id, notification_id)
    except DomainError as e:
        raise HTTPException(status_code=404, detail=e.message)
    return {"ok": True, "data": {}}
```

- [ ] **Step 8: Write routers/chat.py**

```python
# backend/app/routers/chat.py
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.deps import get_db, require_user
from app.db.models.user import User
from app.schemas.chat import ChatRequest
from app.ai.chat_orchestrator import ChatOrchestrator
from app.config import settings

router = APIRouter(prefix="/chat", tags=["chat"])


def _get_orchestrator() -> ChatOrchestrator:
    return ChatOrchestrator(api_key=settings.llm_api_key)


@router.post("/message")
async def chat_message(
    req: ChatRequest,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    orchestrator = _get_orchestrator()

    async def generate():
        async for event in orchestrator.run_stream(
            user_id=user.id,
            text=req.text,
            scope=req.scope,
            scope_id=req.scope_id,
            current_screen=req.current_screen,
            db=db,
        ):
            yield event

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
```

- [ ] **Step 9: Write routers/conversations.py**

```python
# backend/app/routers/conversations.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_db, require_user
from app.db.models.user import User
from app.schemas.conversation import SearchRequest, MessageOut, ConversationOut
from app.services.conversation_service import ConversationService

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("")
def list_conversations(user: User = Depends(require_user),
                       db: Session = Depends(get_db)):
    svc = ConversationService(db)
    convs = svc.list_conversations(user.id)
    return {"ok": True, "data": {"items": [
        ConversationOut.model_validate(c).model_dump() for c in convs
    ]}}


@router.post("/search")
def search_conversations(body: SearchRequest,
                         user: User = Depends(require_user),
                         db: Session = Depends(get_db)):
    svc = ConversationService(db)
    msgs = svc.search(user.id, body.query,
                      scope=body.scope,
                      scope_id=body.scope_id,
                      limit=body.limit)
    return {"ok": True, "data": {"messages": [
        MessageOut.model_validate(m).model_dump() for m in msgs
    ]}}
```

- [ ] **Step 10: Commit routers**

```bash
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" add backend/app/routers/
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" commit -m "feat(routers): add all 8 API routers"
```

---

## Task 11: Scheduler + main.py

**Files:**
- Create: `backend/app/scheduler/__init__.py`
- Create: `backend/app/scheduler/jobs.py`
- Create: `backend/app/main.py`

- [ ] **Step 1: Write scheduler/__init__.py** (empty)

- [ ] **Step 2: Write scheduler/jobs.py**

```python
# backend/app/scheduler/jobs.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.db.session import SessionLocal

scheduler = AsyncIOScheduler()


def setup_scheduler() -> None:
    @scheduler.scheduled_job("interval", minutes=10, id="transition_scan")
    def transition_scan():
        from app.services.transition_service import TransitionService
        with SessionLocal() as db:
            svc = TransitionService(db)
            svc.scan_all()

    scheduler.start()
```

- [ ] **Step 3: Write main.py**

```python
# backend/app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.session import engine
from app.db.base import Base

# Import all models so Base.metadata knows about them
import app.db.models.user          # noqa: F401
import app.db.models.plant         # noqa: F401
import app.db.models.bud           # noqa: F401
import app.db.models.garden_state  # noqa: F401
import app.db.models.conversation  # noqa: F401
import app.db.models.notification  # noqa: F401

from app.routers import auth, me, plants, buds, stats, chat, conversations, notifications
from app.scheduler.jobs import setup_scheduler, scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables (dev mode)
    Base.metadata.create_all(bind=engine)
    # Start background scheduler
    setup_scheduler()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="Plant Counselor API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_allow_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_API_PREFIX = "/api/v1"

for router in [
    auth.router,
    me.router,
    plants.router,
    buds.router,
    notifications.router,
    chat.router,
    conversations.router,
]:
    app.include_router(router, prefix=_API_PREFIX)

# stats router has no common prefix (mixed paths like /stats/... and /calendar and /briefing)
app.include_router(stats.router, prefix=_API_PREFIX)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Commit**

```bash
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" add backend/app/scheduler/ backend/app/main.py
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" commit -m "feat: add scheduler and main.py — server is wired up"
```

---

## Task 12: Smoke Test

- [ ] **Step 1: Install dependencies**

```bash
cd C:/Users/jaemi/Documents/Project/plant-counselor/backend
pip install -e ".[dev]" 2>/dev/null || uv sync
```

- [ ] **Step 2: Verify full import chain**

```bash
cd C:/Users/jaemi/Documents/Project/plant-counselor/backend
python -c "
from app.main import app
print('app import OK, routes:',
      [r.path for r in app.routes])
"
```
Expected: prints `app import OK, routes:` followed by list including `/api/v1/auth/signup`, `/api/v1/plants`, `/api/v1/chat/message`, `/health`, etc.

- [ ] **Step 3: Start the server and hit /health**

```bash
cd C:/Users/jaemi/Documents/Project/plant-counselor/backend
uvicorn app.main:app --port 8000 &
sleep 2
curl http://localhost:8000/health
```
Expected: `{"status":"ok"}`

- [ ] **Step 4: Test signup + login flow**

```bash
curl -s -X POST http://localhost:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"nickname":"testuser","password":"password123"}' | python -m json.tool

curl -s -c /tmp/cookies.txt -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nickname":"testuser","password":"password123"}' | python -m json.tool
```
Expected: signup returns `{"ok": true}`, login returns `{"ok": true, "data": {"access_token": "..."}}`.

- [ ] **Step 5: Kill test server**

```bash
pkill -f "uvicorn app.main"
```

- [ ] **Step 6: Final commit**

```bash
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" add -A
git -C "C:/Users/jaemi/Documents/Project/plant-counselor" commit -m "feat(backend): complete AI layer, auth, routers, scheduler"
```

---

## Self-Review

### Spec Coverage

| Spec Requirement | Task |
|---|---|
| `app/ai/__init__.py` (empty) | Task 7 |
| `app/ai/skill_base.py` — SkillBase, SkillResult, SkillContext | Task 7 |
| `app/ai/skill_registry.py` — register, get, list, build_catalog, dispatch + ownership guard | Task 7 |
| `app/ai/skills/__init__.py` (empty) | Task 8 |
| 14 skill files | Task 8 |
| `app/ai/prompt_builder.py` — Korean system prompt | Task 7 |
| `app/ai/llm_client.py` — sync + async stream, dummy when no key | Task 9 |
| `app/ai/chat_orchestrator.py` — SSE stream, skill dispatch, conversation logging | Task 9 |
| `app/auth/__init__.py` (empty) | Task 6 |
| `app/auth/jwt.py` — access (15m) + refresh (14d) + decode | Task 6 |
| `app/deps.py` — get_db, get_current_user, require_user | Task 6 |
| `app/routers/auth.py` — signup, login (refresh cookie), refresh, logout | Task 10 |
| `app/routers/me.py` — GET/PATCH /me, password, delete, api-key | Task 10 |
| `app/routers/plants.py` — list, get, patch, delete | Task 10 |
| `app/routers/buds.py` — list, get+history, patch | Task 10 |
| `app/routers/stats.py` — summary, full, calendar, briefing | Task 10 |
| `app/routers/notifications.py` — list, ack | Task 10 |
| `app/routers/chat.py` — SSE StreamingResponse | Task 10 |
| `app/routers/conversations.py` — list, search | Task 10 |
| `app/scheduler/__init__.py` (empty) | Task 11 |
| `app/scheduler/jobs.py` — APScheduler 10-min interval | Task 11 |
| `app/main.py` — CORS, lifespan, all routers at /api/v1 | Task 11 |
| Repositories (prerequisites) | Task 2 |
| Services (prerequisites) | Tasks 3–5 |
| Schemas (prerequisites) | Task 1 |

All 33 spec files covered. No gaps.

### Placeholder Scan

No TBD, TODO, or implement-later text present. Every step has actual code.

### Type Consistency

- `BudService.list` accepts `filters: dict` — `list_buds.py` router and `ListBudsSkill` both pass `dict`. ✓
- `ConversationService.append` takes `role, text, skill_call` — `chat_orchestrator.py` calls with matching signature. ✓
- `SkillContext.bud_service` / `plant_service` used in skills — set in `ChatOrchestrator.run_stream`. ✓
- `PlantService.find_matches` returns `list[dict]` — `MatchPlantSkill` returns `data={"matches": matches}`. ✓
