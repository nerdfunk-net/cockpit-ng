"""
Migration 003: Add queues column to celery_settings table

Adds a queues column to store configured Celery queue definitions as JSON.
This allows users to define queues through the UI that can be used for job routing.
"""

from migrations.base import BaseMigration
from sqlalchemy import text


class Migration(BaseMigration):
    """Add queues column to celery_settings table."""

    @property
    def name(self) -> str:
        return "003_add_celery_queues"

    @property
    def description(self) -> str:
        return "Add queues column to celery_settings table for queue configuration"

    def upgrade(self) -> dict:
        """
        Apply the migration.

        Returns:
            dict: Statistics (columns_added)
        """
        self.log_info("Adding queues column to celery_settings table...")

        try:
            with self.engine.connect() as conn:
                # Add queues column to celery_settings table
                conn.execute(
                    text("""
                        ALTER TABLE celery_settings
                        ADD COLUMN IF NOT EXISTS queues TEXT
                    """)
                )
                conn.commit()

                # Initialize existing records with default queues
                self.log_info("Initializing existing records with default queues...")
                default_queues = """[
                    {"name": "default", "description": "Default queue for general tasks"},
                    {"name": "backup", "description": "Queue for device backup operations"},
                    {"name": "network", "description": "Queue for network scanning and discovery tasks"},
                    {"name": "heavy", "description": "Queue for bulk operations and heavy processing tasks"}
                ]"""

                result = conn.execute(
                    text("""
                        UPDATE celery_settings
                        SET queues = :default_queues
                        WHERE queues IS NULL
                    """),
                    {"default_queues": default_queues},
                )
                conn.commit()

                rows_updated = result.rowcount

                self.log_info(
                    "Successfully added queues column and initialized default queues"
                )

                return {
                    "columns_added": 1,
                    "rows_updated": rows_updated,
                    "message": "Added queues column and initialized with default queue",
                }

        except Exception as e:
            self.log_error(f"Failed to add queues column: {e}")
            raise

    def downgrade(self) -> dict:
        """
        Revert the migration.

        Returns:
            dict: Statistics (columns_removed)
        """
        self.log_info("Removing queues column from celery_settings table...")

        try:
            with self.engine.connect() as conn:
                # Remove queues column from celery_settings table
                conn.execute(
                    text("""
                        ALTER TABLE celery_settings
                        DROP COLUMN IF EXISTS queues
                    """)
                )
                conn.commit()

                self.log_info("Successfully removed queues column")

                return {
                    "columns_removed": 1,
                    "message": "Removed queues column from celery_settings table",
                }

        except Exception as e:
            self.log_error(f"Failed to remove queues column: {e}")
            raise
