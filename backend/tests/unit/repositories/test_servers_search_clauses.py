"""Unit tests for server search SQL clause builders."""

from __future__ import annotations

import pytest
from sqlalchemy.sql.elements import ColumnElement

from models.servers import SearchGroup, SearchRule
from repositories.servers.servers_repository import _group_to_clause, _rule_to_clause


@pytest.mark.unit
def test_rule_to_clause_gt() -> None:
    clause = _rule_to_clause(SearchRule(field="memtotal_mb", op="gt", value=8192))
    assert isinstance(clause, ColumnElement)


@pytest.mark.unit
def test_group_to_clause_nested_not() -> None:
    group = SearchGroup.model_validate(
        {
            "combinator": "and",
            "rules": [
                {"field": "processor_count", "op": "gt", "value": 4},
                {
                    "combinator": "or",
                    "not": True,
                    "rules": [
                        {"field": "os_family", "op": "eq", "value": "Debian"},
                        {"field": "is_virtual", "op": "eq", "value": True},
                    ],
                },
            ],
        }
    )
    clause = _group_to_clause(group)
    assert isinstance(clause, ColumnElement)
    compiled = str(clause.compile(compile_kwargs={"literal_binds": True}))
    assert "processor_count" in compiled
    assert "os_family" in compiled
