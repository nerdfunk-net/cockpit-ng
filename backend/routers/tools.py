from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from core.auth import verify_token
from core.schema_manager import SchemaManager
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
