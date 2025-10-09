# Backend Database Structure

This document provides a comprehensive overview of the database architecture used in the cockpit-ng backend application.

## Overview

The cockpit-ng backend uses SQLite databases to store various types of application data. The databases are organized by functional domain and stored in specific directories within the `data/` folder structure.

## Database Structure Table

| Database File | Location | Tables | Data Stored | Purpose |
|---------------|----------|--------|-------------|---------|
| **users.db** | `data/settings` | `users` | • User accounts (id, username, realname, email)<br/>• Encrypted passwords (bcrypt)<br/>• User permissions (bitwise flags)<br/>• Debug settings<br/>• Account status & timestamps | User authentication & management |
| **credentials.db** | `data/settings` | `credentials` | • SSH/TACACS/Generic/Token credentials<br/>• Encrypted passwords (Fernet encryption)<br/>• Credential names & usernames<br/>• Expiration dates<br/>• Source (general/private)<br/>• Owner information | Secure credential storage |
| **cockpit_settings.db** | `data/settings` | `settings`<br/>`user_profiles` | • Nautobot connection settings (URL, token, timeout)<br/>• Git repository settings (URL, branch, credentials)<br/>• CheckMK settings (URL, site, credentials)<br/>• Cache configuration<br/>• User profiles (realname, email, API keys) | Application configuration |
| **git_repositories.db** | `data/settings/` | `git_repositories` | • Repository definitions (name, URL, branch)<br/>• Categories (configs, templates, onboarding, inventory)<br/>• Credentials & SSL settings<br/>• Sync status & timestamps<br/>• Active/inactive status | Git repository management |
| **cockpit_templates.db** | `data/settings` | `templates`<br/>`template_versions` | • Template definitions (name, type, category)<br/>• Git-sourced templates (repo URL, path, branch)<br/>• File/WebEditor templates (content, filename)<br/>• Template variables & tags<br/>• Version history & change tracking | Template management system |
| **nb2cmk.db** | `data/settings` | `nb2cmk_jobs`<br/>`nb2cmk_device_results` | • Background job tracking (status, progress)<br/>• Device comparison results<br/>• Diff data & configurations<br/>• CheckMK sync status<br/>• Error messages & timestamps | Nautobot-to-CheckMK operations |
| **jobs.db** | `data/jobs/` | `jobs`<br/>`job_results` | • APScheduler job management<br/>• Network scan jobs<br/>• Device comparison/sync jobs<br/>• Job progress & status tracking<br/>• Per-device results & errors | General job management |
| **apscheduler_jobs.db** | `data/jobs` | APScheduler tables | • Scheduled job definitions<br/>• Job triggers & schedules<br/>• Job state & execution history | APScheduler persistence |

## Detailed Database Descriptions

### User Management (`users.db`)

**Location**: `data/settings/users.db`

This database handles all user authentication and authorization:

- **User Accounts**: Stores user credentials, profile information, and account metadata
- **Password Security**: Uses bcrypt hashing for secure password storage
- **Permissions System**: Implements bitwise permission flags:
  - `READ = 1`: Read access to resources
  - `WRITE = 2`: Write/modify access
  - `ADMIN = 4`: Administrative privileges
  - `DELETE = 8`: Delete permissions
  - `USER_MANAGE = 16`: User management capabilities
- **Debug Settings**: Per-user debug configuration
- **Account Status**: Active/inactive status tracking with timestamps

### Credential Management (`credentials.db`)

**Location**: `data/settings/credentials.db`

Secure storage for device and system credentials:

- **Credential Types**: SSH, TACACS, Generic, Token-based authentication
- **Encryption**: All passwords encrypted using Fernet (AES 128) with application SECRET_KEY
- **Ownership**: Credentials can be general (system-wide) or private (user-specific)
- **Metadata**: Names, usernames, expiration dates, and source tracking
- **Security**: Encrypted at rest with key rotation support

### Application Settings (`cockpit_settings.db`)

**Location**: `data/settings/cockpit_settings.db`

Central configuration storage:

- **External Integrations**: 
  - Nautobot connection settings (URL, API token, timeout)
  - CheckMK integration (URL, site name, credentials)
  - Git repository configurations
- **System Configuration**: Cache settings, logging levels, feature flags
- **User Profiles**: Extended user information including API keys and preferences

### Git Repository Management (`git_repositories.db`)

**Location**: `data/settings/git_repositories.db`

Git integration and repository tracking:

- **Repository Definitions**: URLs, branches, authentication settings
- **Categories**: Organization by purpose (configs, templates, onboarding, inventory)
- **Sync Management**: Status tracking, timestamps, error handling
- **SSL Configuration**: Certificate validation settings
- **Activation Status**: Enable/disable repositories without deletion

### Template System (`cockpit_templates.db`)

**Location**: `data/settings/cockpit_templates.db`

Template management and versioning:

- **Template Types**: 
  - Git-sourced templates (linked to repositories)
  - File-based templates (direct file content)
  - WebEditor templates (inline editing)
- **Metadata**: Names, categories, descriptions, variable definitions
- **Version Control**: Template change tracking and history
- **Content Storage**: Template content and associated files

### Nautobot-CheckMK Operations (`nb2cmk.db`)

**Location**: `data/settings/nb2cmk.db`

Specialized database for Nautobot to CheckMK synchronization:

- **Job Tracking**: Background operation status and progress
- **Device Results**: Per-device comparison and sync results
- **Configuration Diffs**: Change tracking between systems
- **Error Handling**: Detailed error messages and troubleshooting data
- **Sync History**: Historical sync operations and outcomes

### Job Management (`jobs.db`)

**Location**: `data/jobs/jobs.db`

General job execution and tracking:

- **Job Types**: Network scans, device discovery, bulk operations
- **Progress Tracking**: Real-time status updates and completion percentages
- **Result Storage**: Per-device and per-operation results
- **Error Management**: Detailed error logging and recovery information
- **Performance Metrics**: Execution times and resource usage

### APScheduler Persistence (`apscheduler_jobs.db`)

**Location**: `data/jobs/apscheduler_jobs.db`

APScheduler framework persistence:

- **Job Scheduling**: Cron-like job definitions and triggers
- **Execution State**: Job run history and status tracking
- **Failure Handling**: Retry logic and failure recovery
- **Performance**: Job execution statistics and monitoring

## Security Features

### Encryption
- **User Passwords**: Secured using bcrypt hashing with salt
- **Device Credentials**: Encrypted with Fernet (AES 128) symmetric encryption
- **API Tokens**: Secure storage for external service authentication
- **Secret Management**: Centralized SECRET_KEY for encryption operations

### Access Control
- **Permission System**: Granular bitwise permission flags
- **User Isolation**: Private credentials and personal settings
- **Authentication**: Session-based authentication with secure token handling
- **Authorization**: Role-based access control for different operations

### Data Integrity
- **Foreign Key Constraints**: Referential integrity between related tables
- **Transaction Safety**: ACID compliance for data consistency
- **Backup Support**: SQLite database files support standard backup procedures
- **Migration Support**: Schema versioning and upgrade procedures

## Storage Architecture

### Directory Structure
```
data/
├── settings/           # Configuration and metadata databases
│   ├── users.db
│   ├── credentials.db
│   ├── cockpit_settings.db
│   ├── git_repositories.db
│   ├── cockpit_templates.db
│   └── nb2cmk.db
├── jobs/              # Job management and scheduling
│   ├── jobs.db
│   └── apscheduler_jobs.db
├── templates/         # Template file storage
└── git/              # Git repository clones
```

### Data Relationships

1. **Users → Credentials**: Users can own private credentials
2. **Git Repositories → Credentials**: Repositories reference credentials for authentication
3. **Templates → Git Repositories**: Templates can source content from Git repositories
4. **Jobs → Users**: Jobs track the initiating user for auditing
5. **Settings → All**: Central configuration affects all system operations

## Maintenance and Monitoring

### Database Health
- **Size Monitoring**: Track database growth and performance
- **Index Optimization**: Regular analysis of query performance
- **Cleanup Procedures**: Archival of old jobs and results
- **Backup Strategies**: Regular database backups and recovery testing

### Performance Considerations
- **Connection Pooling**: Efficient database connection management
- **Query Optimization**: Indexed columns for frequent queries
- **Batch Operations**: Bulk inserts and updates for large datasets
- **Caching**: In-memory caching for frequently accessed configuration

## Development Guidelines

### Database Access
- Use the provided manager classes (`UserDBManager`, `CredentialsManager`, etc.)
- Always use parameterized queries to prevent SQL injection
- Handle database exceptions gracefully with appropriate error messages
- Close database connections properly to prevent resource leaks

### Schema Changes
- Update model definitions in the `models/` directory
- Create migration scripts for schema changes
- Test migrations with sample data
- Update this documentation when adding new databases or tables

### Security Best Practices
- Never store plaintext passwords or sensitive credentials
- Use appropriate encryption for different data types
- Implement proper access controls for database operations
- Regular security audits of stored data and access patterns

---

**Last Updated**: September 19, 2025
**Version**: 1.0
**Author**: AI Assistant Analysis of cockpit-ng Backend