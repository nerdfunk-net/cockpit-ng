"""Unit tests for models/checkmk_priority.py."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from models.checkmk_priority import (
    CheckMKPriorityRuleCreate,
    CheckMKPriorityRulesReorderRequest,
    ExpressionCondition,
    ExpressionConnector,
)


def _valid_expression() -> list:
    return [
        ExpressionCondition(type="condition", key="role", value="router"),
        ExpressionConnector(type="connector", operator="and"),
        ExpressionCondition(type="condition", key="status", value="active"),
    ]


@pytest.mark.unit
def test_expression_condition_rejects_unknown_key() -> None:
    with pytest.raises(ValidationError, match="Unsupported key"):
        ExpressionCondition(type="condition", key="bad_key", value="x")


@pytest.mark.unit
def test_expression_condition_field_only_allowed_for_custom_field() -> None:
    with pytest.raises(
        ValidationError, match="only allowed when key is 'custom_field'"
    ):
        ExpressionCondition(
            type="condition",
            key="role",
            field="extra",
            value="router",
        )


@pytest.mark.unit
def test_expression_condition_custom_field_with_field() -> None:
    cond = ExpressionCondition(
        type="condition",
        key="custom_field",
        field="site",
        value="NYC",
    )
    assert cond.field == "site"


@pytest.mark.unit
def test_create_rule_validates_filename_extension() -> None:
    with pytest.raises(ValidationError, match="\\.yaml"):
        CheckMKPriorityRuleCreate(
            priority_order=1,
            filename="rules.txt",
            expression=_valid_expression(),
        )


@pytest.mark.unit
def test_create_rule_rejects_path_in_filename() -> None:
    with pytest.raises(ValidationError, match="path separators"):
        CheckMKPriorityRuleCreate(
            priority_order=1,
            filename="subdir/rules.yaml",
            expression=_valid_expression(),
        )


@pytest.mark.unit
def test_create_rule_rejects_wrong_expression_alternation() -> None:
    bad = [
        ExpressionConnector(type="connector", operator="and"),
        ExpressionCondition(type="condition", key="role", value="r"),
    ]
    with pytest.raises(ValidationError, match="must be a 'condition'"):
        CheckMKPriorityRuleCreate(
            priority_order=0,
            filename="rule.yaml",
            expression=bad,
        )


@pytest.mark.unit
def test_create_rule_accepts_valid_payload() -> None:
    rule = CheckMKPriorityRuleCreate(
        priority_order=5,
        filename="high-priority.yaml",
        expression=_valid_expression(),
    )
    assert rule.filename == "high-priority.yaml"
    assert len(rule.expression) == 3


@pytest.mark.unit
def test_reorder_request_requires_rule_ids() -> None:
    req = CheckMKPriorityRulesReorderRequest(rule_ids=[3, 1, 2])
    assert req.rule_ids == [3, 1, 2]
