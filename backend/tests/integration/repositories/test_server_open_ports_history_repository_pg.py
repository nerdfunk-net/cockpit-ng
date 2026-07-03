"""PostgreSQL integration tests for ``ServerOpenPortsHistoryRepository``.

Exercises ``load_only`` list projection, server-scoped lookups, and
``ON DELETE CASCADE`` behaviour when the owning server is removed.
Skipped unless ``TEST_DATABASE_URL`` is set.

Run::

    export TEST_DATABASE_URL=postgresql+psycopg2://user:pass@127.0.0.1:5432/db
    pytest tests/integration/repositories/test_server_open_ports_history_repository_pg.py -v --no-cov
"""

from __future__ import annotations

import pytest
from sqlalchemy import inspect as sa_inspect

pytestmark = pytest.mark.postgres

_PORTS_V1 = {"tcp_ports": [22], "udp_ports": []}
_PORTS_V2 = {"tcp_ports": [22, 80], "udp_ports": [123]}


@pytest.mark.integration
class TestServerOpenPortsHistoryRepositoryPg:
    def test_get_by_server_id_orders_newest_first(
        self, server_open_ports_history_repository_pg
    ) -> None:
        servers_repo, history_repo = server_open_ports_history_repository_pg
        server = servers_repo.create(hostname="web01")
        history_repo.create(
            server_id=server.id, open_ports=_PORTS_V1, content_hash="hash1"
        )
        history_repo.create(
            server_id=server.id, open_ports=_PORTS_V2, content_hash="hash2"
        )

        rows = history_repo.get_by_server_id(server.id)

        assert [r.content_hash for r in rows] == ["hash2", "hash1"]

    def test_get_by_server_id_defers_open_ports(
        self, server_open_ports_history_repository_pg
    ) -> None:
        """List query does not load the ``open_ports`` JSONB column."""
        servers_repo, history_repo = server_open_ports_history_repository_pg
        server = servers_repo.create(hostname="web01")
        history_repo.create(
            server_id=server.id, open_ports=_PORTS_V1, content_hash="hash1"
        )

        rows = history_repo.get_by_server_id(server.id)
        assert len(rows) == 1

        unloaded = sa_inspect(rows[0]).unloaded
        assert "open_ports" in unloaded

    def test_get_by_server_id_scoped_to_server(
        self, server_open_ports_history_repository_pg
    ) -> None:
        servers_repo, history_repo = server_open_ports_history_repository_pg
        server_a = servers_repo.create(hostname="a")
        server_b = servers_repo.create(hostname="b")
        history_repo.create(
            server_id=server_a.id, open_ports=_PORTS_V1, content_hash="hash-a"
        )
        history_repo.create(
            server_id=server_b.id, open_ports=_PORTS_V2, content_hash="hash-b"
        )

        rows_a = history_repo.get_by_server_id(server_a.id)
        assert [r.content_hash for r in rows_a] == ["hash-a"]

    def test_get_by_id_scoped_returns_full_row(
        self, server_open_ports_history_repository_pg
    ) -> None:
        servers_repo, history_repo = server_open_ports_history_repository_pg
        server = servers_repo.create(hostname="web01")
        entry = history_repo.create(
            server_id=server.id, open_ports=_PORTS_V1, content_hash="hash1"
        )

        row = history_repo.get_by_id_scoped(server.id, entry.id)

        assert row is not None
        assert row.open_ports == _PORTS_V1

    def test_get_by_id_scoped_rejects_wrong_server(
        self, server_open_ports_history_repository_pg
    ) -> None:
        servers_repo, history_repo = server_open_ports_history_repository_pg
        server_a = servers_repo.create(hostname="a")
        server_b = servers_repo.create(hostname="b")
        entry = history_repo.create(
            server_id=server_a.id, open_ports=_PORTS_V1, content_hash="hash1"
        )

        row = history_repo.get_by_id_scoped(server_b.id, entry.id)

        assert row is None

    def test_deleting_server_cascades_history_delete(
        self, server_open_ports_history_repository_pg
    ) -> None:
        servers_repo, history_repo = server_open_ports_history_repository_pg
        server = servers_repo.create(hostname="web01")
        history_repo.create(
            server_id=server.id, open_ports=_PORTS_V1, content_hash="hash1"
        )

        servers_repo.delete(server.id)

        assert history_repo.get_by_server_id(server.id) == []
