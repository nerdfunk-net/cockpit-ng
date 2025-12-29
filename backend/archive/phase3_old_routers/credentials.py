from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional

from core.auth import require_permission, get_current_username
from models.credentials import CredentialCreate, CredentialUpdate
import credentials_manager as cred_mgr

router = APIRouter(prefix="/api/credentials", tags=["credentials"])


@router.get(
    "", dependencies=[Depends(require_permission("settings.credentials", "read"))]
)
def list_credentials(
    include_expired: bool = Query(False),
    source: Optional[str] = Query(
        None, description="Filter by source: 'general', 'private', or None for all"
    ),
    current_user: str = Depends(get_current_username),
) -> List[dict]:
    """
    List credentials accessible to the current user.

    - General credentials: Available to all users
    - Private credentials: Only returns those owned by the current user
    - If source is None: Returns both general + user's private credentials
    """
    if source == "general":
        # Return only general credentials
        return cred_mgr.list_credentials(
            include_expired=include_expired, source="general"
        )
    elif source == "private":
        # Return only user's private credentials
        all_private = cred_mgr.list_credentials(
            include_expired=include_expired, source="private"
        )
        user_private = [
            cred for cred in all_private if cred.get("owner") == current_user
        ]
        return user_private
    else:
        # Return both general and user's private credentials
        general_creds = cred_mgr.list_credentials(
            include_expired=include_expired, source="general"
        )
        all_private = cred_mgr.list_credentials(
            include_expired=include_expired, source="private"
        )
        user_private = [
            cred for cred in all_private if cred.get("owner") == current_user
        ]
        return general_creds + user_private


@router.post(
    "", dependencies=[Depends(require_permission("settings.credentials", "write"))]
)
def create_credential(payload: CredentialCreate) -> dict:
    try:
        return cred_mgr.create_credential(
            name=payload.name,
            username=payload.username,
            cred_type=payload.type,
            password=payload.password,
            valid_until=payload.valid_until.isoformat()
            if payload.valid_until
            else None,
            source="general",  # Force general source for admin credentials interface
            ssh_private_key=payload.ssh_private_key,
            ssh_passphrase=payload.ssh_passphrase,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put(
    "/{cred_id}",
    dependencies=[Depends(require_permission("settings.credentials", "write"))],
)
def update_credential(cred_id: int, payload: CredentialUpdate) -> dict:
    try:
        return cred_mgr.update_credential(
            cred_id=cred_id,
            name=payload.name,
            username=payload.username,
            cred_type=payload.type,
            password=payload.password,
            valid_until=payload.valid_until.isoformat()
            if payload.valid_until
            else None,
            source="general",  # Force general source for admin credentials interface
            ssh_private_key=payload.ssh_private_key,
            ssh_passphrase=payload.ssh_passphrase,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete(
    "/{cred_id}",
    dependencies=[Depends(require_permission("settings.credentials", "delete"))],
)
def delete_credential(cred_id: int) -> dict:
    try:
        cred_mgr.delete_credential(cred_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/{cred_id}/password",
    dependencies=[Depends(require_permission("settings.credentials", "read"))],
)
def get_credential_password(
    cred_id: int, current_user: str = Depends(get_current_username)
) -> dict:
    """Get the decrypted password for a credential.

    Only returns password if:
    - Credential is general (accessible to all)
    - Credential is private and owned by current user
    """
    try:
        # First check if credential exists and is accessible
        general_creds = cred_mgr.list_credentials(
            include_expired=False, source="general"
        )
        all_private = cred_mgr.list_credentials(include_expired=False, source="private")
        user_private = [
            cred for cred in all_private if cred.get("owner") == current_user
        ]
        accessible_creds = general_creds + user_private

        credential = next((c for c in accessible_creds if c["id"] == cred_id), None)

        if not credential:
            raise HTTPException(
                status_code=404,
                detail=f"Credential with ID {cred_id} not found or not accessible",
            )

        # Now get the decrypted password
        password = cred_mgr.get_decrypted_password(cred_id)
        if password is None:
            raise HTTPException(status_code=404, detail="Credential not found")
        return {"password": password}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/{cred_id}/ssh-key",
    dependencies=[Depends(require_permission("settings.credentials", "read"))],
)
def get_credential_ssh_key(
    cred_id: int, current_user: str = Depends(get_current_username)
) -> dict:
    """Get the decrypted SSH key for a credential.

    Only returns SSH key if:
    - Credential is general (accessible to all)
    - Credential is private and owned by current user
    """
    try:
        # First check if credential exists and is accessible
        general_creds = cred_mgr.list_credentials(
            include_expired=False, source="general"
        )
        all_private = cred_mgr.list_credentials(include_expired=False, source="private")
        user_private = [
            cred for cred in all_private if cred.get("owner") == current_user
        ]
        accessible_creds = general_creds + user_private

        credential = next((c for c in accessible_creds if c["id"] == cred_id), None)

        if not credential:
            raise HTTPException(
                status_code=404,
                detail=f"Credential with ID {cred_id} not found or not accessible",
            )

        # Check if this is an ssh_key credential
        if credential.get("type") != "ssh_key":
            raise HTTPException(
                status_code=400,
                detail="Credential is not an SSH key type",
            )

        # Get the decrypted SSH key
        ssh_key = cred_mgr.get_decrypted_ssh_key(cred_id)
        ssh_passphrase = cred_mgr.get_decrypted_ssh_passphrase(cred_id)

        return {
            "ssh_key": ssh_key,
            "ssh_passphrase": ssh_passphrase,
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
