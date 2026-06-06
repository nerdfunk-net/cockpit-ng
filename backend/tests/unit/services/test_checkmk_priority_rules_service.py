"""Unit tests for services/checkmk/priority_rules_service.py."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from models.checkmk_priority import (
    CheckMKPriorityRuleCreate,
    CheckMKPriorityRulesReorderRequest,
    CheckMKPriorityRuleUpdate,
    ExpressionCondition,
    ExpressionConnector,
)
from services.checkmk.priority_rules_service import CheckMKPriorityRulesService

_PATCH_REPO = "services.checkmk.priority_rules_service.CheckMKPriorityRuleRepository"


def _expression() -> list:
    return [
        ExpressionCondition(key="role", value="router"),
        ExpressionConnector(operator="and"),
        ExpressionCondition(key="status", value="active"),
    ]


def _rule(**kwargs: object) -> SimpleNamespace:
    defaults: dict = {
        "id": 1,
        "priority_order": 0,
        "filename": "rule.yaml",
        "expression": [{"type": "condition", "key": "role", "value": "router"}],
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _service(mock_repo: MagicMock) -> CheckMKPriorityRulesService:
    with patch(_PATCH_REPO, return_value=mock_repo):
        return CheckMKPriorityRulesService()


@pytest.mark.unit
def test_get_all_returns_ordered_rules() -> None:
    mock_repo = MagicMock()
    mock_repo.get_all_ordered.return_value = [_rule(id=1), _rule(id=2)]
    svc = _service(mock_repo)

    rules = svc.get_all()

    assert len(rules) == 2
    mock_repo.get_all_ordered.assert_called_once()


@pytest.mark.unit
def test_create_uses_explicit_priority_order() -> None:
    mock_repo = MagicMock()
    mock_repo.create.return_value = _rule(priority_order=5)
    svc = _service(mock_repo)
    data = CheckMKPriorityRuleCreate(
        priority_order=5,
        filename="high.yaml",
        expression=_expression(),
    )

    rule = svc.create(data)

    assert rule.priority_order == 5
    mock_repo.create.assert_called_once()
    mock_repo.get_next_priority_order.assert_not_called()


@pytest.mark.unit
def test_create_assigns_next_order_when_omitted() -> None:
    mock_repo = MagicMock()
    mock_repo.get_next_priority_order.return_value = 3
    mock_repo.create.return_value = _rule(priority_order=3)
    svc = _service(mock_repo)
    data = CheckMKPriorityRuleCreate.model_construct(
        priority_order=None,
        filename="auto.yaml",
        expression=_expression(),
    )

    svc.create(data)

    mock_repo.get_next_priority_order.assert_called_once()
    mock_repo.create.assert_called_once()
    assert mock_repo.create.call_args.kwargs["priority_order"] == 3


@pytest.mark.unit
def test_update_returns_rule_when_no_fields() -> None:
    existing = _rule()
    mock_repo = MagicMock()
    mock_repo.get_by_id.return_value = existing
    svc = _service(mock_repo)
    data = CheckMKPriorityRuleUpdate()

    result = svc.update(1, data)

    assert result is existing
    mock_repo.update.assert_not_called()


@pytest.mark.unit
def test_update_raises_404_when_missing() -> None:
    mock_repo = MagicMock()
    mock_repo.get_by_id.return_value = None
    svc = _service(mock_repo)

    with pytest.raises(HTTPException) as exc:
        svc.update(99, CheckMKPriorityRuleUpdate(filename="x.yaml"))

    assert exc.value.status_code == 404


@pytest.mark.unit
def test_update_persists_changes() -> None:
    existing = _rule()
    updated = _rule(filename="updated.yaml")
    mock_repo = MagicMock()
    mock_repo.get_by_id.return_value = existing
    mock_repo.update.return_value = updated
    svc = _service(mock_repo)
    data = CheckMKPriorityRuleUpdate(filename="updated.yaml")

    result = svc.update(1, data)

    assert result.filename == "updated.yaml"
    mock_repo.update.assert_called_once_with(1, filename="updated.yaml")


@pytest.mark.unit
def test_delete_raises_404_when_not_found() -> None:
    mock_repo = MagicMock()
    mock_repo.delete.return_value = False
    svc = _service(mock_repo)

    with pytest.raises(HTTPException) as exc:
        svc.delete(7)

    assert exc.value.status_code == 404


@pytest.mark.unit
def test_delete_removes_rule() -> None:
    mock_repo = MagicMock()
    mock_repo.delete.return_value = True
    svc = _service(mock_repo)

    svc.delete(1)

    mock_repo.delete.assert_called_once_with(1)


@pytest.mark.unit
def test_reorder_validates_ids() -> None:
    mock_repo = MagicMock()
    mock_repo.get_all_ordered.return_value = [_rule(id=1), _rule(id=2)]
    svc = _service(mock_repo)

    with pytest.raises(HTTPException) as exc:
        svc.reorder(CheckMKPriorityRulesReorderRequest(rule_ids=[1, 99]))

    assert exc.value.status_code == 400
    mock_repo.reorder.assert_not_called()


@pytest.mark.unit
def test_reorder_applies_order() -> None:
    mock_repo = MagicMock()
    mock_repo.get_all_ordered.return_value = [_rule(id=1), _rule(id=2)]
    svc = _service(mock_repo)

    svc.reorder(CheckMKPriorityRulesReorderRequest(rule_ids=[2, 1]))

    mock_repo.reorder.assert_called_once_with([2, 1])
