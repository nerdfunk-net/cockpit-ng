from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from core.database import Base


class UserFieldMapping(Base):
    """Persists a user's CSV/agent-field-to-target-field mapping per app.

    Lets tools like the Nautobot Live Update wizard skip the manual mapping
    step once a user has configured and saved it, keyed by (username, app_name)
    so any tool can adopt this same reusable storage.
    """

    __tablename__ = "user_field_mappings"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), nullable=False, index=True)
    app_name = Column(String(255), nullable=False, index=True)
    mapping = Column(JSONB, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("username", "app_name", name="uq_user_field_mapping"),
    )
