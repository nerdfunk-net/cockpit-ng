# Audit Log Usage Guide

The `audit_logs` table has been added to track user activities and system events.

## Table Structure

```sql
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,          -- Username or "system"
    user_id INTEGER REFERENCES users(id),    -- Optional FK to users table
    event_type VARCHAR(100) NOT NULL,        -- Type: authentication, onboarding, etc.
    message TEXT NOT NULL,                   -- Log message
    ip_address VARCHAR(45),                  -- IP address (IPv4/IPv6)
    resource_type VARCHAR(100),              -- Resource type: device, credential, etc.
    resource_id VARCHAR(255),                -- ID of affected resource
    resource_name VARCHAR(255),              -- Name of affected resource
    severity VARCHAR(20) DEFAULT 'info',     -- Severity: info, warning, error, critical
    metadata TEXT,                           -- JSON for additional context
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Example Usage in Backend

### 1. Create Repository (if not exists)

```python
# backend/repositories/audit_log_repository.py
from core.database import get_db_session
from core.models import AuditLog
from sqlalchemy.orm import Session
from typing import Optional, List
import json


class AuditLogRepository:
    """Repository for audit log operations."""

    def create_log(
        self,
        username: str,
        event_type: str,
        message: str,
        user_id: Optional[int] = None,
        ip_address: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        resource_name: Optional[str] = None,
        severity: str = "info",
        metadata: Optional[dict] = None,
        db: Session = None
    ) -> AuditLog:
        """Create a new audit log entry."""
        should_close = False
        if db is None:
            db = get_db_session()
            should_close = True

        try:
            log_entry = AuditLog(
                username=username,
                user_id=user_id,
                event_type=event_type,
                message=message,
                ip_address=ip_address,
                resource_type=resource_type,
                resource_id=resource_id,
                resource_name=resource_name,
                severity=severity,
                metadata=json.dumps(metadata) if metadata else None,
            )
            db.add(log_entry)
            db.commit()
            db.refresh(log_entry)
            return log_entry
        finally:
            if should_close:
                db.close()

    def get_logs(
        self,
        username: Optional[str] = None,
        event_type: Optional[str] = None,
        severity: Optional[str] = None,
        limit: int = 100,
        db: Session = None
    ) -> List[AuditLog]:
        """Retrieve audit logs with optional filtering."""
        should_close = False
        if db is None:
            db = get_db_session()
            should_close = True

        try:
            query = db.query(AuditLog)

            if username:
                query = query.filter(AuditLog.username == username)
            if event_type:
                query = query.filter(AuditLog.event_type == event_type)
            if severity:
                query = query.filter(AuditLog.severity == severity)

            return query.order_by(AuditLog.created_at.desc()).limit(limit).all()
        finally:
            if should_close:
                db.close()


audit_log_repo = AuditLogRepository()
```

### 2. Helper Function for Quick Logging

```python
# backend/utils/audit_logger.py
from repositories.audit_log_repository import audit_log_repo
from typing import Optional


def log_auth_event(
    username: str,
    action: str,  # "login", "logout", "login_failed"
    ip_address: Optional[str] = None,
    user_id: Optional[int] = None,
    success: bool = True
):
    """Log authentication events."""
    severity = "info" if success else "warning"
    message = f"User {action}"

    audit_log_repo.create_log(
        username=username,
        user_id=user_id,
        event_type="authentication",
        message=message,
        ip_address=ip_address,
        severity=severity,
    )


def log_device_onboarding(
    username: str,
    device_name: str,
    device_id: Optional[str] = None,
    user_id: Optional[int] = None,
    success: bool = True,
    error_message: Optional[str] = None
):
    """Log device onboarding events."""
    severity = "info" if success else "error"
    message = f"Device '{device_name}' onboarded to Nautobot"

    if not success and error_message:
        message += f" - Error: {error_message}"

    audit_log_repo.create_log(
        username=username,
        user_id=user_id,
        event_type="onboarding",
        message=message,
        resource_type="device",
        resource_id=device_id,
        resource_name=device_name,
        severity=severity,
    )


def log_system_event(
    message: str,
    event_type: str = "system",
    severity: str = "info",
    metadata: Optional[dict] = None
):
    """Log system events."""
    audit_log_repo.create_log(
        username="system",
        event_type=event_type,
        message=message,
        severity=severity,
        metadata=metadata,
    )
```

### 3. Usage in Routers

```python
# In your authentication router
from utils.audit_logger import log_auth_event
from fastapi import Request

@router.post("/login")
async def login(credentials: LoginRequest, request: Request):
    user = authenticate_user(credentials.username, credentials.password)

    if user:
        # Log successful login
        log_auth_event(
            username=credentials.username,
            action="login",
            ip_address=request.client.host,
            user_id=user.id,
            success=True
        )
        return {"token": create_token(user)}
    else:
        # Log failed login
        log_auth_event(
            username=credentials.username,
            action="login_failed",
            ip_address=request.client.host,
            success=False
        )
        raise HTTPException(status_code=401, detail="Invalid credentials")


@router.post("/logout")
async def logout(user: dict = Depends(verify_token), request: Request = None):
    # Log logout
    log_auth_event(
        username=user["sub"],
        action="logout",
        ip_address=request.client.host if request else None,
        user_id=user.get("user_id"),
        success=True
    )
    return {"message": "Logged out successfully"}
```

```python
# In device onboarding router
from utils.audit_logger import log_device_onboarding

@router.post("/onboard-device")
async def onboard_device(device_data: DeviceOnboardRequest, user: dict = Depends(verify_token)):
    try:
        # Onboard device to Nautobot
        device = nautobot_service.create_device(device_data)

        # Log successful onboarding
        log_device_onboarding(
            username=user["sub"],
            device_name=device_data.name,
            device_id=device.get("id"),
            user_id=user.get("user_id"),
            success=True
        )

        return {"message": "Device onboarded successfully", "device": device}
    except Exception as e:
        # Log failed onboarding
        log_device_onboarding(
            username=user["sub"],
            device_name=device_data.name,
            user_id=user.get("user_id"),
            success=False,
            error_message=str(e)
        )
        raise
```

### 4. System Events

```python
# In background tasks or scheduled jobs
from utils.audit_logger import log_system_event

def backup_devices_task():
    try:
        result = perform_backup()

        log_system_event(
            message=f"Backup completed: {result['success_count']} devices backed up",
            event_type="backup",
            severity="info",
            metadata={
                "success_count": result["success_count"],
                "failed_count": result["failed_count"],
                "total_devices": result["total_devices"]
            }
        )
    except Exception as e:
        log_system_event(
            message=f"Backup failed: {str(e)}",
            event_type="backup",
            severity="error"
        )
```

## Event Types

Recommended event types:
- `authentication` - Login, logout, auth failures
- `onboarding` - Device onboarding
- `device_management` - Device updates, deletions
- `credential_management` - Credential CRUD operations
- `job_execution` - Job template runs
- `configuration_change` - Settings updates
- `backup` - Backup operations
- `sync` - Sync operations (git, nautobot, checkmk)
- `system` - System events

## Severity Levels

- `info` - Normal operations
- `warning` - Potential issues
- `error` - Errors that need attention
- `critical` - Critical failures

## Querying Logs

```python
# Get all logs for a user
logs = audit_log_repo.get_logs(username="admin", limit=100)

# Get authentication events
auth_logs = audit_log_repo.get_logs(event_type="authentication", limit=50)

# Get critical events
critical_logs = audit_log_repo.get_logs(severity="critical", limit=50)
```

## Next Steps

1. Create the audit log repository (`backend/repositories/audit_log_repository.py`)
2. Create the helper utilities (`backend/utils/audit_logger.py`)
3. Add logging calls to existing routers (auth, onboarding, etc.)
4. Create a router to view audit logs (`backend/routers/audit_logs.py`)
5. Create frontend UI to display audit logs
