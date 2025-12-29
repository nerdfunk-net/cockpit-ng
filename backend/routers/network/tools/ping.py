from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from core.auth import verify_token
from core.schema_manager import SchemaManager
from services.network.tools.baseline import TestBaselineService
import logging

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
    """
    manager = SchemaManager()
    return manager.get_schema_status()


@router.post("/schema/migrate", dependencies=[Depends(verify_token)])
async def migrate_schema() -> Dict[str, Any]:
    """
    Perform database migration to match the defined models.
    Only adds missing tables and columns.
    """
    manager = SchemaManager()
    return manager.perform_migration()


@router.post("/rbac/seed", dependencies=[Depends(verify_token)])
async def seed_rbac() -> Dict[str, Any]:
    """
    Seed the RBAC system with default permissions and roles.
    This should be run after database migrations that add new tables.
    """
    try:
        import seed_rbac
        from io import StringIO
        import sys

        # Capture stdout to return to frontend
        captured_output = StringIO()
        old_stdout = sys.stdout
        sys.stdout = captured_output

        try:
            # Run the seed script with verbose output
            seed_rbac.main(verbose=True)

            # Get the captured output
            output = captured_output.getvalue()

            return {
                "success": True,
                "message": "RBAC system seeded successfully",
                "output": output,
            }
        finally:
            # Restore stdout
            sys.stdout = old_stdout

    except Exception as e:
        logger.error(f"Error seeding RBAC: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to seed RBAC system: {str(e)}"
        )


@router.post("/tests-baseline", dependencies=[Depends(verify_token)])
async def create_tests_baseline() -> Dict[str, Any]:
    """
    Create test baseline data in Nautobot from YAML configuration files.

    Reads all YAML files from ./contributing-data/checkmk/tests_baseline/ and creates:
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
        service = TestBaselineService()
        result = await service.create_baseline()

        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=result.get("message", "Failed to create test baseline")
            )

        return result

    except FileNotFoundError as e:
        logger.error(f"Baseline directory not found: {e}")
        raise HTTPException(
            status_code=404,
            detail=f"Baseline directory not found: {str(e)}"
        )
    except ValueError as e:
        logger.error(f"Invalid baseline data: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid baseline data: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error creating test baseline: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create test baseline: {str(e)}"
        )
