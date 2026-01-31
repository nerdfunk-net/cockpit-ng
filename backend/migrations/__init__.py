"""
Database migration system for Cockpit.

Provides automatic schema migration by comparing SQLAlchemy models
with the actual database schema.
"""

from .runner import MigrationRunner
from .auto_schema import AutoSchemaMigration

__all__ = ["MigrationRunner", "AutoSchemaMigration"]
