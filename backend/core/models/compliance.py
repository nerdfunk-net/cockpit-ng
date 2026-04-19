from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class ComplianceRule(Base):
    __tablename__ = "compliance_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    description = Column(Text)
    rule_type = Column(String(100), nullable=False)
    pattern = Column(Text, nullable=False)
    severity = Column(String(50), nullable=False, default="medium")
    is_active = Column(Boolean, nullable=False, default=True)
    tags = Column(Text)  # JSON string
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    checks = relationship(
        "ComplianceCheck", back_populates="rule", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_compliance_rules_type", "rule_type"),
        Index("idx_compliance_rules_active", "is_active"),
    )


class ComplianceCheck(Base):
    __tablename__ = "compliance_checks"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(
        Integer, ForeignKey("compliance_rules.id", ondelete="CASCADE"), nullable=False
    )
    device_name = Column(String(255), nullable=False)
    config_file = Column(String(1000))
    status = Column(String(50), nullable=False)
    message = Column(Text)
    checked_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    rule = relationship("ComplianceRule", back_populates="checks")

    __table_args__ = (
        Index("idx_compliance_checks_rule", "rule_id"),
        Index("idx_compliance_checks_device", "device_name"),
        Index("idx_compliance_checks_status", "status"),
    )


class RegexPattern(Base):
    __tablename__ = "regex_patterns"

    id = Column(Integer, primary_key=True, index=True)
    pattern = Column(Text, nullable=False)
    description = Column(Text)
    pattern_type = Column(
        String(50), nullable=False
    )  # 'must_match' or 'must_not_match'
    is_active = Column(Boolean, nullable=False, default=True)
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
        Index("idx_regex_patterns_type", "pattern_type"),
        Index("idx_regex_patterns_active", "is_active"),
    )
