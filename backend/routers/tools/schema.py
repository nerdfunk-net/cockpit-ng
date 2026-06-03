"""
Tools router for schema management, RBAC seeding, and test baseline operations.
"""

from __future__ import annotations

import logging
import sys
from io import StringIO
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException

from core.auth import verify_token
from core.safe_http_errors import raise_internal_server_error
from core.schema_manager import SchemaManager
from models.tools import (
    BaselineProfileSummary,
    CreateBaselineRequest,
    CreateBaselineResponse,
    ImportBaselineRequest,
)
from services.network.tools.baseline import BaselineImportService
from services.network.tools.baseline_generator import generate_baseline_file
from services.network.tools.baseline_profiles import list_profiles, load_profile

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/tools",
    tags=["tools"],
    responses={404: {"description": "Not found"}},
)


@router.get("/schema/status", dependencies=[Depends(verify_token)])
async def get_schema_status() -> Dict[str, Any]:
    """
    Get the status of the database schema compared to the defined models.
    Also includes information about the versioned migration system.
    """
    manager = SchemaManager()
    return manager.get_schema_status()


@router.get("/schema/migrations", dependencies=[Depends(verify_token)])
async def get_applied_migrations() -> Dict[str, Any]:
    """
    Get list of all applied versioned migrations from the migration system.
    Returns empty list if migration system hasn't been initialized.
    """
    manager = SchemaManager()
    migrations = manager.get_applied_migrations()
    return {
        "migrations": migrations,
        "count": len(migrations),
    }


@router.post("/schema/migrate", dependencies=[Depends(verify_token)])
async def migrate_schema() -> Dict[str, Any]:
    """
    Perform database migration to match the defined models.
    Only adds missing tables and columns.

    WARNING: This is for emergency use only. For production, prefer creating
    versioned migrations in backend/migrations/versions/
    """
    manager = SchemaManager()
    return manager.perform_migration()


@router.post("/rbac/seed", dependencies=[Depends(verify_token)])
async def seed_rbac(remove_existing: bool = False) -> Dict[str, Any]:
    """
    Seed the RBAC system with default permissions and roles.
    This should be run after database migrations that add new tables.

    Args:
        remove_existing: If True, remove all existing RBAC data before seeding.
                        WARNING: This removes all roles, permissions, and assignments!
    """
    try:
        from tools import seed_rbac  # type: ignore[import]

        # Capture stdout to return to frontend
        captured_output = StringIO()
        old_stdout = sys.stdout
        sys.stdout = captured_output

        try:
            seed_rbac.main(verbose=True, remove_existing=remove_existing)
            output = captured_output.getvalue()

            return {
                "success": True,
                "message": (
                    "RBAC system seeded successfully"
                    if not remove_existing
                    else "RBAC system cleaned and reseeded successfully"
                ),
                "output": output,
            }
        finally:
            sys.stdout = old_stdout

    except Exception as e:
        raise_internal_server_error(logger, "Failed to seed RBAC system", e)


@router.get(
    "/baseline-profiles",
    dependencies=[Depends(verify_token)],
    response_model=list[BaselineProfileSummary],
)
async def get_baseline_profiles() -> list[BaselineProfileSummary]:
    """List available baseline generation profiles (e.g. pytest, demo)."""
    return list_profiles()


@router.get(
    "/baseline-profiles/{profile_id}",
    dependencies=[Depends(verify_token)],
)
async def get_baseline_profile(profile_id: str) -> Dict[str, Any]:
    """Return full profile JSON for UI form prefill."""
    try:
        return load_profile(profile_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post(
    "/create-baseline",
    dependencies=[Depends(verify_token)],
    response_model=CreateBaselineResponse,
)
async def create_baseline_yaml(body: CreateBaselineRequest) -> CreateBaselineResponse:
    """
    Generate a baseline YAML file from parameters and write it to data/baseline/.

    Operators can copy the file into contributing-data/tests_baseline/ and run
    POST /api/tools/tests-baseline to import into Nautobot.
    """
    try:
        return generate_baseline_file(body)
    except ValueError as e:
        logger.error("Invalid baseline generation request: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise_internal_server_error(logger, "Failed to generate baseline YAML", e)


@router.post("/tests-baseline", dependencies=[Depends(verify_token)])
async def create_tests_baseline(
    body: ImportBaselineRequest | None = None,
) -> Dict[str, Any]:
    """
    Create test baseline data in Nautobot from YAML configuration files.

    Reads all YAML files from contributing-data/tests_baseline/ (or BASELINE_DIR) and creates:
    - Location types
    - Locations
    - Roles
    - Tags
    - Manufacturers
    - Platforms
    - Device types
    - Devices

    Resources are created in the correct dependency order.
    Existing resources are skipped (idempotent operation).
    """
    try:
        service = BaselineImportService()
        directory = body.directory if body else None
        result = await service.create_baseline(directory=directory)

        if not result.get("success"):
            logger.error("Test baseline creation failed: %s", result.get("message"))
            raise HTTPException(
                status_code=500,
                detail="Failed to create test baseline",
            )

        return result

    except FileNotFoundError as e:
        logger.error("Baseline directory not found: %s", e)
        raise HTTPException(
            status_code=404, detail=f"Baseline directory not found: {str(e)}"
        )
    except ValueError as e:
        logger.error("Invalid baseline data: %s", e)
        raise HTTPException(status_code=400, detail=f"Invalid baseline data: {str(e)}")
    except Exception as e:
        raise_internal_server_error(logger, "Failed to create test baseline", e)
