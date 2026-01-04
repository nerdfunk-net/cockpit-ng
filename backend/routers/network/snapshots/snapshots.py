"""
Router for snapshot execution and comparison.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
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
