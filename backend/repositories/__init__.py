"""
Repository layer for database operations.

This module provides a clean separation between business logic and database access.
All database operations should go through repositories to ensure consistent patterns
and easier testing.
"""

from .auth.profile_repository import ProfileRepository
from .auth.rbac_repository import RBACRepository
from .auth.user_repository import UserRepository
from .base import BaseRepository
from .compliance.compliance_repository import (
    LoginCredentialRepository,
    RegexPatternRepository,
    SNMPMappingRepository,
)
from .jobs.job_run_repository import JobRunRepository, job_run_repository
from .jobs.job_schedule_repository import JobScheduleRepository
from .jobs.job_template_repository import JobTemplateRepository
from .settings.credentials_repository import CredentialsRepository
from .git.git_repository_repository import GitRepositoryRepository
from .settings.template_repository import TemplateRepository

__all__ = [
    "BaseRepository",
    "UserRepository",
    "RBACRepository",
    "CredentialsRepository",
    "ProfileRepository",
    "TemplateRepository",
    "GitRepositoryRepository",
    "JobScheduleRepository",
    "JobTemplateRepository",
    "JobRunRepository",
    "job_run_repository",
    "RegexPatternRepository",
    "LoginCredentialRepository",
    "SNMPMappingRepository",
]
