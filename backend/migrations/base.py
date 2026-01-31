"""
Base migration class for all database migrations.
"""

from abc import ABC, abstractmethod
from sqlalchemy.engine import Engine
import logging

logger = logging.getLogger(__name__)


class BaseMigration(ABC):
    """
    Base class for all migrations.

    Each migration should inherit from this class and implement:
    - name: Unique migration name
    - description: Human-readable description
    - upgrade(): Method to apply the migration
    """

    def __init__(self, engine: Engine, base):
        self.engine = engine
        self.base = base

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique name for this migration."""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Human-readable description of what this migration does."""
        pass

    @abstractmethod
    def upgrade(self) -> dict:
        """
        Apply the migration.

        Returns:
            dict: Statistics about what was changed
                  e.g., {"tables_created": 1, "columns_added": 0}
        """
        pass

    def log_info(self, message: str):
        """Log info message with migration name prefix."""
        logger.info(f"[{self.name}] {message}")

    def log_debug(self, message: str):
        """Log debug message with migration name prefix."""
        logger.debug(f"[{self.name}] {message}")

    def log_warning(self, message: str):
        """Log warning message with migration name prefix."""
        logger.warning(f"[{self.name}] {message}")

    def log_error(self, message: str):
        """Log error message with migration name prefix."""
        logger.error(f"[{self.name}] {message}")
