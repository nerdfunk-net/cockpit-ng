# CLAUDE.md Documentation TODO

This file tracks missing topics and improvements needed for CLAUDE.md to make it more comprehensive for feature implementation.

## Missing Topics

### 1. Device Onboarding Workflow
- [ ] Document the actual onboarding process/workflow
- [ ] Define required data structures for device registration
- [ ] Explain integration with Nautobot for device discovery
- [ ] Document validation rules for device data

### 2. Network Automation Details
- [ ] Document Netmiko connection patterns and error handling
- [ ] Explain Ansible playbook structure and execution
- [ ] Document template rendering workflow (Jinja2)
- [ ] Explain credential encryption/decryption mechanism
- [ ] Document Git repository management for configs

### 3. CheckMK Integration
- [ ] Document Nautobot-to-CheckMK sync logic
- [ ] Explain device normalization rules
- [ ] Document folder structure mapping
- [ ] Explain background sync scheduling details
- [ ] Document error handling for failed syncs

### 4. Configuration Management
- [ ] Document backup strategies and retention policies
- [ ] Explain configuration comparison algorithms
- [ ] Document file versioning with Git
- [ ] Document rollback procedures
- [ ] Explain config validation before deployment

### 5. Job Scheduling & Background Tasks
- [ ] Document APScheduler configuration
- [ ] Explain job persistence and recovery
- [ ] Document monitoring job status
- [ ] Explain handling long-running operations
- [ ] Document job cancellation/retry logic

### 6. Cache Strategy
- [ ] Document what data is cached and why
- [ ] Explain cache invalidation rules
- [ ] Document TTL configurations
- [ ] Clarify Redis vs in-memory cache (if applicable)

### 7. Network Scanning
- [ ] Document SNMP scanning process
- [ ] Explain device discovery mechanisms
- [ ] Document IP range handling
- [ ] Explain scan result processing

### 8. WebSocket/Real-time Updates
- [ ] Clarify whether real-time updates exist
- [ ] Document SSE or WebSocket implementation (if any)
- [ ] Explain live command output streaming (if implemented)

### 9. Data Models & Schemas
- [ ] Add key Pydantic model examples
- [ ] Add TypeScript interfaces for frontend
- [ ] Create database relationship diagrams
- [ ] Add API request/response examples

### 10. Deployment & Production
- [ ] Document Docker/containerization setup
- [ ] Add reverse proxy configuration (nginx/caddy)
- [ ] Document SSL/TLS certificate setup
- [ ] Add environment-specific configs
- [ ] Document backup and restore procedures
- [ ] Document scaling considerations

### 11. Monitoring & Observability
- [ ] Document application metrics/monitoring
- [ ] Detail health check implementation
- [ ] Document error tracking (Sentry, etc.)
- [ ] Add performance monitoring details
- [ ] Document audit logging

### 12. Migration & Upgrades
- [ ] Document database migration strategy
- [ ] Add version upgrade procedures
- [ ] Explain breaking changes handling
- [ ] Document data migration scripts

### 13. Common Troubleshooting
- [ ] Add common error scenarios
- [ ] Document debug mode usage
- [ ] Add log analysis tips
- [ ] Document performance debugging

### 14. Development Tools
- [ ] Document VS Code configurations/extensions
- [ ] Add debugging setup (backend & frontend)
- [ ] Document Git workflow/branching strategy
- [ ] Add code review checklist

## High Priority Additions

### 1. Common Workflows Section
Add end-to-end examples:
- [ ] Adding a new device (frontend → backend → Nautobot)
- [ ] Running a command via Netmiko
- [ ] Backing up configurations
- [ ] Creating a user with permissions

### 2. API Reference Section
- [ ] Standard response formats
- [ ] Common error codes
- [ ] Pagination patterns
- [ ] Filtering/sorting examples

### 3. Data Models Section
- [ ] Key Pydantic models
- [ ] TypeScript interfaces
- [ ] Database schemas with relationships

### 4. Troubleshooting Guide
- [ ] Common errors and solutions
- [ ] Debug mode usage
- [ ] Log locations and formats

### 5. Deployment Guide
- [ ] Production setup
- [ ] Docker configuration
- [ ] Reverse proxy examples
- [ ] SSL setup

## Medium Priority Additions

- [ ] Network automation workflow details
- [ ] Background job patterns
- [ ] Cache strategy documentation
- [ ] Real-time update mechanisms (if any)
- [ ] Data flow diagrams (frontend → proxy → backend → database)
- [ ] State management examples (Zustand patterns)
- [ ] Form handling examples (validation, submission, error handling)
- [ ] Integration patterns with Nautobot/CheckMK
- [ ] Event handling patterns (pub/sub or event-driven, if any)

## Current Assessment

**Strengths:**
- ✅ Excellent architecture overview
- ✅ Comprehensive file structure
- ✅ Well-documented authentication patterns
- ✅ Clear extension points
- ✅ Critical React best practices
- ✅ Practical code examples

**Gaps:**
- ⚠️ Missing end-to-end data flow diagrams
- ⚠️ Needs more Zustand store usage patterns
- ⚠️ No form handling examples
- ⚠️ Missing standard API response formats
- ⚠️ Lacks integration pattern examples
- ⚠️ Missing event handling patterns

**Overall Rating:** 8/10 for implementing new features

The document excels at architectural guidance and basic feature additions but would benefit from more real-world examples, data model documentation, and operational details.
