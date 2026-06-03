"""Unit tests for services/checkmk/priority_rule_evaluator.py."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from services.checkmk.priority_rule_evaluator import PriorityRuleEvaluator

_PATCH_REPO = "services.checkmk.priority_rule_evaluator.CheckMKPriorityRuleRepository"

_DEVICE = {
    "name": "router1",
    "role": {"name": "Router"},
    "status": {"name": "active"},
    "location": {"name": "DC1"},
    "platform": {"name": "ios"},
    "device_type": {
        "model": "ISR4331",
        "manufacturer": {"name": "Cisco"},
    },
    "primary_ip4": {"address": "10.0.0.5/24"},
    "tags": [{"name": "production"}],
    "_custom_field_data": {"site_code": "east"},
}


def _rule(
    rule_id: int,
    filename: str,
    expression: list,
    priority_order: int = 0,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=rule_id,
        filename=filename,
        expression=expression,
        priority_order=priority_order,
    )


def _evaluator(mock_repo: MagicMock) -> PriorityRuleEvaluator:
    with patch(_PATCH_REPO, return_value=mock_repo):
        return PriorityRuleEvaluator()


@pytest.mark.unit
def test_find_matching_rule_returns_first_match() -> None:
    mock_repo = MagicMock()
    mock_repo.get_all_ordered.return_value = [
        _rule(
            1,
            "low.yaml",
            [{"type": "condition", "key": "role", "value": "Other"}],
            priority_order=1,
        ),
        _rule(
            2,
            "high.yaml",
            [{"type": "condition", "key": "role", "value": "Router"}],
            priority_order=0,
        ),
    ]
    evaluator = _evaluator(mock_repo)

    matched = evaluator.find_matching_rule(_DEVICE)

    assert matched is not None
    assert matched.id == 2
    assert matched.filename == "high.yaml"


@pytest.mark.unit
def test_find_matching_rule_returns_none_when_no_match() -> None:
    mock_repo = MagicMock()
    mock_repo.get_all_ordered.return_value = [
        _rule(1, "none.yaml", [{"type": "condition", "key": "role", "value": "Switch"}]),
    ]

    assert _evaluator(mock_repo).find_matching_rule(_DEVICE) is None


@pytest.mark.unit
def test_find_matching_rule_skips_rule_on_evaluation_error() -> None:
    mock_repo = MagicMock()
    bad_rule = _rule(1, "bad.yaml", None)
    good_rule = _rule(
        2,
        "good.yaml",
        [{"type": "condition", "key": "role", "value": "Router"}],
    )
    mock_repo.get_all_ordered.return_value = [bad_rule, good_rule]
    evaluator = _evaluator(mock_repo)

    matched = evaluator.find_matching_rule(_DEVICE)

    assert matched.id == 2


@pytest.mark.unit
def test_evaluate_expression_and_connector() -> None:
    evaluator = _evaluator(MagicMock())
    expression = [
        {"type": "condition", "key": "role", "value": "Router"},
        {"type": "connector", "operator": "and"},
        {"type": "condition", "key": "status", "value": "active"},
    ]

    assert evaluator._evaluate_expression(_DEVICE, expression) is True


@pytest.mark.unit
def test_evaluate_expression_or_connector() -> None:
    evaluator = _evaluator(MagicMock())
    expression = [
        {"type": "condition", "key": "role", "value": "Switch"},
        {"type": "connector", "operator": "or"},
        {"type": "condition", "key": "role", "value": "Router"},
    ]

    assert evaluator._evaluate_expression(_DEVICE, expression) is True


@pytest.mark.unit
def test_evaluate_condition_ip_prefix() -> None:
    evaluator = _evaluator(MagicMock())

    assert (
        evaluator._evaluate_condition(
            _DEVICE, {"key": "ip_prefix", "value": "10.0.0.0/24"}
        )
        is True
    )
    assert (
        evaluator._evaluate_condition(
            _DEVICE, {"key": "ip_prefix", "value": "192.168.0.0/24"}
        )
        is False
    )


@pytest.mark.unit
def test_evaluate_condition_tag_membership() -> None:
    evaluator = _evaluator(MagicMock())

    assert evaluator._evaluate_condition(
        _DEVICE, {"key": "tag", "value": "production"}
    )
    assert not evaluator._evaluate_condition(_DEVICE, {"key": "tag", "value": "lab"})


@pytest.mark.unit
def test_evaluate_condition_custom_field() -> None:
    evaluator = _evaluator(MagicMock())

    assert evaluator._evaluate_condition(
        _DEVICE,
        {"key": "custom_field", "field": "site_code", "value": "east"},
    )


@pytest.mark.unit
def test_evaluate_condition_unknown_key_returns_false() -> None:
    evaluator = _evaluator(MagicMock())

    assert not evaluator._evaluate_condition(
        _DEVICE, {"key": "unknown_key", "value": "x"}
    )


@pytest.mark.unit
def test_device_ip_in_prefix_invalid_cidr() -> None:
    evaluator = _evaluator(MagicMock())

    assert not evaluator._device_ip_in_prefix(_DEVICE, "not-a-cidr")
