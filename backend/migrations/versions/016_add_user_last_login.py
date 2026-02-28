"""
Migration 016: Add last_login column to users table

Tracks the timestamp of each user's most recent successful login.
"""

from migrations.base import BaseMigration
from sqlalchemy import text


class Migration(BaseMigration):
    """Add last_login column to users table."""

    @property
    def name(self) -> str:
        return "016_add_user_last_login"

    @property
    def description(self) -> str:
        return "Add last_login column to users table to track most recent login timestamp"

    def upgrade(self) -> dict:
        """Add last_login column to users table."""
        self.log_info("Adding last_login column to users...")

        try:
            with self.engine.connect() as conn:
                result = conn.execute(
                    text(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name = 'users'
                        AND column_name = 'last_login'
                        """
                    )
                )

                if result.fetchone() is None:
                    conn.execute(
                        text(
                            """
                            ALTER TABLE users
                            ADD COLUMN last_login TIMESTAMP WITH TIME ZONE NULL
                            """
                        )
                    )
                    conn.commit()
                    self.log_info("✓ last_login column added successfully")
                else:
                    self.log_debug("last_login column already exists")

            return {
                "success": True,
                "columns_added": 1,
                "message": "Added last_login column to users",
            }

        except Exception as e:
            self.log_error(f"Failed to add column: {e}")
            raise

    def downgrade(self) -> dict:
        """Remove last_login column from users table."""
        self.log_info("Removing last_login column from users...")

        try:
            with self.engine.connect() as conn:
                result = conn.execute(
                    text(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name = 'users'
                        AND column_name = 'last_login'
                        """
                    )
                )

                if result.fetchone() is not None:
                    conn.execute(
                        text("ALTER TABLE users DROP COLUMN last_login")
                    )
                    conn.commit()
                    self.log_info("✓ last_login column removed successfully")
                else:
                    self.log_debug("last_login column doesn't exist")

            return {
                "success": True,
                "columns_removed": 1,
                "message": "Removed last_login column from users",
            }

        except Exception as e:
            self.log_error(f"Failed to remove column: {e}")
            raise
