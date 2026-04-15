"""
Migration 026: Add client data tables and get_client_data job template columns

Creates three new tables for the get_client_data job type:
  - client_ip_addresses  — ARP table entries (ip, mac, interface, device_name, device_ip)
  - client_mac_addresses — MAC address table entries (mac, vlan, port, device_name, device_ip)
  - client_hostnames     — DNS-resolved hostnames (ip, hostname, device_name, device_ip)

Also adds three boolean columns to job_templates:
  - collect_ip_address  (default TRUE)
  - collect_mac_address (default TRUE)
  - collect_hostname    (default TRUE)
"""

from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    """Add client data tables and get_client_data job template fields."""

    @property
    def name(self) -> str:
        return "026_add_client_data"

    @property
    def description(self) -> str:
        return (
            "Add client_ip_addresses, client_mac_addresses, client_hostnames tables "
            "and collect_ip_address/collect_mac_address/collect_hostname columns to job_templates"
        )

    def upgrade(self) -> dict:
        self.log_info("Creating client data tables and job_template columns...")
        auto = AutoSchemaMigration(self.engine, self.base)
        results = auto.run()
        tables_created = results.get("tables_created", 0)
        columns_added = results.get("columns_added", 0)
        if tables_created > 0:
            self.log_info(f"Created {tables_created} new table(s)")
        if columns_added > 0:
            self.log_info(f"Added {columns_added} new column(s)")
        if tables_created == 0 and columns_added == 0:
            self.log_debug("All client data tables and columns already exist")
        return results
