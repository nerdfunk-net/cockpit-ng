"""
Repository layer for database operations.

This module provides a clean separation between business logic and database access.
All database operations should go through repositories to ensure consistent patterns
and easier testing.
"""

from .base import BaseRepository
from .user_repository import UserRepository
from .rbac_repository import RBACRepository
from .credentials_repository import CredentialsRepository
from .profile_repository import ProfileRepository
from .template_repository import TemplateRepository
from .git_repository_repository import GitRepositoryRepository
from .job_schedule_repository import JobScheduleRepository
from .job_template_repository import JobTemplateRepository
from .job_run_repository import JobRunRepository, job_run_repository
from .compliance_repository import (
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
