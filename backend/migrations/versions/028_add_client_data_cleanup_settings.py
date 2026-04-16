"""
Migration 028: Add client data cleanup settings to celery_settings table

Adds three columns that control automatic cleanup of old ARP, MAC address,
and hostname data collected by the get_client_data job type.
"""

from migrations.base import BaseMigration
from sqlalchemy import text


class Migration(BaseMigration):
    """Add client data cleanup settings to celery_settings table."""

    @property
    def name(self) -> str:
        return "028_add_client_data_cleanup_settings"

    @property
    def description(self) -> str:
        return (
            "Add client_data_cleanup_enabled, client_data_cleanup_interval_hours, "
            "and client_data_cleanup_age_hours columns to celery_settings table"
        )

    def upgrade(self) -> dict:
        """
        Apply the migration.

        Returns:
            dict: Statistics (columns_added)
        """
        self.log_info(
            "Adding client data cleanup columns to celery_settings table..."
        )

        try:
            with self.engine.connect() as conn:
                conn.execute(
                    text("""
                        ALTER TABLE celery_settings
                        ADD COLUMN IF NOT EXISTS client_data_cleanup_enabled
                            BOOLEAN NOT NULL DEFAULT TRUE
                    """)
                )
                conn.execute(
                    text("""
                        ALTER TABLE celery_settings
                        ADD COLUMN IF NOT EXISTS client_data_cleanup_interval_hours
                            INTEGER NOT NULL DEFAULT 24
                    """)
                )
                conn.execute(
                    text("""
                        ALTER TABLE celery_settings
                        ADD COLUMN IF NOT EXISTS client_data_cleanup_age_hours
                            INTEGER NOT NULL DEFAULT 168
                    """)
                )
                conn.commit()

                self.log_info(
                    "Successfully added client data cleanup columns"
                )

                return {
                    "columns_added": 3,
                    "message": (
                        "Added client_data_cleanup_enabled, "
                        "client_data_cleanup_interval_hours, "
                        "client_data_cleanup_age_hours to celery_settings"
                    ),
                }

        except Exception as e:
            self.log_error(f"Failed to add client data cleanup columns: {e}")
            raise

    def downgrade(self) -> dict:
        """
        Revert the migration.

        Returns:
            dict: Statistics (columns_removed)
        """
        self.log_info(
            "Removing client data cleanup columns from celery_settings table..."
        )

        try:
            with self.engine.connect() as conn:
                conn.execute(
                    text("""
                        ALTER TABLE celery_settings
                        DROP COLUMN IF EXISTS client_data_cleanup_enabled
                    """)
                )
                conn.execute(
                    text("""
                        ALTER TABLE celery_settings
                        DROP COLUMN IF EXISTS client_data_cleanup_interval_hours
                    """)
                )
                conn.execute(
                    text("""
                        ALTER TABLE celery_settings
                        DROP COLUMN IF EXISTS client_data_cleanup_age_hours
                    """)
                )
                conn.commit()

                self.log_info("Successfully removed client data cleanup columns")

                return {
                    "columns_removed": 3,
                    "message": "Removed client data cleanup columns from celery_settings",
                }

        except Exception as e:
            self.log_error(f"Failed to remove client data cleanup columns: {e}")
            raise
