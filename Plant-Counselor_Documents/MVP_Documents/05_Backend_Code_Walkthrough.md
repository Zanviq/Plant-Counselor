# 05. 백엔드 코드 워크스루

> 모든 백엔드 Python 파일의 **함수·변수·결정 이유**를 빠짐없이 정리한 문서입니다.
> 파일은 의존성 순서대로 정렬되어 있습니다(아래로 갈수록 위 계층에 의존).

---

## 1. `app/config.py`

```python
class Settings(BaseSettings):
    database_url: str = "sqlite:///./plant_counselor.db"
    jwt_secret: str = "dev-secret"
    jwt_access_ttl: int = 15        # minutes
    jwt_refresh_ttl: int = 14       # days
    llm_api_key: str = ""
    key_encryption_secret: str = "dev-encryption-key-32chars-padded"
    cors_allow_origin: str = "http://localhost:3000"
    class Config:
        env_file = ".env"

settings = Settings()
```

- **역할**: 환경설정 단일 진입점. 모든 다른 모듈은 `from app.config import settings` 만 사용.
- **`database_url`**: `sqlite://` 와 `postgres://` 둘 다 받게 두어 dev/prod 전환이 1줄 변경으로 가능.
- **`jwt_access_ttl=15`**: 짧게 두고 refresh로 갱신하는 보안 권장 패턴.
- **`jwt_refresh_ttl=14일`**: 모바일/노트북 사용 패턴(2주)에 맞춤. 더 길면 키 유출 시 위험.
- **`key_encryption_secret`**: Fernet 키 파생용. 32바이트가 아닌 임의 길이여도 `UserService._make_fernet` 에서 SHA-256 후 base64로 안전하게 가공.
- **`cors_allow_origin`**: prod에서는 https 도메인 1개로 잠그도록 단일 문자열로 정의.

## 2. `app/db/base.py`

```python
class Base(DeclarativeBase): pass
```

- **역할**: 모든 ORM 모델의 부모 클래스. SQLAlchemy 2.x `DeclarativeBase` 사용.
- **왜 한 줄?** Alembic autogenerate가 `Base.metadata` 만 보면 되도록 분리. 모델 임포트가 누락되면 마이그레이션이 모델을 찾지 못함 → `app/db/models/__init__.py` 가 모든 모델을 import해서 메타데이터에 등록.

## 3. `app/db/session.py`

```python
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
```

- **`check_same_thread=False`**: SQLite는 기본적으로 한 connection을 만든 thread에서만 사용 가능. FastAPI는 thread pool에서 sync 코드를 돌리므로 비활성 필수.
- **`pool_pre_ping=True`**: 커넥션이 죽었다가 재사용될 때 자동 reconnect. 장시간 idle 후에도 안정.
- **`autocommit=False, autoflush=False`**: 명시적 트랜잭션 패턴 강제. 의도치 않은 flush로 인한 부분 커밋 방지.
- **`get_db`는 이 파일이 아니라 `deps.py`에 있음** — FastAPI 의존성은 한 곳에 모으는 정책.

## 4. `app/db/models/__init__.py`

```python
from app.db.models.user import User
from app.db.models.garden_state import GardenState
from app.db.models.plant import Plant
from app.db.models.bud import Bud, BudHistory
from app.db.models.conversation import Conversation, ConversationMessage
from app.db.models.notification import Notification
```

- **유일한 책임**: 모든 모델을 import하여 `Base.metadata` 에 등록. Alembic autogenerate가 모델을 누락하지 않게 함.
- **순환 import 위험 없음**: 모델은 다른 도메인을 import하지 않음(외래키는 문자열 `"users.id"` 로 참조).

## 5. `app/db/models/user.py`

```python
class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    nickname: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    address: Mapped[str] = mapped_column(String, nullable=False, default="")
    tone: Mapped[str] = mapped_column(String, nullable=False, default="counselor")
    encrypted_api_key: Mapped[str | None] = mapped_column(String, nullable=True)
    garden_rules: Mapped[dict] = mapped_column(JSON, nullable=False, default=lambda: {...})
    appearance: Mapped[dict] = mapped_column(JSON, nullable=False, default=lambda: {"theme":"auto", "animation":"subtle"})
    sound: Mapped[dict] = mapped_column(JSON, nullable=False, default=lambda: {"sfx":True, "bgm":False, "volume":0.6})
    ai_model: Mapped[str] = mapped_column(String, nullable=False, default="claude-opus-4-7")
    ai_proactive: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at, updated_at
```

**컬럼 결정 이유**:

- **`id: str (ULID)`**: 정렬 가능한 시간 기반 ID + URL-safe. INT auto-increment보다 분산·로그·디버깅에 유리.
- **`nickname` unique + index**: 로그인 키로 사용되므로 인덱스 필수.
- **`address` 기본값 = ""**: 닉네임 외 자유 표기. signup에서 초기엔 nickname 복사.
- **`tone="counselor"`**: 톤 기본값을 따뜻한 상담사로 — 본 서비스의 컨셉.
- **`encrypted_api_key` nullable**: 키 미입력 시에도 가입 자체는 가능. Fallback은 `settings.llm_api_key`.
- **`garden_rules` JSON**: 4개 필드(`wilting_days`, `rot_disappear_days`, `deadline_warn_days`, `auto_transition`) — 사용자별 자동 전이 정책. JSON으로 두어 향후 룰 확장 시 마이그레이션 없이 추가 가능.
- **`appearance` / `sound`**: 향후 PWA/모바일에서의 외관·음향. 현재 MVP에선 UI 사용처 없음(테마는 별도 localStorage).
- **`ai_model="claude-opus-4-7"`**: 본 컬럼은 디폴트만 잡혀 있을 뿐, 실제 사용 모델은 `LLMClient.DEFAULT_MODEL="gemini-2.5-flash"` 가 우선. 향후 사용자 선택 가능하게 노출할 자리.
- **`ai_proactive`**: 향후 자동 알림/제안 기능을 켜고 끌 플래그.

## 6. `app/db/models/plant.py`

```python
class Plant(Base):
    __tablename__ = "plants"
    __table_args__ = (
        Index("ix_plants_user_status", "user_id", "status"),
        Index("ix_plants_user_last_activity", "user_id", "last_activity_at"),
    )
    id, user_id (FK CASCADE), name, description
    species: Mapped[str] = ... default="tree_oak"
    color: Mapped[str] = ... default="brand.primary_leaf"
    status: Mapped[str] = ... default="active"   # active / dormant / archived
    stats: Mapped[dict] = ... default=lambda: {"harvested_count":0, "rot_count":0, "active_bud_count":0}
    last_activity_at: Mapped[datetime | None] = ... nullable=True
    created_at, updated_at
```

- **인덱스 2개**:
  - `(user_id, status)` — `list_plants` 가 `WHERE user_id=? AND status != 'archived'` 로 거의 항상 필터링.
  - `(user_id, last_activity_at)` — 정렬 `ORDER BY last_activity_at DESC` 의 성능 보장.
- **`species`, `color`**: 향후 식물 SVG 스프라이트 다양화를 위한 자리(현재 MVP에선 단일 비주얼).
- **`status`**: 라이프사이클 — active(보통), dormant(휴면 — list_plants 기본 필터에서 제외), archived(삭제됨, soft delete).
- **`stats` JSON**: 비정규화된 카운터. 실시간 정확도를 위해 `PlantService.increment_*` / `refresh_active_bud_count` 가 갱신.
- **`last_activity_at`**: 정렬 키. `increment_stat` 호출 시 자동 업데이트.

## 7. `app/db/models/bud.py`

```python
class Bud(Base):
    __tablename__ = "buds"
    __table_args__ = (
        Index("ix_buds_user_status", "user_id", "status"),
        Index("ix_buds_user_deadline", "user_id", "deadline"),
        Index("ix_buds_plant_status", "plant_id", "status"),
    )
    id, user_id, plant_id (둘 다 FK CASCADE)
    title, detail
    type: ... default="concern"   # concern | schedule
    status: ... default="seed"
    progress: ... default=0
    deadline: Mapped[date | None]
    last_progress_at, disappeared_at: nullable DateTime
    created_at, updated_at

class BudHistory(Base):
    id, bud_id (FK CASCADE)
    from_status, to_status, at, reason
    Index("ix_bud_histories_bud_at", "bud_id", "at")
```

- **인덱스 3개**:
  - `(user_id, status)` — 대시보드 카운트 쿼리.
  - `(user_id, deadline)` — `deadline_within_days` 필터.
  - `(plant_id, status)` — 식물 상세 페이지의 봉우리 목록.
- **`type`**: 고민과 일정을 동등하게 다루기 위해 도입 — UI에서 칼럼/뱃지로 구분.
- **`progress: Integer`**: 정수 0~100. 자동 전이 임계 30/60/85에 사용.
- **`last_progress_at`**: TransitionService가 wilting 판정에 사용.
- **`disappeared_at`**: rot 후 14일(`rot_disappear_days`) 지나면 채워짐 → 프론트에서 보이지 않음(soft hide).
- **`BudHistory`**: 모든 상태 전이를 기록. 봉우리 드로어의 "이력" 탭과 신뢰성·디버깅에 사용.

## 8. `app/db/models/conversation.py`

```python
class Conversation(Base):
    UniqueConstraint("user_id", "scope", "scope_id", name="uq_conversation_user_scope")
    id, user_id, scope (global/plant/bud), scope_id (nullable)

class ConversationMessage(Base):
    Index("ix_conversation_messages_conv_at", "conversation_id", "at")
    id, conversation_id (FK CASCADE)
    at (default=utcnow, index)
    role, text
    skill_call: Mapped[dict | None]   # JSON으로 마지막 스킬 호출 정보 저장
```

- **3-튜플 unique** `(user_id, scope, scope_id)`: 같은 사용자가 같은 컨텍스트에서 단 하나의 대화방을 갖도록 보장. `get_or_create` 의 안정성 보증.
- **`skill_call` JSON**: assistant 메시지가 어떤 스킬을 호출했는지 후속 분석/UI에서 활용 가능 (현재 표시는 안 함, 데이터만 보존).
- **인덱스 `(conversation_id, at)`**: 히스토리 페이징의 핵심.

## 9. `app/db/models/garden_state.py`

```python
class GardenState(Base):
    UniqueConstraint("user_id", name="uq_garden_state_user_id")
    id, user_id (FK CASCADE, indexed)
    summary_cache: dict (JSON)
    daily_briefing: str | None
    daily_briefing_date: date | None
    last_opened_at: datetime | None
```

- **사용자 1:1**: 사용자당 1행. unique constraint로 강제.
- **`summary_cache`**: 활성 카운트들의 캐시본. 현재는 `stats router`가 매 호출마다 refresh 하지만, 향후 invalidate-on-write 패턴으로 옮길 자리.
- **`daily_briefing` + `daily_briefing_date`**: 같은 날 여러 번 요청해도 한 번만 생성. 비용 절감.
- **`last_opened_at`**: 향후 "오랜만에 정원을 들렀어요" 같은 UX 기회.

## 10. `app/db/models/notification.py`

```python
class Notification(Base):
    Index("ix_notifications_user_acked", "user_id", "acked_at")
    id, user_id (FK CASCADE, indexed)
    kind: str
    payload: dict (JSON)
    created_at
    acked_at: datetime | None
```

- **`acked_at IS NULL`** 인 행이 "안 읽은 알림". `(user_id, acked_at)` 인덱스가 그 필터를 빠르게.
- **`kind`**: `bud_wilting`, `bud_rot`, `deadline_warning` 3종. UI에서 색·아이콘 결정.
- **`payload`**: 종류별 메타(예: `{bud_id, title, deadline}`). 프론트가 적절히 해석.

---

## 11. `app/auth/jwt.py`

```python
ALGORITHM = "HS256"

def create_access_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "access", "iat": now, "exp": now+15min}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)

def create_refresh_token(user_id): ... type="refresh", exp=14일
def decode_token(token: str) -> dict | None:   # 실패 시 None
```

- **`type`** 클레임으로 access/refresh를 구분 — `require_user` 와 `/auth/refresh` 가 각각 자신의 타입만 받아들임. 토큰 종류 혼용 공격 방지.
- **`decode_token` 이 예외 대신 None 반환**: 호출처에서 `if payload is None: 401` 패턴이 깔끔.
- **`HS256`**: 단일 백엔드 인스턴스에 적합. 마이크로서비스/JWKS 필요 시 RS256으로 변경.

## 12. `app/deps.py`

```python
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try: yield db
    finally: db.close()

_CREDS_EXC = HTTPException(401, "인증에 실패했습니다.", headers={"WWW-Authenticate":"Bearer"})

def require_user(authorization, db) -> User:
    if not authorization: raise _CREDS_EXC
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token: raise _CREDS_EXC
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access": raise _CREDS_EXC
    user_id = payload.get("sub")
    if not user_id: raise _CREDS_EXC
    user = UserRepository(db).get_by_id(user_id)
    if user is None: raise _CREDS_EXC
    return user
```

- **모든 401 분기를 같은 메시지/헤더로 통일**: 정보 유출 최소화 (어느 단계에서 실패했는지 클라이언트가 구분 못 함).
- **`require_user` 자체가 `Depends(get_db)` 를 받음**: 라우터는 `Depends(require_user)` 만 적으면 인증된 User 객체 획득.
- **JWT 함수는 여기에 없다**: 책임 분리(`app.auth.jwt`). 이전엔 중복 정의되어 있었으나 정리함.

---

## 13. Repositories

### 13.1 `app/repositories/user_repo.py`

```python
class UserRepository:
    def __init__(self, db: Session): self.db = db
    def get_by_id(self, user_id) -> User | None
    def get_by_nickname(self, nickname) -> User | None
    def create(self, nickname, password_hash) -> User:
        user = User(id=str(ULID()), nickname=..., password_hash=..., address=nickname)
        self.db.add(user); self.db.flush()  # commit 안 함
        return user
    def update(self, user_id, fields: dict) -> User | None  # setattr 루프
    def delete(self, user_id) -> None
    def set_encrypted_api_key(self, user_id, encrypted_key) -> None
    def get_encrypted_api_key(self, user_id) -> str | None
```

**관찰**:
- `commit` 없음 — Service가 책임.
- `create()` 에서 `address=nickname` 으로 초기화하여 NOT NULL 제약 우회.
- `update()` 는 `setattr` 루프 — 한 번에 여러 필드를 받을 수 있어 PATCH 라우터에 적합.

### 13.2 `app/repositories/plant_repo.py`

```python
def create(user_id, name, description, species, color) -> Plant
def get(user_id, plant_id) -> Plant | None   # user_id로 격리
def list(user_id, include_dormant=True, sort="activity", limit=100)
def update(user_id, plant_id, fields) -> Plant | None
def increment_stat(user_id, plant_id, stat_key):
    plant.stats[stat_key] += 1
    plant.last_activity_at = utcnow()
def update_active_bud_count(user_id, plant_id, count)
def update_stats(user_id, plant_id, stats_update: dict)
```

**핵심**:
- 모든 메서드가 `user_id` 를 받음 → 다른 사용자의 식물 접근 차단 (수평 권한 격리).
- `list()` 정렬: `activity` 시 `last_activity_at.desc().nulls_last(), created_at.desc()` — null이 뒤로 가도록 두어 새로 생성된 빈 식물도 자연스럽게 나옴.
- `increment_stat()` 에서 dict를 새로 만들어(`dict(plant.stats or {})`) 재할당해야 SQLAlchemy JSON change tracking이 동작 — 단순 `plant.stats["x"] += 1` 은 mutation이 감지되지 않음.

### 13.3 `app/repositories/bud_repo.py`

```python
def create(user_id, plant_id, title, type, detail, deadline) -> Bud
def get(user_id, bud_id) -> Bud | None
def list(user_id, plant_id=None, statuses=None, bud_type=None,
         wilting_only=False, deadline_within_days=None, limit=50)
def update(user_id, bud_id, fields)
def add_history(bud_id, from_status, to_status, reason) -> BudHistory
def get_history(bud_id) -> list[BudHistory]   # ORDER BY at ASC
def count_active(plant_id) -> int
```

**핵심**:
- `list()` 는 다양한 필터를 받지만 모두 optional — 호출처가 dict 또는 named arg로 자유롭게.
- `deadline_within_days` 는 `today + N` 이하 cutoff로 묶음 — 캘린더/알림 사전조회에 사용.
- `add_history()` 는 항상 ULID로 새 행을 만들고 flush — 트랜잭션은 service가.

### 13.4 `app/repositories/conversation_repo.py`

```python
def get_or_create(user_id, scope, scope_id) -> Conversation
def add_message(conversation_id, role, text, skill_call) -> ConversationMessage
def get_history(user_id, scope, scope_id, limit) -> list[ConversationMessage]
def search(user_id, query, scope, scope_id, limit)
```

- **`get_or_create`** 가 UniqueConstraint와 짝지어 동작 — 동시성 환경에서 race condition 가능성은 있지만, 사용자별 단일 세션이라 실무적으로 거의 없음.
- **`get_history`**: `ORDER BY at DESC LIMIT 20` 후 `reversed()` — 최신 20개만 가져오되, 표시는 시간순.
- **`search`**: `LIKE %query%` 단순 검색. 향후 FTS5/pg_trgm으로 강화 가능.

### 13.5 `app/repositories/garden_state_repo.py`

```python
def get_or_create(user_id) -> GardenState   # 없으면 생성 + flush
def update(user_id, fields) -> GardenState
```

UniqueConstraint로 사용자당 1행 보장.

### 13.6 `app/repositories/notification_repo.py`

```python
def push(user_id, kind, payload) -> Notification
def list_unread(user_id) -> list[Notification]   # ORDER BY created_at ASC
def ack(user_id, notification_id) -> bool        # acked_at = utcnow()
```

- `list_unread()` 가 ASC 정렬인 이유: UI에서 시간 역순으로 표시할 때 클라이언트가 reverse하기 쉽고, 알림을 모두 ack하면 비어버려 정렬에 신경 쓸 일이 없음.

---

## 14. Services

### 14.1 `app/services/user_service.py`

```python
_pwd_ctx = CryptContext(schemes=["argon2"], deprecated="auto")

def _make_fernet() -> Fernet:
    raw = settings.key_encryption_secret.encode()
    key = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
    return Fernet(key)
```

- **Argon2**: bcrypt 대신 선택 — 메모리 hard 함수로 GPU 공격에 더 강함.
- **Fernet 키 파생**: 사용자가 임의 길이 secret을 줘도 안전한 32바이트로 정규화. 같은 secret이면 항상 같은 key를 만들어 복호화 보장.

```python
class UserService:
    def signup(nickname, password):
        if exists(nickname): raise ValueError("이미 사용 중인 닉네임")
        password_hash = _pwd_ctx.hash(password)
        user = create()
        _garden_repo.get_or_create(user.id)   # GardenState도 동시에
        db.commit()
    def authenticate(nickname, password) -> User | None
    def update_profile(user_id, fields):
        forbidden = {"id", "password_hash", "created_at"}
        safe_fields = {k:v for k,v in fields.items() if k not in forbidden and v is not None}
        ...
    def change_password(user_id, old, new) -> bool
    def delete_account(user_id, confirm_nickname) -> bool   # 닉네임 재입력 확인
    def set_api_key(user_id, api_key):  # Fernet 암호화 후 저장
    def get_api_key(user_id) -> str | None  # 복호화
```

**왜 이렇게**:
- `update_profile` 에서 `id/password_hash/created_at` 을 명시 차단 — PATCH로 비밀번호를 평문으로 덮는 사고 방지.
- `delete_account` 에서 닉네임 재입력 — 의도적인 안전장치.
- `set_api_key` 는 매번 새로 암호화 후 저장 — 키를 알아도 IV 다르면 같은 ciphertext가 안 나오게 (Fernet은 timestamp 포함).

### 14.2 `app/services/plant_service.py`

```python
_ACTIVE_STATUSES = {"seed","bud","flower","fruit","wilting"}

class PlantService:
    def create(user_id, name, description, species, color):
        plant = _repo.create(...); db.commit(); db.refresh(plant); return plant
    def get(user_id, plant_id) -> Plant   # 없으면 ValueError
    def list(user_id, include_dormant=True, sort="activity")
    def update(user_id, plant_id, fields)
    def delete(user_id, plant_id, archive=True):
        if archive: plant.status = "archived"; db.flush()
        else: db.delete(plant)
        db.commit()
    def find_matches(user_id, query, top_k=3) -> list[Plant]:
        # name LIKE %q% OR description LIKE %q%, status != archived
    def increment_harvest(user_id, plant_id)
    def increment_rot(user_id, plant_id)
    def mark_dormant(user_id, plant_id)
    def update_stats(user_id, plant_id, stats_update)
    def refresh_active_bud_count(user_id, plant_id):
        count = db.scalar(SELECT COUNT(*) FROM buds WHERE plant_id=... AND status IN active)
        _repo.update_active_bud_count(...)
```

- **`find_matches`** 는 `match_plant` 스킬이 호출 — LIKE 기반 단순 매칭이지만 한국어 식물명이 대부분 짧고 명확해 효과적.
- **`refresh_active_bud_count`** 는 직접 호출하는 곳은 없지만 향후 캐시 갱신 hook에서 사용할 자리.

### 14.3 `app/services/bud_service.py`

```python
_PROGRESS_TRANSITIONS = [(85,"fruit"), (60,"flower"), (30,"bud")]
_ACTIVE_STATUSES = {"seed","bud","flower","fruit","wilting"}

class BudService:
    def create(user_id, plant_id, title, type, detail, deadline):
        bud = _repo.create(...)
        _repo.add_history(bud.id, "", "seed", "생성")
        db.commit()
    def get(user_id, bud_id) -> Bud
    def list(user_id, plant_id=None, statuses=None, bud_type=None, wilting_only=False, filters=None):
        # filters 는 dict 방식 하위 호환
    def update_status(user_id, bud_id, to_status, reason):
        from_status = bud.status
        bud.status = to_status; bud.last_progress_at = utcnow()
        _repo.add_history(bud_id, from_status, to_status, reason)
        db.commit()
    def update_progress(user_id, bud_id, progress, auto_transition=True, note=""):
        progress = max(0, min(100, progress))
        bud.progress = progress; bud.last_progress_at = utcnow()
        if auto_transition:
            for threshold, status in _PROGRESS_TRANSITIONS:
                if progress >= threshold: target = status; break
            if target != bud.status: add_history(...)
        db.commit()
    def set_deadline(user_id, bud_id, deadline)
    def abandon(user_id, bud_id, reason) -> update_status(to="rot")
    def harvest(user_id, bud_id, note) -> update_status(to="harvested")
    def mark_wilting(user_id, bud_id) -> update_status(to="wilting")
    def get_with_history(user_id, bud_id)
    def purge_disappeared(user_id, older_than_days):
        # rot/harvested 상태로 N일 지난 봉우리에 disappeared_at 채우기
```

**핵심**:
- `_PROGRESS_TRANSITIONS` 가 **내림차순으로 정렬되어 있다** — 첫 매칭이 가장 진행된 상태가 되도록 (85% 이상이면 fruit, 그 아래에서만 flower 등).
- `abandon/harvest/mark_wilting` 은 `update_status` 의 의미 있는 별칭 — 스킬이 명시적이도록.
- `purge_disappeared` 는 향후 dispose 정책에 사용. 현재 호출처 없음.

### 14.4 `app/services/conversation_service.py`

```python
def append(user_id, scope, scope_id, role, text, skill_call=None):
    conv = _repo.get_or_create(...)
    msg = _repo.add_message(conv.id, role, text, skill_call)
    db.commit()
def get_history(user_id, scope, scope_id, limit=20)
def search(user_id, query, scope, scope_id, limit=10)
```

- 매우 얇은 래퍼지만, **서비스 계층을 유지하는 이유**: 향후 메시지에 cross-cutting 로직(예: PII 마스킹, 토큰 카운팅)을 끼워 넣을 자리.

### 14.5 `app/services/garden_state_service.py`

```python
def refresh_summary(user_id) -> dict:
    # SINGLE 쿼리로 5개 SUM(CASE WHEN ...)
    row = db.execute(SELECT
        sum_when(concern & active) AS active_concerns,
        sum_when(schedule & active) AS active_schedules,
        sum_when(harvested & this_month) AS harvested_this_month,
        sum_when(wilting) AS wilting_count,
        sum_when(rot) AS rot_count,
        WHERE user_id=...)
    total_plants = SELECT COUNT(*) FROM plants WHERE user_id AND status != archived
    summary = {...}
    _repo.update(user_id, {"summary_cache": summary})
    db.commit(); return summary

def get_summary(user_id) -> dict   # cached
def compute_stats(user_id, scope, plant_id, period) -> dict
def build_briefing(user_id) -> str:
    summary = refresh_summary(user_id)
    plant_names = ", ".join(p.name for p in plants[:5]) or "없음"
    return f"현재 정원에는 {summary['total_plants']}개의 식물이 있습니다. ..."

def mark_opened(user_id)
def get_daily_briefing(user_id) -> str | None   # 오늘 날짜인 경우만
def set_daily_briefing(user_id, text)
```

**왜 단일 쿼리로 바꿨나**: 이전엔 6개 `SELECT COUNT(*)` 를 따로 보냈음. `SUM(CASE WHEN cond THEN 1 ELSE 0 END)` 으로 묶으면 한 번의 fullscan에서 모든 카운트를 얻음 → 사용자가 봉우리가 많아져도 일정 성능.

### 14.6 `app/services/transition_service.py`

```python
class TransitionService:
    def scan_all(db):
        for user_id in users: scan_user(db, user_id)
    def scan_user(db, user_id):
        rules = user.garden_rules
        wilting_days = rules.get("wilting_days", 7)
        rot_disappear_days = rules.get("rot_disappear_days", 14)
        deadline_warn_days = rules.get("deadline_warn_days", 3)
        if auto_transition:
            # 1) active 봉우리의 last_progress가 N일 이상 정지 → wilting
            # 2) wilting 봉우리가 N일 더 지나면 rot + disappeared_at
        # 3) deadline 임박 봉우리는 deadline_warning 알림
        db.commit()
```

- **사용자별 규칙 적용**: 각자의 `garden_rules`를 그대로 사용 — 같은 시스템에서도 사용자마다 다른 정책.
- **`auto_transition` 플래그**: 사용자가 자동 전이를 꺼두면 wilting/rot 자동 처리 안 함. 단 마감 알림은 항상 발송.

---

## 15. AI 모듈

### 15.1 `app/ai/skill_base.py`

```python
@dataclass
class SkillResult:
    ok: bool; message: str
    data: dict = field(default_factory=dict)
    error_code: str = ""

@dataclass
class SkillContext:
    user_id: str; db: Any
    plant_service, bud_service, garden_state_service, conversation_service = None

class SkillBase(ABC):
    name: str = ""; description: str = ""; parameters: dict = {}
    @abstractmethod
    def run(self, args: dict, ctx: SkillContext) -> SkillResult: ...
    def to_tool_spec(self) -> dict:
        return {"name":..., "description":..., "input_schema":parameters}
```

- 모든 스킬은 이 4가지(name/description/parameters/run)만 정의 — 일관성 강제.
- `to_tool_spec()` 의 출력이 그대로 LLM 카탈로그 항목이 됨.

### 15.2 `app/ai/skill_registry.py`

```python
class SkillRegistry:
    def register(skill)
    def get(name) -> SkillBase | None
    def list() -> list[SkillBase]
    def build_catalog() -> list[dict]    # [skill.to_tool_spec() for ...]
    def dispatch(name, args, ctx) -> SkillResult:
        skill = get(name)
        if skill is None: return SkillResult(ok=False, message="not found", error_code="not_found")
        try: return skill.run(args, ctx)
        except Exception as e: return SkillResult(ok=False, message=str(e), error_code="internal")
```

- **`dispatch` 가 모든 예외를 캐치** — 단일 스킬 실패가 채팅 전체를 죽이지 않도록.
- **`build_catalog`** 매 요청마다 호출되지만 결과는 같음 — 미래 메모이즈 후보지만 현재는 비용이 낮아 그대로.

### 15.3 `app/ai/llm_client.py`

이미 04 문서에서 다룬 변환 어댑터.

추가 결정 사항:
- **`if not self._key: return {"text":"API 키 설정 안내", "tool_use": None}`** — API 키 미설정 사용자에게도 친절한 답.
- **에러 메시지 정제**: Gemini의 raw error code(NOT_FOUND, API_KEY_INVALID, quota) 를 한국어로 변환.

### 15.4 `app/ai/prompt_builder.py`

```python
class PromptBuilder:
    def build_system(ctx, current_screen="홈", stats=None, plants=None) -> str:
        plant_summary = "\n".join(f"  - [{p.id}] {p.name}: {p.description[:40]}" for p in plants[:10])
        today_str = date.today().isoformat()
        return f"""당신은 Plant Counselor의 AI 정원사입니다. ...
오늘 날짜: {today_str}
현재 화면: {current_screen}
## 정원 현황 ...
## 핵심 모델 ...
## 행동 원칙 ...
## 행동 규칙 ...
## 응답 형식 ..."""
```

자세한 디자인 의도는 `04_AI_Chat_And_Skills.md` § 5 참고.

### 15.5 `app/ai/chat_orchestrator.py`

```python
MAX_STEPS = 10

class ChatOrchestrator:
    def run(user_id, text, scope, scope_id, current_screen, db):
        rec = LogRecorder(user_id, text)
        rec.log_event("start", ...)
        plant_svc, bud_svc, gs_svc, conv_svc = services["..."]
        ctx = SkillContext(...)
        stats = gs_svc.get_summary(user_id); plants = plant_svc.list(user_id)
        system = builder.build_system(ctx, current_screen, stats, plants)
        rec.set_system(system)
        history = [...]   # 최근 20개 + 새 user 메시지
        conv_svc.append(user_id, scope, scope_id, "user", text)
        yield "event: start"
        working_history = list(history)
        for step in range(MAX_STEPS):
            result = llm.chat(working_history, catalog, system)
            text_, tool_use = result["text"], result["tool_use"]
            if not text_ and not tool_use:
                result = llm.chat(...)   # 1회 재시도
                ...
            if tool_use:
                yield "event: tool_call"
                skill_result = registry.dispatch(tool_use["name"], tool_use["input"], ctx)
                rec.log_skill(...)
                yield "event: tool_result"
                working_history += [{"role":"assistant","content":[{"type":"tool_use",...}]},
                                    {"role":"user","content":[{"type":"tool_result",...}]}]
                continue
            break
        if not response_text:
            result = llm.chat(working_history, [], system)
            response_text = result.get("text") or "작업을 완료했습니다."
        rec.set_final(response_text)
        for word in response_text.split():
            yield f"event: token data: {{...}}"
        if conv_svc and response_text:
            conv_svc.append(..., role="assistant", text=response_text, skill_call=last_tool_use)
        rec.log_event("done"); rec.save()
        yield "event: done"
```

**왜 sync generator?** FastAPI의 `StreamingResponse` 는 sync/async 둘 다 받음. SQLAlchemy 동기 세션과 동기 LLM SDK를 그대로 쓸 수 있어 간결.

**왜 `tool_use_id = name`?** Gemini는 function_call에 별도 ID를 안 줘서, name으로 페어링하는 우회. 같은 스킬을 한 라운드에 두 번 호출하지 않는 한 안전. 두 번 호출은 ReAct 루프 특성상 거의 없음(매 라운드에 1개 tool만).

### 15.6 `app/ai/log_recorder.py`

```python
LOG_DIR = .../backend/logs/chat

class LogRecorder:
    def __init__(user_id, text):
        filename = f"{ts}_{user_id[:8]}.json"
    def set_system(prompt)
    def set_history(history)
    def log_llm_call(call_n, messages, tools_count)
    def log_llm_result(call_n, text, tool_use)   # 위 call_n의 결과로 채움
    def log_skill(name, args, ok, message, data)
    def log_event(event_type, detail)
    def set_final(response_text)
    def save():
        json.dump(self._data, f, ensure_ascii=False, indent=2, default=str)
```

- **`default=str`**: datetime이나 ULID 객체를 자동으로 문자열화 — try/except 노이즈 제거.
- **모든 LLM 호출의 전체 messages를 보존** — 디버깅에 가장 큰 자산.

### 15.7 `app/ai/skills/*.py`

15개 스킬 각각의 코드는 매우 짧으므로 한 표에 요약:

| 파일 | 역할 한 줄 | 호출 패턴 |
|------|------------|-----------|
| `think.py` | `{ok=True, message="사고 완료", data={"reasoning": args["reasoning"]}}` 만 반환. DB 변경 없음. | LLM이 멀티스텝 계획을 명시화할 때 호출. |
| `match_plant.py` | `PlantService.find_matches(query)` | 새 식물 생성 전 중복 방지. |
| `create_plant.py` | `PlantService.create(name, description, species, color)` | 새 분야. |
| `delete_plant.py` | `PlantService.delete(archive=...)` | 명시적 삭제 의사 확인 시. |
| `create_bud.py` | `BudService.create(plant_id, title, type, detail, deadline)` | 봉우리 추가. deadline은 ISO 파싱 시도, 실패 시 None. |
| `update_bud_status.py` | `BudService.update_status(bud_id, to_status, reason)` | 직접 상태 강제. |
| `update_bud_progress.py` | `BudService.update_progress(bud_id, progress)` | 진행률 + 자동 전이. |
| `set_deadline.py` | `BudService.set_deadline(bud_id, date.fromisoformat)` | ISO 파싱 실패 시 `ok=False, error_code="invalid_argument"`. |
| `abandon_bud.py` | `BudService.abandon(bud_id, reason)` | 명확한 포기 의사 시. |
| `harvest_bud.py` | `BudService.harvest(bud_id, note)` | 완료. |
| `list_plants.py` | `PlantService.list(include_dormant, sort)` | 답을 위한 컨텍스트 수집. |
| `list_buds.py` | `BudService.list(plant_id, statuses, bud_type)` | 같은 용도. |
| `get_statistics.py` | `GardenStateService.compute_stats(scope, plant_id, period)` | "이번 달 진행 어땠어?" 류. |
| `get_garden_briefing.py` | `GardenStateService.build_briefing()` | 일일 브리핑. |
| `search_conversation.py` | `ConversationService.search(query, scope, scope_id, limit)` | 과거 대화 회상. |

각 스킬의 description은 **단순 설명이 아니라 LLM에 대한 가이드**입니다. 예:
- `create_plant.description` — "match_plant로 중복 여부를 먼저 확인하세요" 라는 protocol 강제.
- `abandon_bud.description` — "사용자가 그만두겠다고 명확히 밝혔을 때 호출하세요" — 모호한 부정에 잘못 작동하지 않게.

---

## 16. Routers

### 16.1 `app/main.py`

```python
@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(bind=engine)
    sched = setup_scheduler()
    yield
    sched.shutdown()

app = FastAPI(title="Plant Counselor API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[settings.cors_allow_origin], ...)

PREFIX = "/api/v1"
for r in [auth, me, plants, buds, stats, chat, conversations, notifications]:
    app.include_router(r.router, prefix=PREFIX)

@app.get("/health")
def health(): return {"status":"ok"}
```

- **`Base.metadata.create_all`**: 개발 편의 — Alembic 없이도 시작. prod에선 Alembic 마이그레이션 사용.
- **`lifespan`**: 스케줄러를 시작/종료 hook과 일관되게.
- **`/health`**: 인프라 헬스체크용 — JWT 없이 200.

### 16.2 `app/routers/auth.py`

- `/auth/signup`: 닉네임 중복 시 409.
- `/auth/login`: access는 응답, refresh는 HTTP-only 쿠키. `samesite=lax` 로 CSRF 완화.
- `/auth/refresh`: 쿠키만으로 새 access. refresh 자체는 갱신 안 함(rolling refresh 아님).
- `/auth/logout`: 쿠키 삭제만. 토큰 블랙리스트는 안 둠 (15분 짧은 TTL로 보안 보강).

### 16.3 `app/routers/me.py`

- `GET /me` — 현재 사용자 프로필.
- `PATCH /me` — UserUpdate 스키마로 안전 필드만.
- `POST /me/password` — 기존 비밀번호 검증 후 변경.
- `DELETE /me` — body의 confirm_nickname 검증.
- `PUT /me/api-key` — Fernet 암호화 저장.

### 16.4 `app/routers/plants.py`

```python
@router.get("")        # list
@router.get("/{id}")   # detail
@router.patch("/{id}") # partial update
@router.delete("/{id}?hard=bool")  # archive 또는 hard delete
```

- 모든 응답이 `{ok:true, data:...}` 형태 — 프론트 fetch 래퍼와 통일.

### 16.5 `app/routers/buds.py`

```python
@router.get("")           # 필터: plant_id, wilting_only
@router.get("/{id}")      # bud + history
@router.patch("/{id}")    # title/detail만 직접 수정 (BudPatch)
```

- 상태 변경은 채팅 스킬을 통해서만 — 사용자가 실수로 데이터를 일관성 깨뜨리지 못하게 의도적 제약.

### 16.6 `app/routers/stats.py`

```python
GET /stats/summary    -> refresh_summary 실시간 계산
GET /briefing/today   -> daily_briefing 캐시 (날짜 바뀌면 재생성)
GET /calendar?from=&to=
    -> from/to ISO 검증, 최대 366일, 봉우리 deadline 기준 events 그룹화
```

### 16.7 `app/routers/conversations.py`

```python
GET /conversations?scope=&scope_id=&limit=
POST /conversations/search   { query, scope, scope_id, limit }
```

### 16.8 `app/routers/notifications.py`

```python
GET /notifications              -> 안 읽은 알림 ASC
POST /notifications/{id}/ack    -> acked_at 채움
```

### 16.9 `app/routers/chat.py`

```python
_REGISTRY = build_registry()    # 모듈 로드 시 1회
_PROMPT_BUILDER = PromptBuilder()

def _resolve_api_key(db, user):
    key = UserService(db).get_api_key(user.id)
    return key or settings.llm_api_key

@router.post("/chat/message")
def chat_message(req, user, db):
    api_key = _resolve_api_key(db, user)
    llm = LLMClient(api_key)
    services = {plant: PlantService(db), bud: BudService(db), garden_state: GardenStateService(db), conversation: ConversationService(db)}
    orchestrator = ChatOrchestrator(llm, _REGISTRY, _PROMPT_BUILDER, services)
    return StreamingResponse(generate(), media_type="text/event-stream",
                              headers={"Cache-Control":"no-cache", "X-Accel-Buffering":"no"})
```

- **registry/prompt_builder는 모듈 캐시**: stateless라 안전.
- **services/llm은 매 요청**: DB 세션과 사용자 API 키가 매번 다르므로 캐시 불가.
- **`X-Accel-Buffering: no`**: nginx 등 reverse proxy가 SSE를 버퍼링하지 않도록.

## 17. `app/scheduler/jobs.py`

```python
scheduler = BackgroundScheduler()

def setup_scheduler():
    @scheduler.scheduled_job("interval", minutes=10, id="transition_scan")
    def transition_scan():
        with SessionLocal() as db:
            TransitionService(db).scan_all(db)
    scheduler.start()
    return scheduler
```

- **`with SessionLocal() as db`**: 작업이 끝나면 자동 close — 누수 방지.
- **`id="transition_scan"`**: 같은 ID로 등록 시도가 있어도 중복되지 않도록.
- **10분 간격**: 알림이 너무 잦지 않으면서, 사용자가 늦지 않게 알 수 있는 균형.

---

## 18. `app/schemas/*` (Pydantic)

### `schemas/user.py`
- `UserCreate(nickname, password)`, `UserLogin`, `UserOut`(with `from_attributes=True` for ORM), `UserUpdate`(optional fields), `PasswordChange`, `ApiKeySet`, `TokenResponse`.
- 모든 입력 모델에 별도 검증자 미정의 — 사용자 메시지가 한국어/짧기 때문에 길이 제약을 너무 빡빡하게 두면 UX 저하.

### `schemas/plant.py`
- `PlantOut(model_config=ConfigDict(from_attributes=True))` — ORM에서 직접 변환.
- `PlantUpdate` — PATCH용 optional 필드 4개.
- `PlantListResponse` — 향후 페이지네이션 cursor 자리.

### `schemas/bud.py`
- `BudOut`, `BudHistoryOut`, `BudWithHistory`, `BudPatch(title?, detail?)`, `BudListResponse`.
- `BudPatch` 가 `status`/`progress`/`deadline` 을 받지 않는 이유: 그것들은 채팅을 통해서만 변경되어야 (skill의 책임).

### `schemas/conversation.py`
- `ConversationMessageOut`, `ConversationHistory`, `ChatRequest(text, scope="global", scope_id?, current_screen="홈")`.
- `current_screen` 이 기본값 "홈" 인 이유: 프론트가 누락해도 기본 컨텍스트로 동작.

### `schemas/common.py`
- `ApiSuccess`, `ApiError` — 응답 envelope 표준.
- (이전엔 `SummaryStats` 도 있었으나 미사용으로 제거).

---

## 19. Alembic

- `alembic.ini`, `alembic/env.py` — 표준 구조.
- `alembic/env.py` 가 `from app.db.models import *` 로 모든 모델을 import해 `target_metadata = Base.metadata` 가 완전하게 잡힘.
- 새 컬럼 추가 시: `alembic revision --autogenerate -m "msg"` → `alembic upgrade head`.

## 20. `backend/run.py`

```python
import uvicorn
if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
```

- 한 줄 진입점. prod에선 `uvicorn app.main:app --workers 4` 같이 직접 실행 권장.

---

## 21. 결정 요약 표

| 결정 | 대안 | 채택 이유 |
|------|------|-----------|
| ULID id | UUID4 / auto-increment | 정렬 가능 + URL safe + 디버깅 친화 |
| Argon2 | bcrypt | GPU 공격에 더 안전 |
| Fernet + SHA-256 파생 | 별도 KMS | 단일 배포 환경에서 충분, 키 회전 가능 |
| HS256 JWT | RS256 / Paseto | 단일 백엔드, 비용 균형 |
| HTTP-only refresh 쿠키 | localStorage | XSS 노출 차단 |
| SQLAlchemy 2.x Mapped | 1.x style | 타입 힌트 친화, modern |
| ReAct 루프 자체 구현 | LangChain / Anthropic agent | 외부 의존 최소화, Gemini SDK와 직접 매핑 |
| Anthropic 형식 IR | Gemini 직접 형식 | 향후 멀티-LLM 어댑터 용이 |
| sync generator SSE | async/EventSource | 동기 SDK·세션과 자연스러움 |
| ChatPanel zustand | Context API | 페이지 외부에서 트리거 가능 (CustomEvent + store) |
| TanStack Query | 직접 useEffect | 캐시·invalidate·staleTime 통합 관리 |
| Tailwind v4 + CSS variables | CSS-in-JS | 빌드 산출물 작고 토큰 재사용 쉬움 |
