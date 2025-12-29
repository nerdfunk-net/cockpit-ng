"""
Repository layer for database operations.

This module provides a clean separation between business logic and database access.
All database operations should go through repositories to ensure consistent patterns
and easier testing.
"""

from .base import BaseRepository
from .auth.user_repository import UserRepository
from .auth.rbac_repository import RBACRepository
from .auth.profile_repository import ProfileRepository
from .settings.credentials_repository import CredentialsRepository
from .settings.template_repository import TemplateRepository
from .settings.git_repository_repository import GitRepositoryRepository
from .jobs.job_schedule_repository import JobScheduleRepository
from .jobs.job_template_repository import JobTemplateRepository
from .jobs.job_run_repository import JobRunRepository, job_run_repository
from .compliance.compliance_repository import (
    RegexPatternRepository,
    LoginCredentialRepository,
    SNMPMappingRepository,
)

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
