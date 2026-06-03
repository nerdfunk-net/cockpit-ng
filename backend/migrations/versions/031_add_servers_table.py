"""
Migration 031: Add servers table

Creates the servers table for storing managed servers and their Ansible facts.
Inserts one mock server row for development and UI testing.
"""

import json

from sqlalchemy import text

from migrations.auto_schema import AutoSchemaMigration
from migrations.base import BaseMigration


class Migration(BaseMigration):
    """Add servers table with Ansible facts storage."""

    @property
    def name(self) -> str:
        return "031_add_servers_table"

    @property
    def description(self) -> str:
        return "Add servers table for managed server inventory with Ansible facts"

    def upgrade(self) -> dict:
        self.log_info("Creating servers table...")

        auto_migration = AutoSchemaMigration(self.engine, self.base)
        results = auto_migration.run()

        self.log_info("Inserting mock server row for development...")
        self._insert_mock_server()

        return {
            "success": True,
            "tables_created": results.get("tables_created", []),
            "message": "Created servers table and inserted mock row",
        }

    def _insert_mock_server(self) -> None:
        mock_facts = {
            "facts": {
                "ansible_hostname": "v2202503262298326986",
                "ansible_fqdn": "v2202503262298326986.nicesrv.de",
                "ansible_domain": "nicesrv.de",
                "ansible_architecture": "x86_64",
                "ansible_os_family": "Debian",
                "ansible_distribution": "Ubuntu",
                "ansible_distribution_release": "noble",
                "ansible_distribution_version": "24.04",
                "ansible_processor_count": 4,
                "ansible_processor_vcpus": 4,
                "ansible_memtotal_mb": 7941,
                "ansible_memfree_mb": 1864,
                "ansible_default_ipv4": {
                    "address": "45.136.30.143",
                    "interface": "eth0",
                    "gateway": "45.136.28.1",
                    "netmask": "255.255.252.0",
                    "network": "45.136.28.0",
                    "macaddress": "46:4f:13:dd:75:10",
                    "mtu": 1500,
                    "type": "ether",
                },
                "ansible_all_ipv4_addresses": [
                    "100.71.234.30",
                    "45.136.30.143",
                    "192.168.32.1",
                    "172.17.0.1",
                    "172.18.0.1",
                ],
                "ansible_mounts": [
                    {
                        "mount": "/",
                        "device": "/dev/vda3",
                        "fstype": "ext4",
                        "size_total": 539929432064,
                        "size_available": 484204859392,
                        "block_size": 4096,
                    },
                    {
                        "mount": "/boot",
                        "device": "/dev/vda2",
                        "fstype": "ext4",
                        "size_total": 1020702720,
                        "size_available": 741097472,
                        "block_size": 4096,
                    },
                ],
                "ansible_devices": {
                    "vda": {
                        "model": None,
                        "size": "512.00 GB",
                        "vendor": "0x1af4",
                        "rotational": "1",
                        "virtual": 1,
                        "partitions": {
                            "vda1": {"size": "2.00 MB"},
                            "vda2": {"size": "1.00 GB"},
                            "vda3": {"size": "511.00 GB"},
                        },
                    },
                },
                "ansible_loadavg": {"1m": 0.16, "5m": 0.21, "15m": 0.19},
                "ansible_apparmor": {"status": "enabled"},
                "ansible_bios_vendor": "netcup",
                "ansible_bios_version": "VPS 1000 G11 SE",
                "ansible_chassis_vendor": "QEMU",
                "ansible_distribution_major_version": "24",
                "ansible_kernel": "6.8.0-111-generic",
                "ansible_product_name": "KVM Server",
                "ansible_lsb": {
                    "codename": "noble",
                    "description": "Ubuntu 24.04.4 LTS",
                    "id": "Ubuntu",
                    "release": "24.04",
                },
            },
            "ansible_facts": {
                "hostname": "v2202503262298326986",
                "fqdn": "v2202503262298326986.nicesrv.de",
                "architecture": "x86_64",
                "os_family": "Debian",
                "distribution": "Ubuntu",
                "distribution_release": "noble",
                "distribution_version": "24.04",
                "processor_count": 4,
                "memtotal_mb": 7941,
                "default_ipv4": {
                    "address": "45.136.30.143",
                    "interface": "eth0",
                    "gateway": "45.136.28.1",
                },
                "mounts": [
                    {
                        "mount": "/",
                        "device": "/dev/vda3",
                        "fstype": "ext4",
                        "size_total": 539929432064,
                        "size_available": 484204859392,
                    },
                    {
                        "mount": "/boot",
                        "device": "/dev/vda2",
                        "fstype": "ext4",
                        "size_total": 1020702720,
                        "size_available": 741097472,
                    },
                ],
            },
        }

        with self.engine.connect() as conn:
            result = conn.execute(
                text("SELECT id FROM servers WHERE hostname = :hostname"),
                {"hostname": "v2202503262298326986"},
            )
            if result.fetchone() is not None:
                self.log_debug("Mock server row already exists, skipping insert")
                return

            mock_location = {
                "id": "00000000-0000-0000-0000-000000000001",
                "name": "Berlin DC-1",
                "hierarchical_path": "Berlin DC-1",
            }

            conn.execute(
                text(
                    """
                    INSERT INTO servers (
                        hostname, location, primary_ipv4, primary_interface,
                        os_family, processor_count, memtotal_mb, disk_count,
                        architecture, distribution_release, distribution_version,
                        contact, nautobot_uuid, ansible_facts
                    ) VALUES (
                        :hostname, CAST(:location AS jsonb), :primary_ipv4,
                        :primary_interface, :os_family, :processor_count,
                        :memtotal_mb, :disk_count, :architecture,
                        :distribution_release, :distribution_version,
                        :contact, :nautobot_uuid, CAST(:ansible_facts AS jsonb)
                    )
                    """
                ),
                {
                    "hostname": "v2202503262298326986",
                    "location": json.dumps(mock_location),
                    "primary_ipv4": "45.136.30.143",
                    "primary_interface": "eth0",
                    "os_family": "Debian",
                    "processor_count": 4,
                    "memtotal_mb": 7941,
                    "disk_count": 1,
                    "architecture": "x86_64",
                    "distribution_release": "noble",
                    "distribution_version": "24.04",
                    "contact": None,
                    "nautobot_uuid": None,
                    "ansible_facts": json.dumps(mock_facts),
                },
            )
            conn.commit()
            self.log_info("✓ Mock server row inserted")

    def downgrade(self) -> dict:
        self.log_info("Dropping servers table...")
        with self.engine.connect() as conn:
            conn.execute(text("DROP TABLE IF EXISTS servers CASCADE"))
            conn.commit()
        return {"success": True, "message": "Dropped servers table"}
