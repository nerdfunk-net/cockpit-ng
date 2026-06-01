"""
Migration 038: Seed settings.server read/write permissions

Adds permissions for the Server Defaults settings tab and assigns them
to admin, operator, and network_engineer roles.
"""

from migrations.base import BaseMigration
from sqlalchemy import text

_PERMISSIONS = (
    ("read", "View server default settings"),
    ("write", "Modify server default settings"),
)

_ROLES = ("admin", "operator", "network_engineer")


class Migration(BaseMigration):
    """Seed settings.server permissions and assign to roles."""

    @property
    def name(self) -> str:
        return "038_seed_settings_server_permissions"

    @property
    def description(self) -> str:
        return "Add settings.server read/write permissions and assign to roles"

    def upgrade(self) -> dict:
        self.log_info("Seeding settings.server permissions...")

        permissions_created = 0
        assignments_created = 0

        with self.engine.connect() as conn:
            for action, description in _PERMISSIONS:
                result = conn.execute(
                    text(
                        """
                        SELECT id FROM permissions
                        WHERE resource = 'settings.server' AND action = :action
                        """
                    ),
                    {"action": action},
                )
                row = result.fetchone()

                if row is None:
                    conn.execute(
                        text(
                            """
                            INSERT INTO permissions (resource, action, description)
                            VALUES ('settings.server', :action, :description)
                            """
                        ),
                        {"action": action, "description": description},
                    )
                    conn.commit()
                    permissions_created += 1
                    self.log_info(f"✓ Created permission: settings.server:{action}")

                result = conn.execute(
                    text(
                        """
                        SELECT id FROM permissions
                        WHERE resource = 'settings.server' AND action = :action
                        """
                    ),
                    {"action": action},
                )
                permission_id = result.fetchone()[0]

                for role_name in _ROLES:
                    result = conn.execute(
                        text("SELECT id FROM roles WHERE name = :name"),
                        {"name": role_name},
                    )
                    role_row = result.fetchone()
                    if role_row is None:
                        self.log_warning(f"Role {role_name} not found — skipping")
                        continue

                    role_id = role_row[0]
                    result = conn.execute(
                        text(
                            """
                            SELECT 1 FROM role_permissions
                            WHERE role_id = :role_id AND permission_id = :permission_id
                            """
                        ),
                        {"role_id": role_id, "permission_id": permission_id},
                    )

                    if result.fetchone() is None:
                        conn.execute(
                            text(
                                """
                                INSERT INTO role_permissions (role_id, permission_id, granted)
                                VALUES (:role_id, :permission_id, TRUE)
                                """
                            ),
                            {"role_id": role_id, "permission_id": permission_id},
                        )
                        conn.commit()
                        assignments_created += 1
                        self.log_info(
                            f"✓ Assigned settings.server:{action} to {role_name} role"
                        )

        return {
            "permissions_created": permissions_created,
            "assignments_created": assignments_created,
        }
