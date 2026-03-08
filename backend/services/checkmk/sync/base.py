"""
DEPRECATED: This file has been refactored into focused service modules.

Use the facade from services.checkmk.sync instead:
  import service_factory
  nb2cmk_service = service_factory.build_nb2cmk_service()

New structure:
  - services/checkmk/sync/queries.py: GraphQL device queries
  - services/checkmk/sync/comparison.py: Device diff and comparison logic
  - services/checkmk/sync/operations.py: Add/update device operations
  - services/checkmk/sync/__init__.py: Facade maintaining backward compatibility

This file is kept temporarily for backward compatibility and will be removed
after validation period.

IMPORTANT: All imports from this file will be redirected to the new facade.
If you see this import in your code, please update to:
  import service_factory; nb2cmk = service_factory.build_nb2cmk_service()
"""

# Import from new location for backward compatibility
# This ensures old imports still work during transition
from services.checkmk.sync import NautobotToCheckMKService  # noqa: F401

__all__ = ["NautobotToCheckMKService"]
