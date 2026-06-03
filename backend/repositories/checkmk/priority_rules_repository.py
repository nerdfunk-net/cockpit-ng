"""Repository for CheckMK priority rules."""

from __future__ import annotations

import logging
from typing import List, Optional

from sqlalchemy.orm import Session

from core.database import db_transaction
from core.models.settings import CheckMKPriorityRule
from repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class CheckMKPriorityRuleRepository(BaseRepository[CheckMKPriorityRule]):
    def __init__(self) -> None:
        super().__init__(CheckMKPriorityRule)

    def get_all_ordered(
        self, db: Optional[Session] = None
    ) -> List[CheckMKPriorityRule]:
        """Return all rules sorted by priority_order ascending."""
        with self._db_session(db) as s:
            return (
                s.query(CheckMKPriorityRule)
                .order_by(CheckMKPriorityRule.priority_order)
                .all()
            )

    def get_next_priority_order(self, db: Optional[Session] = None) -> int:
        """Return one higher than the current maximum priority_order (or 1 if empty)."""
        with self._db_session(db) as s:
            from sqlalchemy import func as sqlfunc

            result = s.query(sqlfunc.max(CheckMKPriorityRule.priority_order)).scalar()
            return (result or 0) + 1

    def reorder(self, rule_ids: List[int]) -> None:
        """Assign priority_order 1..N to rules in the given id order."""
        with db_transaction() as db:
            for position, rule_id in enumerate(rule_ids, start=1):
                rule = (
                    db.query(CheckMKPriorityRule)
                    .filter(CheckMKPriorityRule.id == rule_id)
                    .first()
                )
                if rule:
                    rule.priority_order = position
