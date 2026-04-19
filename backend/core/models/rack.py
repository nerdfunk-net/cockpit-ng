from sqlalchemy import Column, DateTime, Index, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from core.database import Base


class RackDeviceMapping(Base):
    """Persists CSV-to-Nautobot device name mappings per rack and location.

    When a CSV import produces unresolved device names, users manually map
    them to Nautobot devices. This table remembers those corrections so future
    imports can auto-resolve the same names without user interaction.
    """

    __tablename__ = "rack_device_mappings"

    id = Column(Integer, primary_key=True, index=True)
    rack_name = Column(String(255), nullable=False)
    location_id = Column(String(255), nullable=False)  # Nautobot location UUID
    origin_name = Column(String(255), nullable=False)  # CSV device name as-is
    mapped_name = Column(String(255), nullable=False)  # Nautobot device name
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
        UniqueConstraint(
            "rack_name", "location_id", "origin_name", name="uq_rack_device_mapping"
        ),
        Index("idx_rack_device_mapping_lookup", "rack_name", "location_id"),
    )
