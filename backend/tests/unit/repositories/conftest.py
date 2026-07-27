"""Shared fixtures for repository unit tests.

Provides an in-memory SQLite session with only the tables these tests
need, rather than the full application schema — several tables use
PostgreSQL-only column types (e.g. JSONB) that SQLite can't compile.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.database import Base
from core.models import JobRun, JobSchedule, JobTemplate, User


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(
        engine,
        tables=[
            User.__table__,
            JobTemplate.__table__,
            JobSchedule.__table__,
            JobRun.__table__,
        ],
    )

    Session = sessionmaker(bind=engine)
    session = Session()

    yield session

    session.close()
    engine.dispose()
