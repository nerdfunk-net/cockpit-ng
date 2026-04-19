from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class NB2CMKSync(Base):
    __tablename__ = "nb2cmk_sync"

    id = Column(Integer, primary_key=True, index=True)
    sync_type = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False, default="pending")
    message = Column(Text)
    devices_processed = Column(Integer, default=0)
    devices_succeeded = Column(Integer, default=0)
    devices_failed = Column(Integer, default=0)
    started_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at = Column(DateTime(timezone=True))

    __table_args__ = (
        Index("idx_nb2cmk_sync_status", "status"),
        Index("idx_nb2cmk_sync_type", "sync_type"),
    )


class NB2CMKJob(Base):
    """NB2CMK background job tracking."""

    __tablename__ = "nb2cmk_jobs"

    job_id = Column(String(255), primary_key=True)
    status = Column(
        String(50), nullable=False
    )  # pending, running, completed, failed, cancelled
    created_at = Column(DateTime(timezone=True), nullable=False)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    total_devices = Column(Integer, default=0, nullable=False)
    processed_devices = Column(Integer, default=0, nullable=False)
    progress_message = Column(Text, default="")
    user_id = Column(String(255))
    error_message = Column(Text)

    # Relationship to job results
    results = relationship(
        "NB2CMKJobResult", back_populates="job", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_nb2cmk_jobs_created_at", "created_at"),
        Index("idx_nb2cmk_jobs_status", "status"),
    )


class NB2CMKJobResult(Base):
    """Individual device comparison result within a NB2CMK job."""

    __tablename__ = "nb2cmk_job_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(
        String(255),
        ForeignKey("nb2cmk_jobs.job_id", ondelete="CASCADE"),
        nullable=False,
    )
    device_id = Column(String(255), nullable=False)
    device_name = Column(String(255), nullable=False)
    checkmk_status = Column(String(50), nullable=False)  # equal, diff, missing, error
    diff = Column(Text)
    normalized_config = Column(Text)  # JSON
    checkmk_config = Column(Text)  # JSON
    ignored_attributes = Column(Text)  # JSON array of ignored attribute names
    processed_at = Column(DateTime(timezone=True), nullable=False)

    # Relationship to job
    job = relationship("NB2CMKJob", back_populates="results")

    __table_args__ = (
        Index("idx_nb2cmk_job_results_job_id", "job_id"),
        Index("idx_nb2cmk_job_results_device_id", "device_id"),
    )
