"""
Compliance settings router for configuration management.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Body

from core.auth import require_permission
from models.settings import (
    RegexPatternRequest,
    RegexPatternUpdateRequest,
    LoginCredentialRequest,
    LoginCredentialUpdateRequest,
    SNMPMappingRequest,
    SNMPMappingUpdateRequest,
)
import compliance_manager as compliance

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings/compliance", tags=["compliance-settings"])


# ============================================================================
# Regex Pattern Endpoints
# ============================================================================


@router.get("/regex-patterns")
async def get_all_regex_patterns(
    current_user: dict = Depends(require_permission("settings.compliance", "read")),
):
    """Get all regex patterns."""
    try:
        patterns = compliance.get_all_regex_patterns()
        return {"success": True, "data": patterns}
    except Exception as e:
        logger.error("Error getting regex patterns: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve regex patterns: {str(e)}",
        )


@router.get("/regex-patterns/{pattern_id}")
async def get_regex_pattern(
    pattern_id: int,
    current_user: dict = Depends(require_permission("settings.compliance", "read")),
):
    """Get a specific regex pattern by ID."""
    try:
        pattern = compliance.get_regex_pattern_by_id(pattern_id)
        if not pattern:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Regex pattern with ID {pattern_id} not found",
            )
        return {"success": True, "data": pattern}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting regex pattern %s: %s", pattern_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve regex pattern: {str(e)}",
        )


@router.post("/regex-patterns")
async def create_regex_pattern(
    pattern_request: RegexPatternRequest,
    current_user: dict = Depends(require_permission("settings.compliance", "write")),
):
    """Create a new regex pattern."""
    try:
        pattern_id = compliance.create_regex_pattern(
            pattern=pattern_request.pattern,
            pattern_type=pattern_request.pattern_type,
            description=pattern_request.description,
        )
        created_pattern = compliance.get_regex_pattern_by_id(pattern_id)
        return {
            "success": True,
            "message": "Regex pattern created successfully",
            "data": created_pattern,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error("Error creating regex pattern: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create regex pattern: {str(e)}",
        )


@router.put("/regex-patterns/{pattern_id}")
async def update_regex_pattern(
    pattern_id: int,
    pattern_request: RegexPatternUpdateRequest,
    current_user: dict = Depends(require_permission("settings.compliance", "write")),
):
    """Update an existing regex pattern."""
    try:
        success = compliance.update_regex_pattern(
            pattern_id=pattern_id,
            pattern=pattern_request.pattern,
            description=pattern_request.description,
            is_active=pattern_request.is_active,
        )
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Regex pattern with ID {pattern_id} not found or no changes made",
            )
        updated_pattern = compliance.get_regex_pattern_by_id(pattern_id)
        return {
            "success": True,
            "message": "Regex pattern updated successfully",
            "data": updated_pattern,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating regex pattern %s: %s", pattern_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update regex pattern: {str(e)}",
        )


@router.delete("/regex-patterns/{pattern_id}")
async def delete_regex_pattern(
    pattern_id: int,
    current_user: dict = Depends(require_permission("settings.compliance", "write")),
):
    """Delete a regex pattern."""
    try:
        success = compliance.delete_regex_pattern(pattern_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Regex pattern with ID {pattern_id} not found",
            )
        return {"success": True, "message": "Regex pattern deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting regex pattern %s: %s", pattern_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete regex pattern: {str(e)}",
        )


# ============================================================================
# Login Credentials Endpoints
# ============================================================================


@router.get("/login-credentials")
async def get_all_login_credentials(
    current_user: dict = Depends(require_permission("settings.compliance", "read")),
):
    """Get all login credentials (passwords masked)."""
    try:
        credentials = compliance.get_all_login_credentials(decrypt_passwords=False)
        return {"success": True, "data": credentials}
    except Exception as e:
        logger.error("Error getting login credentials: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve login credentials: {str(e)}",
        )


@router.get("/login-credentials/{credential_id}")
async def get_login_credential(
    credential_id: int,
    current_user: dict = Depends(require_permission("settings.compliance", "read")),
):
    """Get a specific login credential by ID (password masked)."""
    try:
        credential = compliance.get_login_credential_by_id(
            credential_id, decrypt_password=False
        )
        if not credential:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Login credential with ID {credential_id} not found",
            )
        return {"success": True, "data": credential}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting login credential %s: %s", credential_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve login credential: {str(e)}",
        )


@router.post("/login-credentials")
async def create_login_credential(
    credential_request: LoginCredentialRequest,
    current_user: dict = Depends(require_permission("settings.compliance", "write")),
):
    """Create a new login credential."""
    try:
        credential_id = compliance.create_login_credential(
            name=credential_request.name,
            username=credential_request.username,
            password=credential_request.password,
            description=credential_request.description,
        )
        created_credential = compliance.get_login_credential_by_id(
            credential_id, decrypt_password=False
        )
        return {
            "success": True,
            "message": "Login credential created successfully",
            "data": created_credential,
        }
    except Exception as e:
        logger.error("Error creating login credential: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create login credential: {str(e)}",
        )


@router.put("/login-credentials/{credential_id}")
async def update_login_credential(
    credential_id: int,
    credential_request: LoginCredentialUpdateRequest,
    current_user: dict = Depends(require_permission("settings.compliance", "write")),
):
    """Update an existing login credential."""
    try:
        success = compliance.update_login_credential(
            credential_id=credential_id,
            name=credential_request.name,
            username=credential_request.username,
            password=credential_request.password,
            description=credential_request.description,
            is_active=credential_request.is_active,
        )
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Login credential with ID {credential_id} not found or no changes made",
            )
        updated_credential = compliance.get_login_credential_by_id(
            credential_id, decrypt_password=False
        )
        return {
            "success": True,
            "message": "Login credential updated successfully",
            "data": updated_credential,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating login credential %s: %s", credential_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update login credential: {str(e)}",
        )


@router.delete("/login-credentials/{credential_id}")
async def delete_login_credential(
    credential_id: int,
    current_user: dict = Depends(require_permission("settings.compliance", "write")),
):
    """Delete a login credential."""
    try:
        success = compliance.delete_login_credential(credential_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Login credential with ID {credential_id} not found",
            )
        return {"success": True, "message": "Login credential deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting login credential %s: %s", credential_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete login credential: {str(e)}",
        )


# ============================================================================
# SNMP Mapping Endpoints
# ============================================================================


@router.get("/snmp-mappings")
async def get_all_snmp_mappings(
    current_user: dict = Depends(require_permission("settings.compliance", "read")),
):
    """Get all SNMP mappings (passwords masked)."""
    try:
        mappings = compliance.get_all_snmp_mappings(decrypt_passwords=False)
        return {"success": True, "data": mappings}
    except Exception as e:
        logger.error("Error getting SNMP mappings: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve SNMP mappings: {str(e)}",
        )


@router.get("/snmp-mappings/{mapping_id}")
async def get_snmp_mapping(
    mapping_id: int,
    current_user: dict = Depends(require_permission("settings.compliance", "read")),
):
    """Get a specific SNMP mapping by ID (passwords masked)."""
    try:
        mapping = compliance.get_snmp_mapping_by_id(mapping_id, decrypt_passwords=False)
        if not mapping:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"SNMP mapping with ID {mapping_id} not found",
            )
        return {"success": True, "data": mapping}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting SNMP mapping %s: %s", mapping_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve SNMP mapping: {str(e)}",
        )


@router.post("/snmp-mappings")
async def create_snmp_mapping(
    mapping_request: SNMPMappingRequest,
    current_user: dict = Depends(require_permission("settings.compliance", "write")),
):
    """Create a new SNMP mapping."""
    try:
        mapping_id = compliance.create_snmp_mapping(
            name=mapping_request.name,
            snmp_version=mapping_request.snmp_version,
            snmp_community=mapping_request.snmp_community,
            snmp_v3_user=mapping_request.snmp_v3_user,
            snmp_v3_auth_protocol=mapping_request.snmp_v3_auth_protocol,
            snmp_v3_auth_password=mapping_request.snmp_v3_auth_password,
            snmp_v3_priv_protocol=mapping_request.snmp_v3_priv_protocol,
            snmp_v3_priv_password=mapping_request.snmp_v3_priv_password,
            description=mapping_request.description,
        )
        created_mapping = compliance.get_snmp_mapping_by_id(
            mapping_id, decrypt_passwords=False
        )
        return {
            "success": True,
            "message": "SNMP mapping created successfully",
            "data": created_mapping,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error("Error creating SNMP mapping: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create SNMP mapping: {str(e)}",
        )


@router.put("/snmp-mappings/{mapping_id}")
async def update_snmp_mapping(
    mapping_id: int,
    mapping_request: SNMPMappingUpdateRequest,
    current_user: dict = Depends(require_permission("settings.compliance", "write")),
):
    """Update an existing SNMP mapping."""
    try:
        success = compliance.update_snmp_mapping(
            mapping_id=mapping_id,
            name=mapping_request.name,
            snmp_version=mapping_request.snmp_version,
            snmp_community=mapping_request.snmp_community,
            snmp_v3_user=mapping_request.snmp_v3_user,
            snmp_v3_auth_protocol=mapping_request.snmp_v3_auth_protocol,
            snmp_v3_auth_password=mapping_request.snmp_v3_auth_password,
            snmp_v3_priv_protocol=mapping_request.snmp_v3_priv_protocol,
            snmp_v3_priv_password=mapping_request.snmp_v3_priv_password,
            description=mapping_request.description,
            is_active=mapping_request.is_active,
        )
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"SNMP mapping with ID {mapping_id} not found or no changes made",
            )
        updated_mapping = compliance.get_snmp_mapping_by_id(
            mapping_id, decrypt_passwords=False
        )
        return {
            "success": True,
            "message": "SNMP mapping updated successfully",
            "data": updated_mapping,
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error("Error updating SNMP mapping %s: %s", mapping_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update SNMP mapping: {str(e)}",
        )


@router.delete("/snmp-mappings/{mapping_id}")
async def delete_snmp_mapping(
    mapping_id: int,
    current_user: dict = Depends(require_permission("settings.compliance", "write")),
):
    """Delete an SNMP mapping."""
    try:
        success = compliance.delete_snmp_mapping(mapping_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"SNMP mapping with ID {mapping_id} not found",
            )
        return {"success": True, "message": "SNMP mapping deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting SNMP mapping %s: %s", mapping_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete SNMP mapping: {str(e)}",
        )


@router.post("/snmp-mappings/import")
async def import_snmp_mappings(
    yaml_content: str = Body(..., embed=True),
    current_user: dict = Depends(require_permission("settings.compliance", "write")),
):
    """Import SNMP mappings from YAML content.

    Accepts YAML content in CheckMK format or custom format.

    Request body:
    {
      "yaml_content": "snmp-id-1:\n  version: v3\n  ..."
    }
    """
    try:
        result = compliance.import_snmp_mappings_from_yaml(yaml_content)

        # Build status message
        parts = []
        if result["imported"] > 0:
            parts.append(f"imported {result['imported']}")
        if result.get("skipped", 0) > 0:
            parts.append(f"skipped {result['skipped']} (already exist)")
        if result["errors"] > 0:
            parts.append(f"{result['errors']} errors")

        message = (
            f"SNMP mappings: {', '.join(parts)}" if parts else "No mappings imported"
        )

        return {
            "success": True,
            "message": message,
            "data": result,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error("Error importing SNMP mappings: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import SNMP mappings: {str(e)}",
        )
