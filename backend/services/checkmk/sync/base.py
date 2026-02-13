"""
DEPRECATED: This file has been refactored into focused service modules.

Use the facade from services.checkmk.sync instead:
  from services.checkmk.sync import nb2cmk_service

New structure:
  - services/checkmk/sync/queries.py: GraphQL device queries
  - services/checkmk/sync/comparison.py: Device diff and comparison logic
  - services/checkmk/sync/operations.py: Add/update device operations
  - services/checkmk/sync/__init__.py: Facade maintaining backward compatibility

This file is kept temporarily for backward compatibility and will be removed
after validation period.

IMPORTANT: All imports from this file will be redirected to the new facade.
If you see this import in your code, please update to:
  from services.checkmk.sync import nb2cmk_service, NautobotToCheckMKService
"""

# Import from new location for backward compatibility
# This ensures old imports still work during transition
from services.checkmk.sync import (  # noqa: F401
    NautobotToCheckMKService,
    nb2cmk_service,
)

__all__ = ["NautobotToCheckMKService", "nb2cmk_service"]
