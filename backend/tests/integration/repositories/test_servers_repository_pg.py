"""PostgreSQL integration tests for ``ServersRepository``.

Exercises ``JSONB`` columns, ``load_only`` summaries, and ``ilike`` search escaping.
Skipped unless ``TEST_DATABASE_URL`` is set.

Run::

    export TEST_DATABASE_URL=postgresql+psycopg2://user:pass@127.0.0.1:5432/db
    pytest tests/integration/repositories/test_servers_repository_pg.py -v --no-cov
"""

from __future__ import annotations

from sqlalchemy import inspect as sa_inspect

import pytest

from repositories.servers.servers_repository import ServersRepository

pytestmark = pytest.mark.postgres

_HUGE_FACTS = {"ansible_hostname": "loaded", "payload": "x" * 4096}


@pytest.mark.integration
class TestServersRepositoryPg:
    def test_count_all_returns_row_count(
        self, servers_repository_pg: ServersRepository
    ) -> None:
        repo = servers_repository_pg
        repo.create(hostname="alpha")
        repo.create(hostname="beta")

        assert repo.count_all() == 2

    def test_list_summaries_search_substring(
        self, servers_repository_pg: ServersRepository
    ) -> None:
        repo = servers_repository_pg
        repo.create(hostname="web01")
        repo.create(hostname="db01")

        rows = repo.list_summaries(search="web")

        assert [r.hostname for r in rows] == ["web01"]

    def test_list_summaries_orders_by_hostname(
        self, servers_repository_pg: ServersRepository
    ) -> None:
        repo = servers_repository_pg
        repo.create(hostname="zebra")
        repo.create(hostname="alpha")

        rows = repo.list_summaries()

        assert [r.hostname for r in rows] == ["alpha", "zebra"]

    def test_list_summaries_ilike_escapes_percent_literal(
        self, servers_repository_pg: ServersRepository
    ) -> None:
        """Search ``%`` matches a literal percent in hostname, not every row."""
        repo = servers_repository_pg
        repo.create(hostname="no-special")
        repo.create(hostname="has%sign")

        rows = repo.list_summaries(search="%")

        assert [r.hostname for r in rows] == ["has%sign"]

    def test_list_summaries_ilike_escapes_underscore_literal(
        self, servers_repository_pg: ServersRepository
    ) -> None:
        """Search ``_`` matches a literal underscore, not single-char wildcards."""
        repo = servers_repository_pg
        repo.create(hostname="ab")
        repo.create(hostname="a_b")

        rows = repo.list_summaries(search="_")

        assert [r.hostname for r in rows] == ["a_b"]

    def test_list_summaries_defers_ansible_facts(
        self, servers_repository_pg: ServersRepository
    ) -> None:
        """Summary query does not load large ``ansible_facts`` JSONB column."""
        repo = servers_repository_pg
        repo.create(hostname="facts-host", ansible_facts=_HUGE_FACTS)

        rows = repo.list_summaries()
        assert len(rows) == 1

        unloaded = sa_inspect(rows[0]).unloaded
        assert "ansible_facts" in unloaded
