from __future__ import annotations
# Import all models so SQLAlchemy metadata is populated.
# Tables are created via Supabase migrations (not Base.metadata.create_all).
from app.db.models.user import User  # noqa: F401
from app.db.models.garden_state import GardenState  # noqa: F401
from app.db.models.plant import Plant  # noqa: F401
from app.db.models.bud import Bud, BudHistory  # noqa: F401
from app.db.models.conversation import Conversation, ConversationMessage  # noqa: F401
from app.db.models.notification import Notification  # noqa: F401
