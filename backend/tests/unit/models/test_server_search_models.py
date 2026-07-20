"""Unit tests for nested server search query models."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from models.servers import SearchGroup, SearchRule, ServerSearchRequest


@pytest.mark.unit
def test_search_rule_numeric_gt() -> None:
    rule = SearchRule(field="memtotal_mb", op="gt", value=8192)
    assert rule.value == 8192


@pytest.mark.unit
def test_search_rule_rejects_string_for_numeric() -> None:
    with pytest.raises(ValidationError):
        SearchRule(field="memtotal_mb", op="gt", value="big")


@pytest.mark.unit
def test_search_rule_string_eq() -> None:
    rule = SearchRule(field="os_family", op="eq", value="Debian")
    assert rule.value == "Debian"


@pytest.mark.unit
def test_search_rule_string_in() -> None:
    rule = SearchRule(field="distribution", op="in", value=["Ubuntu", "Debian"])
    assert rule.value == ["Ubuntu", "Debian"]


@pytest.mark.unit
def test_search_rule_bool_eq() -> None:
    rule = SearchRule(field="is_virtual", op="eq", value=True)
    assert rule.value is True


@pytest.mark.unit
def test_search_group_nested_and_or_not() -> None:
    group = SearchGroup.model_validate(
        {
            "combinator": "and",
            "not": False,
            "rules": [
                {"field": "memtotal_mb", "op": "gt", "value": 8192},
                {
                    "combinator": "or",
                    "not": True,
                    "rules": [
                        {"field": "os_family", "op": "eq", "value": "Debian"},
                        {"field": "distribution", "op": "eq", "value": "Ubuntu"},
                    ],
                },
            ],
        }
    )
    assert group.combinator == "and"
    assert len(group.rules) == 2
    nested = group.rules[1]
    assert isinstance(nested, SearchGroup)
    assert nested.not_ is True


@pytest.mark.unit
def test_search_group_requires_at_least_one_rule() -> None:
    with pytest.raises(ValidationError, match="at least one rule"):
        SearchGroup(combinator="and", rules=[])


@pytest.mark.unit
def test_search_group_rejects_too_many_rules() -> None:
    rules = [{"field": "processor_count", "op": "eq", "value": i} for i in range(51)]
    with pytest.raises(ValidationError, match="maximum of 50"):
        SearchGroup.model_validate({"combinator": "and", "rules": rules})


@pytest.mark.unit
def test_search_group_rejects_excessive_depth() -> None:
    node: dict = {"field": "is_virtual", "op": "eq", "value": True}
    for _ in range(6):
        node = {"combinator": "and", "rules": [node]}
    with pytest.raises(ValidationError, match="nesting depth"):
        SearchGroup.model_validate(node)


@pytest.mark.unit
def test_server_search_request_wraps_query() -> None:
    req = ServerSearchRequest.model_validate(
        {
            "query": {
                "combinator": "and",
                "rules": [
                    {"field": "disk_total_gb", "op": "gt", "value": 100},
                    {"field": "distribution_version", "op": "eq", "value": "22.04"},
                ],
            }
        }
    )
    assert req.query.combinator == "and"
    assert len(req.query.rules) == 2
