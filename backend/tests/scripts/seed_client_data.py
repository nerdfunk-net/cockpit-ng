#!/usr/bin/env python3
"""Seed the dev database with realistic client data for manual UI verification
and integration-test context.

Simulates what the "Get Client Data" job template would write after collecting
MAC address tables, ARP tables, and DNS hostnames from four network devices:

  sw-access-01  — L2-only access switch (MAC entries only, no ARP)
  sw-access-02  — L2-only access switch (MAC entries only, no ARP)
  sw-core-01    — L3 core switch (MAC + ARP + hostname)
  router-01     — Router (ARP + hostname, VRF support, no MAC table)

Three sessions are created (old → medium → latest) so the session-ranking and
deletion logic exercised by the integration tests is visible in real data.

Usage (from backend/)::

    python tests/scripts/seed_client_data.py            # append 3 sessions
    python tests/scripts/seed_client_data.py --clear    # truncate first, then seed
    python tests/scripts/seed_client_data.py --sessions 5
"""

from __future__ import annotations

import argparse
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402

# Prefer .env.test (test DB) when present; fall back to .env (dev DB).
_ENV_TEST = BACKEND_DIR / ".env.test"
_ENV_DEV = BACKEND_DIR / ".env"
if _ENV_TEST.is_file():
    load_dotenv(_ENV_TEST)
    _ENV_LOADED = str(_ENV_TEST)
else:
    load_dotenv(_ENV_DEV)
    _ENV_LOADED = str(_ENV_DEV)

import logging  # noqa: E402

logging.basicConfig(level=logging.WARNING, format="%(levelname)s: %(message)s")

from sqlalchemy import text  # noqa: E402
from sqlalchemy.engine import URL as EngineURL  # noqa: E402

from core.database import engine  # noqa: E402
from repositories.client_data.client_data_repository import (  # noqa: E402
    ClientDataRepository,
)


def _print_connection_info() -> None:
    url = engine.url
    if isinstance(url, EngineURL):
        safe = url.render_as_string(hide_password=True)
    else:
        safe = str(url)
    print(f"Env file : {_ENV_LOADED}")
    print(f"Database : {safe}")
    with engine.connect() as conn:
        db_name = conn.execute(text("SELECT current_database()")).scalar()
        print(f"DB name  : {db_name}")
        for table in (
            "client_mac_addresses",
            "client_ip_addresses",
            "client_hostnames",
        ):
            count = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
            print(f"  {table}: {count} rows")


def _sid() -> str:
    return str(uuid.uuid4())


def _now_minus(days: int) -> datetime:
    return datetime.now(tz=timezone.utc) - timedelta(days=days)


# ---------------------------------------------------------------------------
# Per-session data builders
# ---------------------------------------------------------------------------


def _mac_records(session_id: str, collected_at: datetime) -> list[dict]:
    """MAC address table entries from two L2 access switches and the core switch."""
    rows = []

    # sw-access-01 — VLAN 10 and 20
    for _i, (mac, vlan, port) in enumerate(
        [
            ("aabb.cc00.0101", "10", "GigabitEthernet1/0/1"),
            ("aabb.cc00.0102", "10", "GigabitEthernet1/0/2"),
            ("aabb.cc00.0103", "20", "GigabitEthernet1/0/3"),
            ("aabb.cc00.0104", "20", "GigabitEthernet1/0/4"),
            ("aabb.cc00.0105", "20", "GigabitEthernet1/0/5"),
        ],
        start=1,
    ):
        rows.append(
            {
                "session_id": session_id,
                "mac_address": mac,
                "vlan": vlan,
                "port": port,
                "device_name": "sw-access-01",
                "device_ip": "10.0.0.11",
                "collected_at": collected_at,
            }
        )

    # sw-access-02 — VLAN 10, 20, 30
    for mac, vlan, port in [
        ("aabb.cc00.0201", "10", "GigabitEthernet1/0/1"),
        ("aabb.cc00.0202", "20", "GigabitEthernet1/0/2"),
        ("aabb.cc00.0203", "30", "GigabitEthernet1/0/3"),
        ("aabb.cc00.0204", "30", "GigabitEthernet1/0/4"),
    ]:
        rows.append(
            {
                "session_id": session_id,
                "mac_address": mac,
                "vlan": vlan,
                "port": port,
                "device_name": "sw-access-02",
                "device_ip": "10.0.0.12",
                "collected_at": collected_at,
            }
        )

    # sw-core-01 — uplink MACs (these have matching ARP entries)
    for mac, vlan, port in [
        ("aabb.cc00.0301", "10", "TenGigabitEthernet1/1/1"),
        ("aabb.cc00.0302", "20", "TenGigabitEthernet1/1/2"),
        ("aabb.cc00.0303", "30", "TenGigabitEthernet1/1/3"),
    ]:
        rows.append(
            {
                "session_id": session_id,
                "mac_address": mac,
                "vlan": vlan,
                "port": port,
                "device_name": "sw-core-01",
                "device_ip": "10.0.0.13",
                "collected_at": collected_at,
            }
        )

    return rows


def _ip_records(session_id: str, collected_at: datetime) -> list[dict]:
    """ARP table entries from sw-core-01 (default VRF) and router-01 (VRFs)."""
    rows = []

    # sw-core-01 — ARP entries that correlate with its MAC table entries
    for ip, mac, iface in [
        ("192.168.10.10", "aabb.cc00.0301", "Vlan10"),
        ("192.168.20.20", "aabb.cc00.0302", "Vlan20"),
        ("192.168.30.30", "aabb.cc00.0303", "Vlan30"),
    ]:
        rows.append(
            {
                "session_id": session_id,
                "ip_address": ip,
                "mac_address": mac,
                "interface": iface,
                "vrf": None,
                "device_name": "sw-core-01",
                "device_ip": "10.0.0.13",
                "collected_at": collected_at,
            }
        )

    # router-01 — default VRF
    for ip, mac, iface in [
        ("192.168.10.1", "aabb.cc00.0401", "GigabitEthernet0/0"),
        ("192.168.20.1", "aabb.cc00.0402", "GigabitEthernet0/1"),
    ]:
        rows.append(
            {
                "session_id": session_id,
                "ip_address": ip,
                "mac_address": mac,
                "interface": iface,
                "vrf": None,
                "device_name": "router-01",
                "device_ip": "10.0.0.14",
                "collected_at": collected_at,
            }
        )

    # router-01 — vrf-prod
    for ip, mac, iface in [
        ("10.100.1.10", "aabb.cc00.0403", "GigabitEthernet0/2.100"),
        ("10.100.1.20", "aabb.cc00.0404", "GigabitEthernet0/2.101"),
    ]:
        rows.append(
            {
                "session_id": session_id,
                "ip_address": ip,
                "mac_address": mac,
                "interface": iface,
                "vrf": "vrf-prod",
                "device_name": "router-01",
                "device_ip": "10.0.0.14",
                "collected_at": collected_at,
            }
        )

    # router-01 — vrf-mgmt
    rows.append(
        {
            "session_id": session_id,
            "ip_address": "10.200.0.10",
            "mac_address": "aabb.cc00.0405",
            "interface": "GigabitEthernet0/3",
            "vrf": "vrf-mgmt",
            "device_name": "router-01",
            "device_ip": "10.0.0.14",
            "collected_at": collected_at,
        }
    )

    return rows


def _hostname_records(session_id: str, collected_at: datetime) -> list[dict]:
    """DNS-resolved hostnames for IPs in the ARP table."""
    entries = [
        ("192.168.10.10", "workstation-01.example.com", "sw-core-01", "10.0.0.13"),
        ("192.168.20.20", "server-01.example.com", "sw-core-01", "10.0.0.13"),
        ("192.168.30.30", "printer-01.example.com", "sw-core-01", "10.0.0.13"),
        ("192.168.10.1", "gw-vlan10.example.com", "router-01", "10.0.0.14"),
        ("192.168.20.1", "gw-vlan20.example.com", "router-01", "10.0.0.14"),
        ("10.100.1.10", "prod-app-01.example.com", "router-01", "10.0.0.14"),
        ("10.100.1.20", "prod-app-02.example.com", "router-01", "10.0.0.14"),
        ("10.200.0.10", "mgmt-host-01.example.com", "router-01", "10.0.0.14"),
    ]
    return [
        {
            "session_id": session_id,
            "ip_address": ip,
            "hostname": hostname,
            "device_name": device_name,
            "device_ip": device_ip,
            "collected_at": collected_at,
        }
        for ip, hostname, device_name, device_ip in entries
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def clear_tables() -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE TABLE client_hostnames, client_mac_addresses, client_ip_addresses"
                " RESTART IDENTITY CASCADE"
            )
        )
    print("Truncated client_hostnames, client_mac_addresses, client_ip_addresses.")


def seed(num_sessions: int) -> None:
    repo = ClientDataRepository()

    # Spread sessions evenly across the past (num_sessions - 1) days; latest = now
    timestamps = [_now_minus(num_sessions - 1 - i) for i in range(num_sessions)]

    total_mac = total_ip = total_host = 0
    for idx, ts in enumerate(timestamps, start=1):
        sid = _sid()
        mac_rows = _mac_records(sid, ts)
        ip_rows = _ip_records(sid, ts)
        host_rows = _hostname_records(sid, ts)

        repo.bulk_insert_mac_addresses(mac_rows)
        repo.bulk_insert_ip_addresses(ip_rows)
        repo.bulk_insert_hostnames(host_rows)

        total_mac += len(mac_rows)
        total_ip += len(ip_rows)
        total_host += len(host_rows)

        age = f"T-{num_sessions - idx}d" if idx < num_sessions else "latest"
        print(
            f"  Session {idx}/{num_sessions} ({age}): "
            f"{len(mac_rows)} MAC, {len(ip_rows)} IP, {len(host_rows)} hostname rows"
        )

    print(
        f"\nDone. Inserted {total_mac} MAC / {total_ip} IP / {total_host} hostname rows"
        f" across {num_sessions} session(s)."
    )
    print(
        "\nDevices in latest session:\n"
        "  sw-access-01  — L2-only (MAC table only)\n"
        "  sw-access-02  — L2-only (MAC table only)\n"
        "  sw-core-01    — L3 (MAC + ARP + hostname)\n"
        "  router-01     — Router (ARP + hostname, VRFs: vrf-prod, vrf-mgmt)\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed client data tables with test data for UI and integration-test verification."
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Truncate client data tables before seeding.",
    )
    parser.add_argument(
        "--sessions",
        type=int,
        default=3,
        metavar="N",
        help="Number of sessions to insert (default: 3).",
    )
    args = parser.parse_args()

    if args.sessions < 1:
        parser.error("--sessions must be >= 1")

    print("=== Before ===")
    _print_connection_info()
    print()

    if args.clear:
        clear_tables()

    print(f"Seeding {args.sessions} session(s)...")
    seed(args.sessions)

    print()
    print("=== After ===")
    _print_connection_info()


if __name__ == "__main__":
    main()
