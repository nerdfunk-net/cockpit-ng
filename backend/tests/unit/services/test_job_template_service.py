"""Unit tests for JobTemplateService using FakeJobTemplateRepository.

All tests run offline — no database required.
"""

from __future__ import annotations

import pytest

from services.jobs.job_template_service import JobTemplateService
from tests.mocks.fake_job_repositories import FakeJobTemplateRepository


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def tmpl_repo() -> FakeJobTemplateRepository:
    return FakeJobTemplateRepository()


@pytest.fixture
def svc(tmpl_repo: FakeJobTemplateRepository) -> JobTemplateService:
    """JobTemplateService wired to an in-memory repository."""
    service = JobTemplateService.__new__(JobTemplateService)
    service._repo = tmpl_repo
    return service


def _create_backup(
    svc: JobTemplateService, name: str = "nightly-backup", user_id: int = 1
) -> dict:
    """Helper: create a minimal backup job template."""
    return svc.create_job_template(
        name=name,
        job_type="backup",
        user_id=user_id,
        created_by="alice",
    )


# ===========================================================================
# create_job_template
# ===========================================================================


@pytest.mark.unit
class TestCreateJobTemplate:
    def test_creates_template_returns_dict(self, svc: JobTemplateService) -> None:
        result = _create_backup(svc)

        assert result["name"] == "nightly-backup"
        assert result["job_type"] == "backup"
        assert result["id"] is not None
        assert result["created_by"] == "alice"

    def test_default_fields_are_set(self, svc: JobTemplateService) -> None:
        result = _create_backup(svc)

        assert result["inventory_source"] == "all"
        assert result["parallel_tasks"] == 1
        assert result["activate_changes_after_sync"] is True
        assert result["use_last_compare_run"] is True

    def test_duplicate_name_raises(self, svc: JobTemplateService) -> None:
        _create_backup(svc, "same-name", user_id=1)
        with pytest.raises(ValueError, match="already exists"):
            _create_backup(svc, "same-name", user_id=1)

    def test_global_template_has_no_user_id(self, svc: JobTemplateService) -> None:
        result = svc.create_job_template(
            name="global-backup",
            job_type="backup",
            user_id=99,
            created_by="admin",
            is_global=True,
        )
        assert result["user_id"] is None
        assert result["is_global"] is True

    def test_private_template_keeps_user_id(self, svc: JobTemplateService) -> None:
        result = svc.create_job_template(
            name="my-backup",
            job_type="backup",
            user_id=42,
            created_by="bob",
            is_global=False,
        )
        assert result["user_id"] == 42

    def test_json_fields_are_serialized_and_deserialized(
        self, svc: JobTemplateService
    ) -> None:
        variables = {"region": "eu-west", "timeout": 30}
        result = svc.create_job_template(
            name="deploy-template",
            job_type="deploy_agent",
            user_id=1,
            created_by="alice",
            deploy_custom_variables=variables,
        )
        assert result["deploy_custom_variables"] == variables

    def test_csv_column_mapping_round_trips(self, svc: JobTemplateService) -> None:
        mapping = {"hostname": "name", "ip": "primary_ip"}
        result = svc.create_job_template(
            name="csv-import",
            job_type="csv_import",
            user_id=1,
            created_by="alice",
            csv_import_column_mapping=mapping,
        )
        assert result["csv_import_column_mapping"] == mapping


# ===========================================================================
# get_job_template / get_job_template_by_name
# ===========================================================================


@pytest.mark.unit
class TestGetJobTemplate:
    def test_get_by_id_found(self, svc: JobTemplateService) -> None:
        created = _create_backup(svc)
        found = svc.get_job_template(created["id"])
        assert found is not None
        assert found["id"] == created["id"]

    def test_get_by_id_not_found(self, svc: JobTemplateService) -> None:
        assert svc.get_job_template(9999) is None

    def test_get_by_name_found(self, svc: JobTemplateService) -> None:
        _create_backup(svc, "my-job")
        found = svc.get_job_template_by_name("my-job")
        assert found is not None
        assert found["name"] == "my-job"

    def test_get_by_name_not_found(self, svc: JobTemplateService) -> None:
        assert svc.get_job_template_by_name("ghost") is None


# ===========================================================================
# list_job_templates / get_user_job_templates
# ===========================================================================


@pytest.mark.unit
class TestListJobTemplates:
    def test_list_global_templates(self, svc: JobTemplateService) -> None:
        svc.create_job_template("g1", "backup", 1, "admin", is_global=True)
        svc.create_job_template("g2", "compare_devices", 1, "admin", is_global=True)
        svc.create_job_template("private", "backup", 2, "user")

        result = svc.list_job_templates()
        names = [t["name"] for t in result]
        assert "g1" in names
        assert "g2" in names
        assert "private" not in names

    def test_list_user_templates_includes_global(self, svc: JobTemplateService) -> None:
        svc.create_job_template("global", "backup", 1, "admin", is_global=True)
        svc.create_job_template("mine", "backup", 42, "alice")

        result = svc.list_job_templates(user_id=42)
        names = [t["name"] for t in result]
        assert "global" in names
        assert "mine" in names

    def test_list_user_templates_excludes_other_private(
        self, svc: JobTemplateService
    ) -> None:
        svc.create_job_template("alice-job", "backup", 1, "alice")
        svc.create_job_template("bob-job", "backup", 2, "bob")

        result = svc.list_job_templates(user_id=1)
        names = [t["name"] for t in result]
        assert "alice-job" in names
        assert "bob-job" not in names

    def test_filter_by_job_type(self, svc: JobTemplateService) -> None:
        svc.create_job_template("b1", "backup", 1, "admin", is_global=True)
        svc.create_job_template("c1", "compare_devices", 1, "admin", is_global=True)

        result = svc.list_job_templates(job_type="backup")
        assert all(t["job_type"] == "backup" for t in result)

    def test_get_user_job_templates(self, svc: JobTemplateService) -> None:
        svc.create_job_template("global", "backup", 1, "admin", is_global=True)
        svc.create_job_template("mine", "sync_devices", 5, "charlie")

        result = svc.get_user_job_templates(5)
        names = [t["name"] for t in result]
        assert "global" in names
        assert "mine" in names


# ===========================================================================
# update_job_template
# ===========================================================================


@pytest.mark.unit
class TestUpdateJobTemplate:
    def test_update_name(self, svc: JobTemplateService) -> None:
        created = _create_backup(svc, "old-name")
        updated = svc.update_job_template(created["id"], name="new-name")
        assert updated is not None
        assert updated["name"] == "new-name"

    def test_update_description(self, svc: JobTemplateService) -> None:
        created = _create_backup(svc)
        updated = svc.update_job_template(created["id"], description="My description")
        assert updated["description"] == "My description"

    def test_update_returns_none_for_missing(self, svc: JobTemplateService) -> None:
        result = svc.update_job_template(9999, description="x")
        assert result is None

    def test_update_duplicate_name_raises(self, svc: JobTemplateService) -> None:
        _create_backup(svc, "first")
        second = _create_backup(svc, "second")
        with pytest.raises(ValueError, match="already exists"):
            svc.update_job_template(second["id"], name="first", user_id=1)

    def test_update_deploy_custom_variables(self, svc: JobTemplateService) -> None:
        created = _create_backup(svc)
        new_vars = {"env": "prod"}
        updated = svc.update_job_template(
            created["id"], deploy_custom_variables=new_vars
        )
        assert updated["deploy_custom_variables"] == new_vars

    def test_no_op_update_returns_current(self, svc: JobTemplateService) -> None:
        created = _create_backup(svc)
        result = svc.update_job_template(created["id"])
        assert result is not None
        assert result["id"] == created["id"]


# ===========================================================================
# delete_job_template
# ===========================================================================


@pytest.mark.unit
class TestDeleteJobTemplate:
    def test_delete_existing(self, svc: JobTemplateService) -> None:
        created = _create_backup(svc)
        assert svc.delete_job_template(created["id"]) is True
        assert svc.get_job_template(created["id"]) is None

    def test_delete_nonexistent(self, svc: JobTemplateService) -> None:
        assert svc.delete_job_template(9999) is False


# ===========================================================================
# get_job_types
# ===========================================================================


@pytest.mark.unit
class TestGetJobTypes:
    def test_returns_list_of_dicts(self, svc: JobTemplateService) -> None:
        types = svc.get_job_types()
        assert isinstance(types, list)
        assert len(types) > 0

    def test_each_type_has_required_fields(self, svc: JobTemplateService) -> None:
        for t in svc.get_job_types():
            assert "value" in t
            assert "label" in t
            assert "description" in t

    def test_backup_type_present(self, svc: JobTemplateService) -> None:
        values = [t["value"] for t in svc.get_job_types()]
        assert "backup" in values
