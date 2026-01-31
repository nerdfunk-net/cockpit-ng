"""
Database migration system for Cockpit.

Provides versioned migrations that are automatically discovered and executed
from the migrations/versions/ directory.
"""

from .runner import MigrationRunner
from .base import BaseMigration
from .auto_schema import AutoSchemaMigration

__all__ = ["MigrationRunner", "BaseMigration", "AutoSchemaMigration"]
