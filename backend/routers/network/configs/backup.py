"""
Backup router for configuration backup operations.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel

from core.database import get_db
from core.auth import verify_token, require_permission
from services.network.configs.backup_service import BackupService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/backup", tags=["network-backup"])

backup_service = BackupService()


class BackupTrigger(BaseModel):
    """Request model for triggering a backup."""

    device_id: str


class BulkBackupTrigger(BaseModel):
    """Request model for triggering bulk backup."""

    device_ids: list[str]


@router.get("/devices", dependencies=[Depends(require_permission("network", "read"))])
async def get_backup_devices(
    name: Optional[str] = Query(None, description="Filter by device name"),
    role: Optional[str] = Query(None, description="Filter by role"),
    location: Optional[str] = Query(None, description="Filter by location"),
    device_type: Optional[str] = Query(None, description="Filter by device type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    last_backup_date: Optional[str] = Query(
        None, description="Filter by last backup date"
    ),
    date_comparison: Optional[str] = Query(
        None, description="Date comparison operator (lte, lt)"
    ),
    sort_by: Optional[str] = Query(None, description="Column to sort by"),
    sort_order: str = Query("asc", description="Sort order (asc, desc)"),
    limit: int = Query(50, ge=1, le=200, description="Page size"),
    offset: int = Query(0, ge=0, description="Page offset"),
    db: Session = Depends(get_db),
    user: dict = Depends(verify_token),
):
    """
    Get devices with backup status, filtering, sorting, and pagination.

    This endpoint returns devices from Nautobot with their backup status
    and supports filtering by various criteria including last backup date.

    Query Parameters:
        - name: Filter devices by name (partial match)
        - role: Filter by device role
        - location: Filter by location
        - device_type: Filter by device type
        - status: Filter by status
        - last_backup_date: ISO date string for backup date filtering
        - date_comparison: Comparison operator (lte = less than or equal, lt = less than)
        - sort_by: Column to sort by (name, last_backup)
        - sort_order: Sort order (asc, desc)
        - limit: Number of results per page (1-200)
        - offset: Offset for pagination

    Returns:
        Dict with:
        - devices: List of device objects with backup status
        - total: Total count of matching devices
        - limit: Page size
        - offset: Current offset
    """
    try:
        filters = {
            "name": name,
            "role": role,
            "location": location,
            "device_type": device_type,
            "status": status,
            "last_backup_date": last_backup_date,
            "date_comparison": date_comparison,
        }

        pagination = {"limit": limit, "offset": offset}
        sorting = {"column": sort_by, "order": sort_order}

        result = await backup_service.get_devices_for_backup(
            db, filters, pagination, sorting
        )

        return result

    except Exception as e:
        logger.error(f"Error getting backup devices: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trigger", dependencies=[Depends(require_permission("network", "write"))])
async def trigger_backup(
    payload: BackupTrigger,
    db: Session = Depends(get_db),
    user: dict = Depends(verify_token),
):
    """
    Trigger backup for a single device.

    Triggers a Celery task to backup the device configuration.
    The task will connect to the device, retrieve the configuration,
    and store it in the configured Git repository.

    Request Body:
        - device_id: ID of the device to backup

    Returns:
        Dict with:
        - task_id: Celery task ID for tracking
        - status: Initial status (queued)
        - device_id: Device ID that was backed up
    """
    try:
        result = await backup_service.trigger_device_backup(
            db, payload.device_id, user["user_id"]
        )
        return result

    except ValueError as e:
        logger.error(f"Validation error triggering backup: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error triggering backup: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/trigger-bulk", dependencies=[Depends(require_permission("network", "write"))]
)
async def trigger_bulk_backup(
    payload: BulkBackupTrigger,
    db: Session = Depends(get_db),
    user: dict = Depends(verify_token),
):
    """
    Trigger backup for multiple devices.

    Triggers a Celery task to backup configurations for multiple devices.
    This is more efficient than triggering individual backups.

    Request Body:
        - device_ids: List of device IDs to backup

    Returns:
        Dict with:
        - task_id: Celery task ID for tracking
        - status: Initial status (queued)
        - device_count: Number of devices in the backup job
    """
    try:
        if not payload.device_ids:
            raise HTTPException(status_code=400, detail="No device IDs provided")

        result = await backup_service.trigger_bulk_backup(
            db, payload.device_ids, user["user_id"]
        )
        return result

    except ValueError as e:
        logger.error(f"Validation error triggering bulk backup: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error triggering bulk backup: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/history/{device_id}",
    dependencies=[Depends(require_permission("network", "read"))],
)
async def get_backup_history(
    device_id: str,
    limit: int = Query(50, ge=1, le=200, description="Maximum history entries"),
    db: Session = Depends(get_db),
    user: dict = Depends(verify_token),
):
    """
    Get backup history for a device.

    Retrieves the Git commit history for device configuration backups.
    Each entry represents a successful backup with timestamp, size, and commit hash.

    Path Parameters:
        - device_id: Device ID to get history for

    Query Parameters:
        - limit: Maximum number of history entries (1-200)

    Returns:
        List of backup history entries with:
        - id: Commit hash
        - date: ISO timestamp of backup
        - size: Backup file size
        - status: Backup status (success/failed)
        - commit_hash: Short commit hash
        - message: Commit message
    """
    try:
        history = await backup_service.get_backup_history(db, device_id, limit)
        return history

    except Exception as e:
        logger.error(f"Error getting backup history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/download/{device_id}/{backup_id}",
    dependencies=[Depends(require_permission("network", "read"))],
)
async def download_backup(
    device_id: str,
    backup_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(verify_token),
):
    """
    Download a specific backup file.

    Retrieves the backup file content from the Git repository
    at the specified commit.

    Path Parameters:
        - device_id: Device ID
        - backup_id: Backup commit hash

    Returns:
        File content as plain text
    """
    try:
        content = await backup_service.download_backup(db, device_id, backup_id)

        # Return as plain text file
        return Response(
            content=content,
            media_type="text/plain",
            headers={
                "Content-Disposition": f"attachment; filename={device_id}_backup_{backup_id[:8]}.txt"
            },
        )

    except ValueError as e:
        logger.error(f"Backup not found: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error downloading backup: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/restore/{device_id}/{backup_id}",
    dependencies=[Depends(require_permission("network", "write"))],
)
async def restore_backup(
    device_id: str,
    backup_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(verify_token),
):
    """
    Trigger restore job for a backup.

    Creates a job to restore a device configuration from a previous backup.
    This will push the backed-up configuration to the device.

    Path Parameters:
        - device_id: Device ID
        - backup_id: Backup commit hash to restore

    Returns:
        Dict with:
        - task_id: Celery task ID for tracking
        - status: Initial status
        - message: Status message
    """
    try:
        result = await backup_service.restore_backup(
            db, device_id, backup_id, user["user_id"]
        )
        return result

    except ValueError as e:
        logger.error(f"Validation error restoring backup: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error restoring backup: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
