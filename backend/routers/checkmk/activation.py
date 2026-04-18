"""
CheckMK activation router — 6 endpoints.

IMPORTANT: GET /activation/running is registered BEFORE GET /activation/{activation_id}
to fix a route-ordering bug present in the original main.py where the static path
"/activation/running" was unreachable because the parameterised path matched first.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from dependencies import get_checkmk_activation_service
from models.checkmk import CheckMKActivateChangesRequest, CheckMKOperationResponse
from services.checkmk.exceptions import CheckMKClientError

logger = logging.getLogger(__name__)
router = APIRouter(tags=["checkmk"])


@router.get("/changes/pending", response_model=CheckMKOperationResponse)
async def get_pending_changes(
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_activation_service),
):
    """Get pending configuration changes."""
    try:
        result = await service.get_pending_changes()
        return CheckMKOperationResponse(
            success=True, message="Retrieved pending changes successfully", data=result
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting pending changes: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get pending changes: {str(e)}",
        )


@router.post("/changes/activate", response_model=CheckMKOperationResponse)
async def activate_changes(
    request: CheckMKActivateChangesRequest = CheckMKActivateChangesRequest(),
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_activation_service),
):
    """Activate ALL pending configuration changes using wildcard ETag."""
    try:
        result = await service.activate_changes(request, etag="*")
        return CheckMKOperationResponse(
            success=True,
            message="Activated all configuration changes successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error activating changes: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to activate changes: {str(e)}",
        )


@router.post("/changes/activate/{etag}", response_model=CheckMKOperationResponse)
async def activate_changes_with_etag(
    etag: str,
    request: CheckMKActivateChangesRequest = CheckMKActivateChangesRequest(),
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_activation_service),
):
    """Activate pending configuration changes using specific ETag."""
    try:
        result = await service.activate_changes_with_etag(etag, request)
        return CheckMKOperationResponse(
            success=True,
            message=f"Activated configuration changes with ETag {etag} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error activating changes with ETag %s: %s", etag, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to activate changes with ETag {etag}: {str(e)}",
        )


# Static path MUST come before parameterised path (fixes main.py route ordering bug)

@router.get("/activation/running", response_model=CheckMKOperationResponse)
async def get_running_activations(
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_activation_service),
):
    """Get currently running activations."""
    try:
        result = await service.get_running_activations()
        return CheckMKOperationResponse(
            success=True,
            message="Retrieved running activations successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting running activations: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get running activations: {str(e)}",
        )


@router.get("/activation/{activation_id}", response_model=CheckMKOperationResponse)
async def get_activation_status(
    activation_id: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_activation_service),
):
    """Get activation status."""
    try:
        result = await service.get_activation_status(activation_id)
        return CheckMKOperationResponse(
            success=True,
            message=f"Retrieved activation status for {activation_id} successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting activation status for %s: %s", activation_id, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get activation status for {activation_id}: {str(e)}",
        )


@router.post(
    "/activation/{activation_id}/wait", response_model=CheckMKOperationResponse
)
async def wait_for_activation_completion(
    activation_id: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
    service=Depends(get_checkmk_activation_service),
):
    """Wait for activation completion."""
    try:
        result = await service.wait_for_activation_completion(activation_id)
        return CheckMKOperationResponse(
            success=True,
            message=f"Activation {activation_id} completed successfully",
            data=result,
        )
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error waiting for activation %s: %s", activation_id, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to wait for activation {activation_id}: {str(e)}",
        )
