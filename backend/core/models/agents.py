from sqlalchemy import Column, DateTime, Index, Integer, String, Text

from core.database import Base


class CockpitAgentCommand(Base):
    """Audit log for Cockpit Agent commands"""

    __tablename__ = "cockpit_agent_commands"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(String(255), nullable=False, index=True)
    command_id = Column(String(36), nullable=False, unique=True)
    command = Column(String(50), nullable=False)
    params = Column(Text)  # JSON string
    status = Column(String(20))  # pending, success, error, timeout
    output = Column(Text)
    error = Column(Text)
    execution_time_ms = Column(Integer)
    sent_at = Column(DateTime(timezone=True), nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True))
    sent_by = Column(String(255))  # username

    __table_args__ = (
        Index("idx_cockpit_agent_command_agent", "agent_id"),
        Index("idx_cockpit_agent_command_sent_at", "sent_at"),
        Index("idx_cockpit_agent_command_status", "status"),
    )
