"""Service for CheckMK priority rules."""

from __future__ import annotations

import logging
from typing import List

from fastapi import HTTPException, status

from core.models.settings import CheckMKPriorityRule
from models.checkmk_priority import (
    CheckMKPriorityRuleCreate,
    CheckMKPriorityRulesReorderRequest,
    CheckMKPriorityRuleUpdate,
)
from repositories.checkmk.priority_rules_repository import (
    CheckMKPriorityRuleRepository,
)

logger = logging.getLogger(__name__)


class CheckMKPriorityRulesService:
    def __init__(self) -> None:
        self._repo = CheckMKPriorityRuleRepository()

    def get_all(self) -> List[CheckMKPriorityRule]:
        return self._repo.get_all_ordered()

    def create(self, data: CheckMKPriorityRuleCreate) -> CheckMKPriorityRule:
        priority_order = (
            data.priority_order
            if data.priority_order is not None
            else self._repo.get_next_priority_order()
        )
        expression_json = [item.model_dump() for item in data.expression]
        return self._repo.create(
            priority_order=priority_order,
            filename=data.filename,
            expression=expression_json,
        )

    def update(
        self, rule_id: int, data: CheckMKPriorityRuleUpdate
    ) -> CheckMKPriorityRule:
        rule = self._repo.get_by_id(rule_id)
        if rule is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Priority rule {rule_id} not found",
            )
        kwargs: dict = {}
        if data.priority_order is not None:
            kwargs["priority_order"] = data.priority_order
        if data.filename is not None:
            kwargs["filename"] = data.filename
        if data.expression is not None:
            kwargs["expression"] = [item.model_dump() for item in data.expression]
        if not kwargs:
            return rule
        updated = self._repo.update(rule_id, **kwargs)
        return updated

    def delete(self, rule_id: int) -> None:
        deleted = self._repo.delete(rule_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Priority rule {rule_id} not found",
            )

    def reorder(self, request: CheckMKPriorityRulesReorderRequest) -> None:
        existing_ids = {r.id for r in self._repo.get_all_ordered()}
        for rule_id in request.rule_ids:
            if rule_id not in existing_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Rule id {rule_id} not found",
                )
        self._repo.reorder(request.rule_ids)
