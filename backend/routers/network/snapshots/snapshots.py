"""
Router for snapshot execution and comparison.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from core.auth import require_permission
from services.network.snapshots import (
    SnapshotExecutionService,
    SnapshotComparisonService,
)
from models.snapshots import (
    SnapshotExecuteRequest,
    SnapshotResponse,
    SnapshotListResponse,
    SnapshotCompareRequest,
    SnapshotCompareResponse,
)

router = APIRouter(prefix="/api/network/snapshots", tags=["snapshots"])


@router.post(
    "/execute",
    response_model=SnapshotResponse,
    status_code=status.HTTP_201_CREATED,
)
async def execute_snapshot(
    request: SnapshotExecuteRequest,
    current_user: dict = Depends(require_permission("snapshots", "write")),
):
    """
    Execute a snapshot on multiple devices.

    Connects to devices, executes commands, parses with TextFSM,
    and stores results in Git repository.

    Requires: snapshots:write permission
    """
    service = SnapshotExecutionService()
    try:
        return await service.execute_snapshot(request, current_user["username"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Execution failed: {str(e)}")


@router.get("", response_model=List[SnapshotListResponse])
async def list_snapshots(
    limit: int = 100,
    current_user: dict = Depends(require_permission("snapshots", "read")),
):
    """
    List all snapshots (most recent first).

    Requires: snapshots:read permission
    """
    service = SnapshotExecutionService()
    return service.list_snapshots(limit=limit)


@router.get("/{snapshot_id}", response_model=SnapshotResponse)
async def get_snapshot(
    snapshot_id: int,
    current_user: dict = Depends(require_permission("snapshots", "read")),
):
    """
    Get a specific snapshot by ID with all results.

    Requires: snapshots:read permission
    """
    service = SnapshotExecutionService()
    snapshot = service.get_snapshot(snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return snapshot


@router.post("/compare", response_model=SnapshotCompareResponse)
async def compare_snapshots(
    request: SnapshotCompareRequest,
    current_user: dict = Depends(require_permission("snapshots", "read")),
):
    """
    Compare two snapshots to identify differences.

    Returns detailed diff of parsed data for each device.

    Requires: snapshots:read permission
    """
    service = SnapshotComparisonService()
    try:
        return service.compare_snapshots(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")


@router.delete("/{snapshot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_snapshot_db_only(
    snapshot_id: int,
    current_user: dict = Depends(require_permission("snapshots", "delete")),
):
    """
    Delete snapshot from database only (files remain in Git).

    Requires: snapshots:delete permission
    """
    service = SnapshotExecutionService()
    success = service.delete_snapshot_db_only(snapshot_id)
    if not success:
        raise HTTPException(status_code=404, detail="Snapshot not found")


@router.delete("/{snapshot_id}/files", status_code=status.HTTP_204_NO_CONTENT)
async def delete_snapshot_with_files(
    snapshot_id: int,
    current_user: dict = Depends(require_permission("snapshots", "delete")),
):
    """
    Delete snapshot from database AND remove all files from Git repository.

    Requires: snapshots:delete permission
    """
    service = SnapshotExecutionService()
    try:
        success = service.delete_snapshot_with_files(snapshot_id)
        if not success:
            raise HTTPException(status_code=404, detail="Snapshot not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete snapshot: {str(e)}"
        )
