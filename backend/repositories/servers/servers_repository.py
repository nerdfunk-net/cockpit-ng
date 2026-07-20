from typing import Any, List, Optional

from sqlalchemy import and_, func, not_, or_
from sqlalchemy.orm import Session, load_only
from sqlalchemy.sql.elements import ColumnElement

from core.models.servers import Server
from models.servers import SearchGroup, SearchRule
from repositories.base import BaseRepository

_SUMMARY_COLUMNS = (
    Server.id,
    Server.hostname,
    Server.location,
    Server.cluster,
    Server.distribution,
    Server.distribution_release,
    Server.distribution_version,
    Server.contact,
    Server.is_virtual,
)

_SEARCH_HIT_COLUMNS = (
    Server.id,
    Server.hostname,
    Server.location,
    Server.cluster,
    Server.os_family,
    Server.processor_count,
    Server.memtotal_mb,
    Server.disk_count,
    Server.disk_total_gb,
    Server.disk_usage_pct,
    Server.distribution,
    Server.distribution_release,
    Server.distribution_version,
    Server.contact,
    Server.is_virtual,
)

_FACET_COLUMNS = {
    "os_family": Server.os_family,
    "distribution": Server.distribution,
    "distribution_version": Server.distribution_version,
}

_FIELD_COLUMNS = {
    "memtotal_mb": Server.memtotal_mb,
    "processor_count": Server.processor_count,
    "disk_count": Server.disk_count,
    "disk_total_gb": Server.disk_total_gb,
    "disk_usage_pct": Server.disk_usage_pct,
    "os_family": Server.os_family,
    "distribution": Server.distribution,
    "distribution_version": Server.distribution_version,
    "is_virtual": Server.is_virtual,
}


def _rule_to_clause(rule: SearchRule) -> ColumnElement[bool]:
    column = _FIELD_COLUMNS[rule.field]
    op = rule.op
    value = rule.value

    if op == "gt":
        return column > value
    if op == "lt":
        return column < value
    if op == "eq":
        return column == value
    if op == "in":
        return column.in_(value)
    raise ValueError(f"unsupported search operator: {op!r}")


def _group_to_clause(group: SearchGroup) -> ColumnElement[bool]:
    parts: List[ColumnElement[bool]] = []
    for item in group.rules:
        if isinstance(item, SearchGroup):
            parts.append(_group_to_clause(item))
        else:
            parts.append(_rule_to_clause(item))

    if not parts:
        raise ValueError("search group must contain at least one rule")

    combined: ColumnElement[bool]
    if group.combinator == "or":
        combined = or_(*parts)
    else:
        combined = and_(*parts)

    if group.not_:
        return not_(combined)
    return combined


class ServersRepository(BaseRepository[Server]):
    def __init__(self) -> None:
        super().__init__(Server)

    def count_all(self, db: Optional[Session] = None) -> int:
        with self._db_session(db) as session:
            return int(session.query(func.count(Server.id)).scalar() or 0)

    def list_summaries(self, search: Optional[str] = None) -> List[Server]:
        """Return servers without loading ansible_facts or other large columns."""
        with self._db_session() as session:
            query = session.query(Server).options(load_only(*_SUMMARY_COLUMNS))
            if search:
                escaped = (
                    search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                )
                query = query.filter(Server.hostname.ilike(f"%{escaped}%", escape="\\"))
            return query.order_by(Server.hostname.asc()).all()

    def search(self, query: SearchGroup) -> List[Server]:
        """Return servers matching a nested boolean search tree."""
        clause = _group_to_clause(query)
        with self._db_session() as session:
            return (
                session.query(Server)
                .options(load_only(*_SEARCH_HIT_COLUMNS))
                .filter(clause)
                .order_by(Server.hostname.asc())
                .all()
            )

    def distinct_facet_values(self, field: str) -> List[str]:
        """Return sorted distinct non-null values for a facet field."""
        column = _FACET_COLUMNS.get(field)
        if column is None:
            raise ValueError(f"unsupported facet field: {field!r}")
        with self._db_session() as session:
            rows = (
                session.query(column)
                .filter(column.isnot(None))
                .filter(column != "")
                .distinct()
                .order_by(column.asc())
                .all()
            )
            return [str(row[0]) for row in rows if row[0] is not None]

    def backfill_search_columns_from_facts(self) -> int:
        """Populate distribution / disk_total_gb from existing ansible_facts.

        Returns the number of rows updated.
        """
        from services.servers.ansible_facts_parser import (
            _disk_total_gb,
            parse_ansible_facts,
        )

        updated = 0
        with self._db_session() as session:
            servers = session.query(Server).all()
            for server in servers:
                facts = server.ansible_facts
                if not facts:
                    continue

                # Stored shape is raw_facts dict (ansible_facts nested inside).
                # Re-wrap into the agent output envelope parse_ansible_facts expects.
                if "ansible_facts" in facts:
                    output: Any = {"facts": facts}
                else:
                    output = {"facts": {"ansible_facts": facts}}

                parsed = parse_ansible_facts(output)
                changed = False

                if not server.distribution and parsed.distribution:
                    server.distribution = parsed.distribution
                    changed = True

                if server.disk_total_gb is None:
                    # Prefer parser; fall back to mounts inside nested facts.
                    gb = parsed.disk_total_gb
                    if gb is None:
                        nested = facts.get("ansible_facts") or {}
                        mounts = nested.get("mounts") or []
                        gb = _disk_total_gb(mounts)
                    if gb is not None:
                        server.disk_total_gb = gb
                        changed = True

                if changed:
                    updated += 1

            if updated:
                session.commit()
        return updated
