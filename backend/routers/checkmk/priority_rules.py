"""CheckMK priority rules router."""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from core.auth import require_permission
from core.safe_http_errors import raise_internal_server_error
from models.checkmk_priority import (
    CheckMKPriorityRuleCreate,
    CheckMKPriorityRuleResponse,
    CheckMKPriorityRulesReorderRequest,
    CheckMKPriorityRuleUpdate,
)
from services.checkmk.priority_rules_service import CheckMKPriorityRulesService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["checkmk"])


def _get_service() -> CheckMKPriorityRulesService:
    return CheckMKPriorityRulesService()


@router.get(
    "/priority-rules",
    response_model=List[CheckMKPriorityRuleResponse],
)
async def list_priority_rules(
    current_user: dict = Depends(require_permission("settings.defaults", "read")),
    service: CheckMKPriorityRulesService = Depends(_get_service),
):
    """List all CheckMK priority rules ordered by priority."""
    try:
        return service.get_all()
    except Exception as e:
        raise_internal_server_error(logger, "Failed to list priority rules", e)


@router.post(
    "/priority-rules",
    response_model=CheckMKPriorityRuleResponse,
    status_code=201,
)
async def create_priority_rule(
    request: CheckMKPriorityRuleCreate,
    current_user: dict = Depends(require_permission("settings.defaults", "write")),
    service: CheckMKPriorityRulesService = Depends(_get_service),
):
    """Create a new CheckMK priority rule."""
    try:
        return service.create(request)
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to create priority rule", e)


# Static path before parameterised path to avoid routing conflicts
@router.put(
    "/priority-rules/reorder",
    response_model=List[CheckMKPriorityRuleResponse],
)
async def reorder_priority_rules(
    request: CheckMKPriorityRulesReorderRequest,
    current_user: dict = Depends(require_permission("settings.defaults", "write")),
    service: CheckMKPriorityRulesService = Depends(_get_service),
):
    """Reorder priority rules by providing a list of ids in the desired order."""
    try:
        service.reorder(request)
        return service.get_all()
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to reorder priority rules", e)


@router.put(
    "/priority-rules/{rule_id}",
    response_model=CheckMKPriorityRuleResponse,
)
async def update_priority_rule(
    rule_id: int,
    request: CheckMKPriorityRuleUpdate,
    current_user: dict = Depends(require_permission("settings.defaults", "write")),
    service: CheckMKPriorityRulesService = Depends(_get_service),
):
    """Update a CheckMK priority rule."""
    try:
        return service.update(rule_id, request)
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(
            logger, f"Failed to update priority rule {rule_id}", e
        )


@router.delete("/priority-rules/{rule_id}", status_code=204)
async def delete_priority_rule(
    rule_id: int,
    current_user: dict = Depends(require_permission("settings.defaults", "write")),
    service: CheckMKPriorityRulesService = Depends(_get_service),
):
    """Delete a CheckMK priority rule."""
    try:
        service.delete(rule_id)
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(
            logger, f"Failed to delete priority rule {rule_id}", e
        )
