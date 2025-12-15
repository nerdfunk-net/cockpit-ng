from fastapi import APIRouter, Depends
from typing import Dict, Any
from core.auth import verify_token
from core.schema_manager import SchemaManager

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
