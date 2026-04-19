from core.models.agents import CockpitAgentCommand
from core.models.audit import AuditLog
from core.models.client_data import ClientHostname, ClientIpAddress, ClientMacAddress
from core.models.compliance import ComplianceCheck, ComplianceRule, RegexPattern
from core.models.credentials import Credential, LoginCredential, SNMPMapping
from core.models.git import GitRepository
from core.models.inventory import Inventory
from core.models.jobs import Job, JobRun, JobSchedule, JobTemplate
from core.models.nb2cmk import NB2CMKJob, NB2CMKJobResult, NB2CMKSync
from core.models.rack import RackDeviceMapping
from core.models.rbac import Permission, Role, RolePermission, UserPermission, UserRole
from core.models.settings import (
    AgentsSetting,
    CacheSetting,
    CelerySetting,
    CheckMKSetting,
    GitSetting,
    NautobotDefault,
    NautobotSetting,
    Setting,
    SettingsMetadata,
)
from core.models.snapshots import (
    Snapshot,
    SnapshotCommand,
    SnapshotCommandTemplate,
    SnapshotResult,
)
from core.models.templates import Template, TemplateVersion
from core.models.users import User, UserProfile

__all__ = [
    # Users
    "User",
    "UserProfile",
    # RBAC
    "Role",
    "Permission",
    "RolePermission",
    "UserRole",
    "UserPermission",
    # Settings
    "Setting",
    "NautobotSetting",
    "GitSetting",
    "CheckMKSetting",
    "AgentsSetting",
    "CacheSetting",
    "NautobotDefault",
    "CelerySetting",
    "SettingsMetadata",
    # Credentials
    "Credential",
    "LoginCredential",
    "SNMPMapping",
    # Git
    "GitRepository",
    # Jobs
    "Job",
    "JobTemplate",
    "JobSchedule",
    "JobRun",
    # Compliance
    "ComplianceRule",
    "ComplianceCheck",
    "RegexPattern",
    # NB2CMK
    "NB2CMKSync",
    "NB2CMKJob",
    "NB2CMKJobResult",
    # Templates
    "Template",
    "TemplateVersion",
    # Inventory
    "Inventory",
    # Snapshots
    "SnapshotCommandTemplate",
    "SnapshotCommand",
    "Snapshot",
    "SnapshotResult",
    # Audit
    "AuditLog",
    # Agents
    "CockpitAgentCommand",
    # Rack
    "RackDeviceMapping",
    # Client data
    "ClientIpAddress",
    "ClientMacAddress",
    "ClientHostname",
]
