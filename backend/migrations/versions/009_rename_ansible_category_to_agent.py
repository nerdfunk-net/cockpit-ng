"""
Migration 009: Rename ansible category to agent for git repositories

This migration updates the category value from 'ansible' to 'agent' for any
existing git repositories that use the ansible category. This aligns with the
new agent deployment architecture.
"""

from migrations.base import BaseMigration
from sqlalchemy import text


class Migration(BaseMigration):
    """Rename ansible category to agent for git repositories."""

    @property
    def name(self) -> str:
        return "009_rename_ansible_category_to_agent"

    @property
    def description(self) -> str:
        return "Update git_repositories category from 'ansible' to 'agent'"

    def upgrade(self) -> dict:
        """
        Update git_repositories category from 'ansible' to 'agent'.
        """
        stats = {
            "repositories_updated": 0,
            "errors": 0,
        }

        self.log_info("Updating git repository categories from 'ansible' to 'agent'...")

        try:
            with self.engine.begin() as conn:
                # Check if the git_repositories table exists
                result = conn.execute(
                    text(
                        """
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'git_repositories'
                        """
                    )
                )

                if result.fetchone() is not None:
                    # Check for repositories with ansible category
                    result = conn.execute(
                        text(
                            """
                            SELECT COUNT(*) as count
                            FROM git_repositories
                            WHERE category = 'ansible'
                            """
                        )
                    )
                    count_row = result.fetchone()
                    count = count_row[0] if count_row else 0

                    if count > 0:
                        self.log_info(f"Found {count} repositories with 'ansible' category")
                        
                        # Update category from 'ansible' to 'agent'
                        result = conn.execute(
                            text(
                                """
                                UPDATE git_repositories
                                SET category = 'agent'
                                WHERE category = 'ansible'
                                """
                            )
                        )
                        stats["repositories_updated"] = result.rowcount
                        
                        self.log_info(
                            f"✓ Updated {stats['repositories_updated']} repositories "
                            "from 'ansible' to 'agent' category"
                        )
                    else:
                        self.log_info("✓ No repositories with 'ansible' category found")
                else:
                    self.log_warning("git_repositories table does not exist yet")

        except Exception as e:
            self.log_error(f"Failed to update repository categories: {e}")
            stats["errors"] += 1
            raise

        return stats

    def downgrade(self) -> dict:
        """
        Revert git_repositories category from 'agent' back to 'ansible'.
        """
        stats = {
            "repositories_reverted": 0,
            "errors": 0,
        }

        self.log_info("Reverting git repository categories from 'agent' to 'ansible'...")

        try:
            with self.engine.begin() as conn:
                # Check if the git_repositories table exists
                result = conn.execute(
                    text(
                        """
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'git_repositories'
                        """
                    )
                )

                if result.fetchone() is not None:
                    # Update category from 'agent' back to 'ansible'
                    # Note: This only affects repos that were migrated, not new ones
                    result = conn.execute(
                        text(
                            """
                            UPDATE git_repositories
                            SET category = 'ansible'
                            WHERE category = 'agent'
                            """
                        )
                    )
                    stats["repositories_reverted"] = result.rowcount
                    
                    self.log_info(
                        f"✓ Reverted {stats['repositories_reverted']} repositories "
                        "from 'agent' to 'ansible' category"
                    )
                else:
                    self.log_warning("git_repositories table does not exist")

        except Exception as e:
            self.log_error(f"Failed to revert repository categories: {e}")
            stats["errors"] += 1
            raise

        return stats
