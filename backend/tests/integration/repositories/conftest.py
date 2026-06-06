"""Fixtures for repository integration tests against a real PostgreSQL instance.

Set ``TEST_DATABASE_URL`` to a PostgreSQL SQLAlchemy URL, for example::

    export TEST_DATABASE_URL=postgresql+psycopg2://user:pass@127.0.0.1:5432/mytestdb

See ``README.md`` in this directory for CI and safety notes.
"""

from __future__ import annotations

import os
from urllib.parse import urlparse

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from core.database import Base
from core.models.client_data import ClientHostname, ClientIpAddress, ClientMacAddress
from core.models.servers import Server


def _require_pg_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip(
            "PostgreSQL repository tests require TEST_DATABASE_URL (postgresql+psycopg2://...)."
        )

    # Safety guard: refuse to run against the production database.
    # Compare host + port + database path after stripping driver prefixes.
    try:
        from config import settings

        def _netloc(raw: str) -> tuple[str, str | None, str]:
            p = urlparse(raw)
            return (p.hostname or "", str(p.port) if p.port else None, p.path)

        if _netloc(url) == _netloc(settings.database_url):
            pytest.fail(
                "TEST_DATABASE_URL points at the production database. "
                "Repository integration tests must use a dedicated test database."
            )
    except Exception:
        pass  # if settings can't be loaded, proceed — the URL check is best-effort

    return url


@pytest.fixture(scope="session")
def postgres_engine_integration():
    """Shared engine for all repository integration tests in this package."""
    url = _require_pg_url()
    engine = create_engine(url, pool_pre_ping=True)
    yield engine
    engine.dispose()


@pytest.fixture(scope="session")
def postgres_engine_client_data(postgres_engine_integration):
    """Ensures client-data tables exist (``create_all`` for those models only)."""
    tables = [
        ClientIpAddress.__table__,
        ClientMacAddress.__table__,
        ClientHostname.__table__,
    ]
    Base.metadata.create_all(postgres_engine_integration, tables=tables)
    return postgres_engine_integration


@pytest.fixture(autouse=True)
def _truncate_client_data_tables(postgres_engine_client_data):
    with postgres_engine_client_data.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE TABLE client_hostnames, client_mac_addresses, client_ip_addresses RESTART IDENTITY CASCADE"
            )
        )
    yield


@pytest.fixture
def client_data_repository_pg(postgres_engine_client_data, monkeypatch):
    """``ClientDataRepository`` using a session factory bound to the test engine."""
    import core.database as db_mod

    make_session = sessionmaker(bind=postgres_engine_client_data)
    monkeypatch.setattr(db_mod, "get_db_session", lambda: make_session())
    from repositories.client_data.client_data_repository import ClientDataRepository

    return ClientDataRepository()


@pytest.fixture(scope="session")
def _job_runs_table_present(postgres_engine_integration):
    insp = inspect(postgres_engine_integration)
    if not insp.has_table("job_runs"):
        pytest.skip(
            "Table job_runs is missing; apply migrations (init_db) on TEST_DATABASE_URL."
        )


@pytest.fixture
def job_run_repository_pg(
    postgres_engine_integration, _job_runs_table_present, monkeypatch
):
    """``JobRunRepository`` using sessions from the shared test engine."""
    import core.database as db_mod

    make_session = sessionmaker(bind=postgres_engine_integration)
    monkeypatch.setattr(db_mod, "get_db_session", lambda: make_session())
    from repositories.jobs.job_run_repository import JobRunRepository

    return JobRunRepository()


@pytest.fixture(scope="session")
def postgres_engine_servers(postgres_engine_integration):
    """Ensures ``servers`` table exists (``create_all`` for that model only)."""
    Base.metadata.create_all(postgres_engine_integration, tables=[Server.__table__])
    return postgres_engine_integration


@pytest.fixture
def servers_repository_pg(postgres_engine_servers, monkeypatch):
    """``ServersRepository`` using a session factory bound to the test engine."""
    import core.database as db_mod

    with postgres_engine_servers.begin() as conn:
        conn.execute(text("TRUNCATE TABLE servers RESTART IDENTITY CASCADE"))

    make_session = sessionmaker(bind=postgres_engine_servers)

    def _test_get_db_session():
        return make_session()

    # BaseRepository binds get_db_session at import time in repositories.base.
    monkeypatch.setattr(db_mod, "get_db_session", _test_get_db_session)
    monkeypatch.setattr("repositories.base.get_db_session", _test_get_db_session)
    from repositories.servers.servers_repository import ServersRepository

    return ServersRepository()
