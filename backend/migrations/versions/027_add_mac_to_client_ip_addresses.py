"""
Migration 027: Add mac_address column to client_ip_addresses

The mac_address column was added to the ClientIpAddress SQLAlchemy model
after migration 026 (which created the client_* tables) had already been
applied. This migration adds the missing column and its index so the ARP
collector can store the MAC address alongside each IP address entry.

Changes:
  - client_ip_addresses.mac_address  VARCHAR(20)  NULLABLE
  - idx_client_ip_mac                INDEX on (mac_address)
"""

from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    """Add mac_address column and index to client_ip_addresses."""

    @property
    def name(self) -> str:
        return "027_add_mac_to_client_ip_addresses"

    @property
    def description(self) -> str:
        return (
            "Add mac_address column and idx_client_ip_mac index to "
            "client_ip_addresses so ARP-collected MAC addresses are persisted"
        )

    def upgrade(self) -> dict:
        self.log_info("Adding mac_address column to client_ip_addresses...")
        auto = AutoSchemaMigration(self.engine, self.base)
        results = auto.run()
        columns_added = results.get("columns_added", 0)
        indexes_created = results.get("indexes_created", 0)
        if columns_added > 0:
            self.log_info(
                "Added %s column(s) to client_ip_addresses", columns_added
            )
        if indexes_created > 0:
            self.log_info("Created %s index(es)", indexes_created)
        if columns_added == 0 and indexes_created == 0:
            self.log_debug("mac_address column and index already exist")
        return results
