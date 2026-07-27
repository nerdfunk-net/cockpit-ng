"""Unit tests for JobTemplateRepository's user-deletion-cleanup helpers.

Uses a real in-memory SQLite session (via the shared ``db_session``
fixture) since these queries (filter, bulk update, ORM cascade delete)
are portable and don't rely on PostgreSQL-only features.
"""

import pytest

from core.models import JobSchedule, JobTemplate, User
from repositories.jobs.job_template_repository import JobTemplateRepository


def _make_user(db_session, username: str) -> User:
    user = User(
        username=username,
        realname=username.title(),
        email=f"{username}@example.com",
        password="hashed",
        permissions=1,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _make_template(
    db_session, *, name, job_type, created_by, is_global, user_id=None
) -> JobTemplate:
    template = JobTemplate(
        name=name,
        job_type=job_type,
        inventory_source="all",
        is_global=is_global,
        user_id=user_id,
        created_by=created_by,
    )
    db_session.add(template)
    db_session.commit()
    db_session.refresh(template)
    return template


@pytest.mark.unit
class TestGetByCreatedBy:
    def test_returns_global_and_private_templates_for_username(self, db_session):
        repo = JobTemplateRepository()
        alice = _make_user(db_session, "alice")
        _make_user(db_session, "bob")

        _make_template(
            db_session,
            name="alice-global",
            job_type="backup",
            created_by="alice",
            is_global=True,
        )
        _make_template(
            db_session,
            name="alice-private",
            job_type="backup",
            created_by="alice",
            is_global=False,
            user_id=alice.id,
        )
        _make_template(
            db_session,
            name="bob-global",
            job_type="backup",
            created_by="bob",
            is_global=True,
        )

        result = repo.get_by_created_by("alice", db=db_session)

        names = {t.name for t in result}
        assert names == {"alice-global", "alice-private"}


@pytest.mark.unit
class TestReassignGlobalByCreatedBy:
    def test_updates_only_global_rows(self, db_session):
        repo = JobTemplateRepository()
        alice = _make_user(db_session, "alice")
        _make_user(db_session, "bob")

        global_tmpl = _make_template(
            db_session,
            name="alice-global",
            job_type="backup",
            created_by="alice",
            is_global=True,
        )
        private_tmpl = _make_template(
            db_session,
            name="alice-private",
            job_type="backup",
            created_by="alice",
            is_global=False,
            user_id=alice.id,
        )

        count = repo.reassign_global_by_created_by("alice", "bob", db=db_session)
        db_session.commit()

        assert count == 1
        db_session.refresh(global_tmpl)
        db_session.refresh(private_tmpl)
        assert global_tmpl.created_by == "bob"
        assert private_tmpl.created_by == "alice"


@pytest.mark.unit
class TestDeleteByUserIdTemplates:
    def test_deletes_only_private_templates_and_cascades_schedules(self, db_session):
        repo = JobTemplateRepository()
        alice = _make_user(db_session, "alice")

        global_tmpl = _make_template(
            db_session,
            name="alice-global",
            job_type="backup",
            created_by="alice",
            is_global=True,
        )
        private_tmpl = _make_template(
            db_session,
            name="alice-private",
            job_type="backup",
            created_by="alice",
            is_global=False,
            user_id=alice.id,
        )

        schedule = JobSchedule(
            job_identifier="alice-schedule",
            job_template_id=private_tmpl.id,
            schedule_type="now",
            is_global=False,
            user_id=alice.id,
        )
        db_session.add(schedule)
        db_session.commit()
        schedule_id = schedule.id

        deleted_ids = repo.delete_by_user_id(alice.id, db=db_session)
        db_session.commit()

        assert deleted_ids == [private_tmpl.id]
        assert db_session.get(JobTemplate, global_tmpl.id) is not None
        assert db_session.get(JobTemplate, private_tmpl.id) is None
        # Cascade: the schedule referencing the deleted private template
        # must also be gone (JobSchedule.template backref,
        # cascade="all, delete-orphan").
        assert db_session.get(JobSchedule, schedule_id) is None
