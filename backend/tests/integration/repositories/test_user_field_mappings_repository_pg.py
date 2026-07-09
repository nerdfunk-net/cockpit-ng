"""PostgreSQL integration tests for ``UserFieldMappingRepository``.

Exercises the JSONB ``mapping`` column and the (username, app_name) upsert
behavior, which SQLite cannot faithfully emulate. Skipped unless
``TEST_DATABASE_URL`` is set.

Run::

    export TEST_DATABASE_URL=postgresql+psycopg2://user:pass@127.0.0.1:5432/db
    pytest tests/integration/repositories/test_user_field_mappings_repository_pg.py -v --no-cov
"""

from __future__ import annotations

import pytest

from repositories.user_field_mappings.user_field_mappings_repository import (
    UserFieldMappingRepository,
)

pytestmark = pytest.mark.postgres


@pytest.mark.integration
class TestUserFieldMappingRepositoryPg:
    def test_get_by_username_and_app_returns_none_when_missing(
        self, user_field_mapping_repository_pg: UserFieldMappingRepository
    ) -> None:
        result = user_field_mapping_repository_pg.get_by_username_and_app(
            "alice", "nautobot-live-update"
        )
        assert result is None

    def test_upsert_creates_new_record(
        self, user_field_mapping_repository_pg: UserFieldMappingRepository
    ) -> None:
        repo = user_field_mapping_repository_pg
        mapping = {"Device Name": "name", "Status": "status"}

        record = repo.upsert("alice", "nautobot-live-update", mapping)

        assert record.username == "alice"
        assert record.app_name == "nautobot-live-update"
        assert record.mapping == mapping

        fetched = repo.get_by_username_and_app("alice", "nautobot-live-update")
        assert fetched is not None
        assert fetched.mapping == mapping

    def test_upsert_replaces_existing_mapping(
        self, user_field_mapping_repository_pg: UserFieldMappingRepository
    ) -> None:
        repo = user_field_mapping_repository_pg
        repo.upsert("alice", "nautobot-live-update", {"Device Name": "name"})

        updated = repo.upsert(
            "alice",
            "nautobot-live-update",
            {"Device Name": "name", "Status": "status"},
        )

        assert updated.mapping == {"Device Name": "name", "Status": "status"}
        fetched = repo.get_by_username_and_app("alice", "nautobot-live-update")
        assert fetched.mapping == {"Device Name": "name", "Status": "status"}

    def test_mappings_are_scoped_per_app_and_user(
        self, user_field_mapping_repository_pg: UserFieldMappingRepository
    ) -> None:
        repo = user_field_mapping_repository_pg
        repo.upsert("alice", "nautobot-live-update", {"Device Name": "name"})
        repo.upsert("bob", "nautobot-live-update", {"Device Name": "hostname"})
        repo.upsert("alice", "other-tool", {"Device Name": "device"})

        assert repo.get_by_username_and_app(
            "alice", "nautobot-live-update"
        ).mapping == {"Device Name": "name"}
        assert repo.get_by_username_and_app("bob", "nautobot-live-update").mapping == {
            "Device Name": "hostname"
        }
        assert repo.get_by_username_and_app("alice", "other-tool").mapping == {
            "Device Name": "device"
        }
