"""PostgreSQL integration tests for ``JobRunRepository`` dashboard helpers.

Requires ``TEST_DATABASE_URL`` and a database where ``job_runs`` exists
(apply migrations / ``init_db``). Rows are deleted before each test.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

from core.models.jobs import JobRun
from repositories.jobs.job_run_repository import JobRunRepository

pytestmark = pytest.mark.postgres


@pytest.fixture(autouse=True)
def _clean_job_runs(postgres_engine_integration, _job_runs_table_present):
    with postgres_engine_integration.begin() as conn:
        conn.execute(text("DELETE FROM job_runs"))
    yield


@pytest.mark.integration
class TestJobRunRepositoryDashboardPg:
    def test_aggregate_status_counts_empty(self, job_run_repository_pg: JobRunRepository) -> None:
        counts = job_run_repository_pg.aggregate_status_counts()
        assert counts == {
            "total": 0,
            "completed": 0,
            "failed": 0,
            "running": 0,
        }

    def test_aggregate_status_counts_mixed(
        self,
        postgres_engine_integration,
        job_run_repository_pg: JobRunRepository,
    ) -> None:
        Session = sessionmaker(bind=postgres_engine_integration)
        now = datetime.now(timezone.utc)
        with Session() as s:
            for status in ("completed", "completed", "failed", "running", "pending"):
                s.add(
                    JobRun(
                        job_name="n",
                        job_type="backup",
                        status=status,
                        triggered_by="schedule",
                        queued_at=now,
                        celery_task_id=str(uuid.uuid4()),
                    )
                )
            s.commit()

        counts = job_run_repository_pg.aggregate_status_counts()
        assert counts["total"] == 5
        assert counts["completed"] == 2
        assert counts["failed"] == 1
        assert counts["running"] == 1

    def test_recent_backup_results_respects_window(
        self,
        postgres_engine_integration,
        job_run_repository_pg: JobRunRepository,
    ) -> None:
        Session = sessionmaker(bind=postgres_engine_integration)
        now = datetime.now(timezone.utc)
        old = now - timedelta(days=40)
        with Session() as s:
            s.add(
                JobRun(
                    job_name="old",
                    job_type="backup",
                    status="completed",
                    triggered_by="schedule",
                    queued_at=old,
                    result='{"devices_backed_up": 1, "devices_failed": 0}',
                    celery_task_id=str(uuid.uuid4()),
                )
            )
            s.add(
                JobRun(
                    job_name="new",
                    job_type="backup",
                    status="completed",
                    triggered_by="schedule",
                    queued_at=now,
                    result='{"devices_backed_up": 5, "devices_failed": 2}',
                    celery_task_id=str(uuid.uuid4()),
                )
            )
            s.commit()

        payloads = job_run_repository_pg.recent_backup_results(days=30)
        assert len(payloads) == 1
        data = json.loads(payloads[0])
        assert data["devices_backed_up"] == 5
        assert data["devices_failed"] == 2
