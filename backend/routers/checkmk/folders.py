"""
CheckMK folders router — 8 endpoints.

Route ordering note: PUT /folders/bulk-update is registered before
PUT /folders/{folder_path} to prevent FastAPI capturing "bulk-update" as folder_path.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from dependencies import get_checkmk_folder_service
from models.checkmk import (
    CheckMKFolderCreateRequest,
    CheckMKFolderUpdateRequest,
    CheckMKFolderMoveRequest,
    CheckMKFolderBulkUpdateRequest,
    CheckMKFolderListResponse,
    CheckMKOperationResponse,
)
from services.checkmk.exceptions import CheckMKAPIError, CheckMKClientError

logger = logging.getLogger(__name__)
router = APIRouter(tags=["checkmk"])


@router.get("/folders", response_model=CheckMKFolderListResponse)
async def get_all_folders(
    parent: str = None,
    recursive: bool = False,
    show_hosts: bool = False,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_folder_service),
):
    """Get all folders."""
    try:
        result = await service.get_all_folders(
            parent=parent, recursive=recursive, show_hosts=show_hosts
        )
        return CheckMKFolderListResponse(
            folders=result["folders"], total=result["total"]
        )
    except CheckMKAPIError as e:
        logger.error(
            "CheckMK API error getting folders: status=%s, parent=%s", e.status_code, parent
        )
        if e.status_code == 400:
            checkmk_detail = "Invalid folder request"
            if hasattr(e, "response_data") and e.response_data:
                rd = e.response_data
                if "fields" in rd and "parent" in rd["fields"]:
                    errors = rd["fields"]["parent"]
                    if errors:
                        checkmk_detail = errors[0]
                elif "detail" in rd:
                    checkmk_detail = rd["detail"]
            if "could not be found" in checkmk_detail.lower():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail=checkmk_detail
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=checkmk_detail
            )
        elif e.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent folder '{parent}' not found in CheckMK",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"CheckMK API error: {str(e)}",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting folders: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get folders: {str(e)}",
        )


# Static PUT path before parameterised PUT /{folder_path}

@router.put("/folders/bulk-update", response_model=CheckMKOperationResponse)
async def bulk_update_folders(
    request: CheckMKFolderBulkUpdateRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_folder_service),
):
    """Update multiple folders in one request."""
    try:
        result = await service.bulk_update_folders(request.entries)
        return CheckMKOperationResponse(
            success=True,
            message=f"Updated {len(request.entries)} folders successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error bulk updating folders: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk update folders: {str(e)}",
        )


@router.post("/folders", response_model=CheckMKOperationResponse)
async def create_folder(
    request: CheckMKFolderCreateRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_folder_service),
):
    """Create new folder."""
    try:
        result = await service.create_folder(request)
        return CheckMKOperationResponse(
            success=True,
            message=f"Created folder {request.name} successfully",
            data=result,
        )
    except CheckMKAPIError as e:
        detail = str(e)
        validation_errors = []
        if hasattr(e, "response_data") and e.response_data and isinstance(e.response_data, dict):
            rd = e.response_data
            if "detail" in rd:
                detail = rd["detail"]
            for field, errors in rd.get("fields", {}).items():
                if errors is not None:
                    if isinstance(errors, list):
                        validation_errors.extend(f"{field}: {err}" for err in errors)
                    else:
                        validation_errors.append(f"{field}: {errors}")
            for field, err in rd.get("ext", {}).items():
                if err is not None:
                    validation_errors.append(f"ext.{field}: {err}")
        if validation_errors:
            detail = f"{detail} - {'; '.join(validation_errors)}"
        logger.error("CheckMK folder creation failed: %s", detail)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST if e.status_code == 400 else status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to create folder: {detail}",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating folder %s: %s", request.name, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create folder {request.name}: {str(e)}",
        )


@router.get("/folders/{folder_path}", response_model=CheckMKOperationResponse)
async def get_folder(
    folder_path: str,
    show_hosts: bool = False,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_folder_service),
):
    """Get specific folder."""
    try:
        result = await service.get_folder(folder_path, show_hosts=show_hosts)
        return CheckMKOperationResponse(
            success=True,
            message=f"Retrieved folder {folder_path} successfully",
            data=result,
        )
    except CheckMKAPIError as e:
        if e.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Folder '{folder_path}' not found in CheckMK",
            )
        logger.error(
            "CheckMK API error getting folder %s: %s (status: %s)",
            folder_path, str(e), e.status_code,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"CheckMK API error: {str(e)}",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting folder %s: %s", folder_path, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get folder {folder_path}: {str(e)}",
        )


@router.put("/folders/{folder_path}", response_model=CheckMKOperationResponse)
async def update_folder(
    folder_path: str,
    request: CheckMKFolderUpdateRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_folder_service),
):
    """Update existing folder."""
    try:
        result = await service.update_folder(folder_path, request)
        return CheckMKOperationResponse(
            success=True,
            message=f"Updated folder {folder_path} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating folder %s: %s", folder_path, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update folder {folder_path}: {str(e)}",
        )


@router.delete("/folders/{folder_path}", response_model=CheckMKOperationResponse)
async def delete_folder(
    folder_path: str,
    delete_mode: str = "recursive",
    current_user: dict = Depends(require_permission("checkmk.devices", "delete")),
    service=Depends(get_checkmk_folder_service),
):
    """Delete folder."""
    try:
        await service.delete_folder(folder_path, delete_mode=delete_mode)
        return CheckMKOperationResponse(
            success=True, message=f"Deleted folder {folder_path} successfully"
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting folder %s: %s", folder_path, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete folder {folder_path}: {str(e)}",
        )


@router.post("/folders/{folder_path}/move", response_model=CheckMKOperationResponse)
async def move_folder(
    folder_path: str,
    request: CheckMKFolderMoveRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_folder_service),
):
    """Move folder to different location."""
    try:
        result = await service.move_folder(folder_path, request.destination)
        return CheckMKOperationResponse(
            success=True,
            message=f"Moved folder {folder_path} to {request.destination} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error moving folder %s: %s", folder_path, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to move folder {folder_path}: {str(e)}",
        )


@router.get("/folders/{folder_path}/hosts", response_model=CheckMKOperationResponse)
async def get_hosts_in_folder(
    folder_path: str,
    effective_attributes: bool = False,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_folder_service),
):
    """Get all hosts in a specific folder."""
    try:
        result = await service.get_hosts_in_folder(
            folder_path, effective_attributes=effective_attributes
        )
        return CheckMKOperationResponse(
            success=True,
            message=f"Retrieved hosts in folder {folder_path} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting hosts in folder %s: %s", folder_path, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get hosts in folder {folder_path}: {str(e)}",
        )
