from __future__ import annotations
# 모든 모델을 여기서 import하여 Alembic autogenerate가 감지할 수 있도록 합니다.
from app.db.models.user import User  # noqa: F401
from app.db.models.garden_state import GardenState  # noqa: F401
from app.db.models.plant import Plant  # noqa: F401
from app.db.models.bud import Bud, BudHistory  # noqa: F401
from app.db.models.conversation import Conversation, ConversationMessage  # noqa: F401
from app.db.models.notification import Notification  # noqa: F401

