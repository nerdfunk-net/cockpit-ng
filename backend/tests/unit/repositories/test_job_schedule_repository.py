"""Unit tests for JobScheduleRepository's user-deletion-cleanup helpers.

Uses a real in-memory SQLite session (via the shared ``db_session``
fixture) since these queries (filter, bulk update, ``.in_()``) are
portable and don't rely on PostgreSQL-only features.
"""

import pytest

from core.models import JobSchedule, JobTemplate, User
from repositories.jobs.job_schedule_repository import JobScheduleRepository


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


def _make_template(db_session, *, name: str) -> JobTemplate:
    template = JobTemplate(
        name=name,
        job_type="backup",
        inventory_source="all",
        is_global=True,
    )
    db_session.add(template)
    db_session.commit()
    db_session.refresh(template)
    return template


def _make_schedule(
    db_session, *, job_identifier, template_id, is_global, user_id=None
) -> JobSchedule:
    schedule = JobSchedule(
        job_identifier=job_identifier,
        job_template_id=template_id,
        schedule_type="now",
        is_global=is_global,
        user_id=user_id,
    )
    db_session.add(schedule)
    db_session.commit()
    db_session.refresh(schedule)
    return schedule


@pytest.mark.unit
class TestGetByOwner:
    def test_returns_global_and_private_rows_for_user_strictly(self, db_session):
        repo = JobScheduleRepository()
        alice = _make_user(db_session, "alice")
        bob = _make_user(db_session, "bob")
        template = _make_template(db_session, name="tmpl")

        _make_schedule(
            db_session,
            job_identifier="alice-global",
            template_id=template.id,
            is_global=True,
            user_id=alice.id,
        )
        _make_schedule(
            db_session,
            job_identifier="alice-private",
            template_id=template.id,
            is_global=False,
            user_id=alice.id,
        )
        _make_schedule(
            db_session,
            job_identifier="bob-global",
            template_id=template.id,
            is_global=True,
            user_id=bob.id,
        )

        result = repo.get_by_owner(alice.id, db=db_session)

        identifiers = {s.job_identifier for s in result}
        assert identifiers == {"alice-global", "alice-private"}


@pytest.mark.unit
class TestReassignGlobalByOwner:
    def test_updates_only_global_rows(self, db_session):
        repo = JobScheduleRepository()
        alice = _make_user(db_session, "alice")
        bob = _make_user(db_session, "bob")
        template = _make_template(db_session, name="tmpl")

        global_sched = _make_schedule(
            db_session,
            job_identifier="alice-global",
            template_id=template.id,
            is_global=True,
            user_id=alice.id,
        )
        private_sched = _make_schedule(
            db_session,
            job_identifier="alice-private",
            template_id=template.id,
            is_global=False,
            user_id=alice.id,
        )

        count = repo.reassign_global_by_owner(alice.id, bob.id, db=db_session)
        db_session.commit()

        assert count == 1
        db_session.refresh(global_sched)
        db_session.refresh(private_sched)
        assert global_sched.user_id == bob.id
        assert private_sched.user_id == alice.id


@pytest.mark.unit
class TestDeleteByUserIdSchedules:
    def test_deletes_only_private_schedules(self, db_session):
        repo = JobScheduleRepository()
        alice = _make_user(db_session, "alice")
        template = _make_template(db_session, name="tmpl")

        global_sched = _make_schedule(
            db_session,
            job_identifier="alice-global",
            template_id=template.id,
            is_global=True,
            user_id=alice.id,
        )
        private_sched = _make_schedule(
            db_session,
            job_identifier="alice-private",
            template_id=template.id,
            is_global=False,
            user_id=alice.id,
        )

        deleted_ids = repo.delete_by_user_id(alice.id, db=db_session)
        db_session.commit()

        assert deleted_ids == [private_sched.id]
        assert db_session.get(JobSchedule, global_sched.id) is not None
        assert db_session.get(JobSchedule, private_sched.id) is None


@pytest.mark.unit
class TestGetByTemplateIds:
    def test_returns_schedules_across_multiple_owners(self, db_session):
        repo = JobScheduleRepository()
        alice = _make_user(db_session, "alice")
        bob = _make_user(db_session, "bob")
        template_a = _make_template(db_session, name="tmpl-a")
        template_b = _make_template(db_session, name="tmpl-b")
        other_template = _make_template(db_session, name="tmpl-other")

        _make_schedule(
            db_session,
            job_identifier="alice-sched",
            template_id=template_a.id,
            is_global=False,
            user_id=alice.id,
        )
        _make_schedule(
            db_session,
            job_identifier="bob-sched",
            template_id=template_b.id,
            is_global=False,
            user_id=bob.id,
        )
        _make_schedule(
            db_session,
            job_identifier="unrelated-sched",
            template_id=other_template.id,
            is_global=False,
            user_id=bob.id,
        )

        result = repo.get_by_template_ids([template_a.id, template_b.id], db=db_session)

        identifiers = {s.job_identifier for s in result}
        assert identifiers == {"alice-sched", "bob-sched"}

    def test_empty_list_short_circuits_without_query(self, db_session):
        repo = JobScheduleRepository()
        assert repo.get_by_template_ids([], db=db_session) == []
