from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List

from core.auth import verify_admin_token, verify_token
from models.credentials import CredentialCreate, CredentialUpdate
import credentials_manager as cred_mgr

router = APIRouter(prefix="/api/credentials", tags=["credentials"])


@router.get("", dependencies=[Depends(verify_token)])
def list_credentials(include_expired: bool = Query(False)) -> List[dict]:
    return cred_mgr.list_credentials(include_expired=include_expired, source="general")


@router.post("", dependencies=[Depends(verify_admin_token)])
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
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{cred_id}", dependencies=[Depends(verify_admin_token)])
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
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{cred_id}", dependencies=[Depends(verify_admin_token)])
def delete_credential(cred_id: int) -> dict:
    try:
        cred_mgr.delete_credential(cred_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{cred_id}/password", dependencies=[Depends(verify_token)])
def get_credential_password(cred_id: int) -> dict:
    """Get the decrypted password for a credential."""
    try:
        password = cred_mgr.get_decrypted_password(cred_id)
        if password is None:
            raise HTTPException(status_code=404, detail="Credential not found")
        return {"password": password}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
