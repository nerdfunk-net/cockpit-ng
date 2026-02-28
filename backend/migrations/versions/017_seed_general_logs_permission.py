"""
Migration 017: Seed general.logs:read permission and assign to admin role

Adds the audit log viewing permission introduced with the General / Logs feature.
"""

from migrations.base import BaseMigration
from sqlalchemy import text


class Migration(BaseMigration):
    """Seed general.logs:read permission and assign it to the admin role."""

    @property
    def name(self) -> str:
        return "017_seed_general_logs_permission"

    @property
    def description(self) -> str:
        return "Add general.logs:read permission and assign to admin role"

    def upgrade(self) -> dict:
        """Insert permission and assign to admin role."""
        self.log_info("Seeding general.logs:read permission...")

        permissions_created = 0
        assignments_created = 0

        with self.engine.connect() as conn:
            # 1. Insert permission if it doesn't exist
            result = conn.execute(
                text(
                    """
                    SELECT id FROM permissions
                    WHERE resource = 'general.logs' AND action = 'read'
                    """
                )
            )
            row = result.fetchone()

            if row is None:
                conn.execute(
                    text(
                        """
                        INSERT INTO permissions (resource, action, description)
                        VALUES ('general.logs', 'read', 'View audit logs')
                        """
                    )
                )
                conn.commit()
                permissions_created += 1
                self.log_info("✓ Created permission: general.logs:read")
            else:
                self.log_debug("Permission general.logs:read already exists")

            # 2. Get permission ID
            result = conn.execute(
                text(
                    """
                    SELECT id FROM permissions
                    WHERE resource = 'general.logs' AND action = 'read'
                    """
                )
            )
            permission_id = result.fetchone()[0]

            # 3. Find admin role
            result = conn.execute(
                text("SELECT id FROM roles WHERE name = 'admin'")
            )
            admin_role = result.fetchone()

            if admin_role is None:
                self.log_warning("Admin role not found — skipping role assignment")
                return {
                    "permissions_created": permissions_created,
                    "assignments_created": 0,
                }

            admin_role_id = admin_role[0]

            # 4. Assign to admin if not already assigned
            result = conn.execute(
                text(
                    """
                    SELECT 1 FROM role_permissions
                    WHERE role_id = :role_id AND permission_id = :permission_id
                    """
                ),
                {"role_id": admin_role_id, "permission_id": permission_id},
            )

            if result.fetchone() is None:
                conn.execute(
                    text(
                        """
                        INSERT INTO role_permissions (role_id, permission_id, granted)
                        VALUES (:role_id, :permission_id, TRUE)
                        """
                    ),
                    {"role_id": admin_role_id, "permission_id": permission_id},
                )
                conn.commit()
                assignments_created += 1
                self.log_info("✓ Assigned general.logs:read to admin role")
            else:
                self.log_debug("Permission already assigned to admin role")

        return {
            "permissions_created": permissions_created,
            "assignments_created": assignments_created,
        }
