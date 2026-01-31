"""
Repository for Grafana Agent command history
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from core.models import CockpitAgentCommand


class CockpitAgentRepository:
    """Repository for Grafana Agent command operations"""

    def __init__(self, db: Session):
        self.db = db

    def save_command(
        self,
        agent_id: str,
        command_id: str,
        command: str,
        params: str,
        sent_by: str,
    ) -> CockpitAgentCommand:
        """
        Save a new command to the database
        """
        command_record = CockpitAgentCommand(
            agent_id=agent_id,
            command_id=command_id,
            command=command,
            params=params,
            status="pending",
            sent_at=datetime.utcnow(),
            sent_by=sent_by,
        )

        self.db.add(command_record)
        self.db.commit()
        self.db.refresh(command_record)

        return command_record

    def update_command_result(
        self,
        command_id: str,
        status: str,
        output: Optional[str] = None,
        error: Optional[str] = None,
        execution_time_ms: Optional[int] = None,
    ) -> Optional[CockpitAgentCommand]:
        """
        Update command with execution result
        """
        command_record = (
            self.db.query(CockpitAgentCommand)
            .filter(CockpitAgentCommand.command_id == command_id)
            .first()
        )

        if not command_record:
            return None

        command_record.status = status
        command_record.output = output
        command_record.error = error
        command_record.execution_time_ms = execution_time_ms
        command_record.completed_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(command_record)

        return command_record

    def get_command_by_id(self, command_id: str) -> Optional[CockpitAgentCommand]:
        """Get command by command_id"""
        return (
            self.db.query(CockpitAgentCommand)
            .filter(CockpitAgentCommand.command_id == command_id)
            .first()
        )

    def get_command_history(
        self, agent_id: str, limit: int = 50
    ) -> List[CockpitAgentCommand]:
        """
        Get command history for an agent
        Returns most recent commands first
        """
        return (
            self.db.query(CockpitAgentCommand)
            .filter(CockpitAgentCommand.agent_id == agent_id)
            .order_by(desc(CockpitAgentCommand.sent_at))
            .limit(limit)
            .all()
        )

    def get_all_command_history(self, limit: int = 100) -> List[CockpitAgentCommand]:
        """
        Get command history for all agents
        Returns most recent commands first
        """
        return (
            self.db.query(CockpitAgentCommand)
            .order_by(desc(CockpitAgentCommand.sent_at))
            .limit(limit)
            .all()
        )

    def count_commands(self, agent_id: Optional[str] = None) -> int:
        """Count total commands, optionally filtered by agent_id"""
        query = self.db.query(CockpitAgentCommand)

        if agent_id:
            query = query.filter(CockpitAgentCommand.agent_id == agent_id)

        return query.count()
