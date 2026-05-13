"""PostgreSQL integration tests for ``ClientDataRepository``.

These exercises ``DISTINCT ON``, latest-session resolution, and bulk deletes
that SQLite cannot emulate. Skipped unless ``TEST_DATABASE_URL`` is set.

Run::

    export TEST_DATABASE_URL=postgresql+psycopg2://user:pass@127.0.0.1:5432/db
    pytest tests/integration/repositories/test_client_data_repository_pg.py -v --no-cov
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import text

from repositories.client_data_repository import ClientDataRepository

pytestmark = pytest.mark.postgres

T0 = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
T1 = datetime(2024, 1, 2, 12, 0, 0, tzinfo=timezone.utc)
T2 = datetime(2024, 1, 3, 12, 0, 0, tzinfo=timezone.utc)


def _sid() -> str:
    return str(uuid.uuid4())


@pytest.mark.integration
class TestGetDeviceNamesPg:
    def test_includes_l2_only_device_from_latest_session(
        self, client_data_repository_pg: ClientDataRepository
    ) -> None:
        """Latest session is chosen by max(collected_at) across MAC+IP tables."""
        s_old = _sid()
        s_new = _sid()
        repo = client_data_repository_pg

        repo.bulk_insert_mac_addresses(
            [
                {
                    "session_id": s_old,
                    "mac_address": "aaaa.bbbb.cc01",
                    "vlan": "10",
                    "port": "Gi1/0/1",
                    "device_name": "old-only",
                    "device_ip": "10.0.0.1",
                    "collected_at": T0,
                }
            ]
        )
        repo.bulk_insert_mac_addresses(
            [
                {
                    "session_id": s_new,
                    "mac_address": "aaaa.bbbb.cc02",
                    "vlan": "20",
                    "port": "Gi1/0/2",
                    "device_name": "l2-only-sw",
                    "device_ip": "10.0.0.2",
                    "collected_at": T2,
                },
                {
                    "session_id": s_new,
                    "mac_address": "aaaa.bbbb.cc03",
                    "vlan": "20",
                    "port": "Gi1/0/3",
                    "device_name": "l3-sw",
                    "device_ip": "10.0.0.3",
                    "collected_at": T2,
                },
            ]
        )
        repo.bulk_insert_ip_addresses(
            [
                {
                    "session_id": s_new,
                    "ip_address": "192.0.2.10",
                    "mac_address": "aaaa.bbbb.cc03",
                    "interface": "Vlan20",
                    "device_name": "l3-sw",
                    "device_ip": "10.0.0.3",
                    "collected_at": T2,
                }
            ]
        )

        names = repo.get_device_names()
        assert names == ["l2-only-sw", "l3-sw"]


@pytest.mark.integration
class TestDeleteOldSessionsPg:
    def test_keeps_newest_sessions_across_mac_and_ip(
        self,
        client_data_repository_pg: ClientDataRepository,
        postgres_engine_client_data,
    ) -> None:
        s_a, s_b, s_c = _sid(), _sid(), _sid()
        repo = client_data_repository_pg

        for sid, ts in ((s_a, T0), (s_b, T1), (s_c, T2)):
            repo.bulk_insert_mac_addresses(
                [
                    {
                        "session_id": sid,
                        "mac_address": "aaaa.bbbb.cc10",
                        "vlan": "1",
                        "port": "Gi0/1",
                        "device_name": "sw",
                        "device_ip": None,
                        "collected_at": ts,
                    }
                ]
            )
            repo.bulk_insert_ip_addresses(
                [
                    {
                        "session_id": sid,
                        "ip_address": "192.0.2.1",
                        "mac_address": "aaaa.bbbb.cc10",
                        "interface": "Vlan1",
                        "device_name": "sw",
                        "device_ip": None,
                        "collected_at": ts,
                    }
                ]
            )
            repo.bulk_insert_hostnames(
                [
                    {
                        "session_id": sid,
                        "ip_address": "192.0.2.1",
                        "hostname": f"h-{sid[:8]}",
                        "device_name": "sw",
                        "device_ip": None,
                        "collected_at": ts,
                    }
                ]
            )

        repo.delete_old_sessions(keep=2)

        with postgres_engine_client_data.connect() as conn:
            left_a = conn.execute(
                text(
                    "SELECT COUNT(*) FROM client_mac_addresses WHERE session_id = :sid"
                ),
                {"sid": s_a},
            ).scalar()
            left_b = conn.execute(
                text(
                    "SELECT COUNT(*) FROM client_mac_addresses WHERE session_id = :sid"
                ),
                {"sid": s_b},
            ).scalar()
        assert left_a == 0
        assert left_b == 1

        hist = repo.get_client_history(mac_address="aaaa.bbbb.cc10")["mac_history"]
        assert len(hist) == 2


@pytest.mark.integration
class TestGetClientHistoryPg:
    def test_ip_history_distinct_on_session_and_device(
        self, client_data_repository_pg: ClientDataRepository
    ) -> None:
        s1, s2 = _sid(), _sid()
        repo = client_data_repository_pg
        mac = "aaaa.bbbb.cc20"

        repo.bulk_insert_ip_addresses(
            [
                {
                    "session_id": s1,
                    "ip_address": "192.0.2.50",
                    "mac_address": mac,
                    "interface": "Gi1",
                    "device_name": "edge",
                    "device_ip": None,
                    "collected_at": T0,
                },
                {
                    "session_id": s2,
                    "ip_address": "192.0.2.50",
                    "mac_address": mac,
                    "interface": "Gi2",
                    "device_name": "edge",
                    "device_ip": None,
                    "collected_at": T2,
                },
            ]
        )
        repo.bulk_insert_mac_addresses(
            [
                {
                    "session_id": s1,
                    "mac_address": mac,
                    "vlan": "5",
                    "port": "p1",
                    "device_name": "edge",
                    "device_ip": None,
                    "collected_at": T0,
                },
                {
                    "session_id": s2,
                    "mac_address": mac,
                    "vlan": "6",
                    "port": "p2",
                    "device_name": "edge",
                    "device_ip": None,
                    "collected_at": T2,
                },
            ]
        )

        hist = repo.get_client_history(ip_address="192.0.2.50")["ip_history"]
        assert len(hist) == 2
        assert {row["port"] for row in hist} == {"p1", "p2"}

    def test_mac_history_includes_ip_from_same_session(
        self, client_data_repository_pg: ClientDataRepository
    ) -> None:
        sid = _sid()
        mac = "aaaa.bbbb.cc30"
        repo = client_data_repository_pg

        repo.bulk_insert_mac_addresses(
            [
                {
                    "session_id": sid,
                    "mac_address": mac,
                    "vlan": "9",
                    "port": "Eth1",
                    "device_name": "tor",
                    "device_ip": None,
                    "collected_at": T1,
                }
            ]
        )
        repo.bulk_insert_ip_addresses(
            [
                {
                    "session_id": sid,
                    "ip_address": "192.0.2.99",
                    "mac_address": mac,
                    "interface": "Vlan9",
                    "device_name": "tor",
                    "device_ip": None,
                    "collected_at": T1,
                }
            ]
        )

        hist = repo.get_client_history(mac_address=mac)["mac_history"]
        assert len(hist) == 1
        assert hist[0]["ip_address"] == "192.0.2.99"

    def test_hostname_history(
        self, client_data_repository_pg: ClientDataRepository
    ) -> None:
        s1, s2 = _sid(), _sid()
        repo = client_data_repository_pg

        repo.bulk_insert_hostnames(
            [
                {
                    "session_id": s1,
                    "ip_address": "192.0.2.77",
                    "hostname": "host.example",
                    "device_name": "d1",
                    "device_ip": None,
                    "collected_at": T0,
                },
                {
                    "session_id": s2,
                    "ip_address": "192.0.2.88",
                    "hostname": "host.example",
                    "device_name": "d2",
                    "device_ip": None,
                    "collected_at": T2,
                },
            ]
        )

        hist = repo.get_client_history(hostname="host.example")["hostname_history"]
        assert len(hist) == 2
        ips = {row["ip_address"] for row in hist}
        assert ips == {"192.0.2.77", "192.0.2.88"}


@pytest.mark.integration
class TestDeleteRecordsOlderThanPg:
    def test_removes_rows_older_than_cutoff(
        self,
        client_data_repository_pg: ClientDataRepository,
        postgres_engine_client_data,
    ) -> None:
        sid = _sid()
        repo = client_data_repository_pg
        repo.bulk_insert_mac_addresses(
            [
                {
                    "session_id": sid,
                    "mac_address": "aaaa.bbbb.dd01",
                    "vlan": "1",
                    "port": "p1",
                    "device_name": "sw",
                    "device_ip": None,
                    "collected_at": T0,
                },
                {
                    "session_id": sid,
                    "mac_address": "aaaa.bbbb.dd02",
                    "vlan": "1",
                    "port": "p2",
                    "device_name": "sw",
                    "device_ip": None,
                    "collected_at": T2,
                },
            ]
        )

        cutoff = datetime(2024, 1, 2, 18, 0, 0, tzinfo=timezone.utc)
        result = repo.delete_records_older_than(cutoff)
        assert result.mac == 1

        with postgres_engine_client_data.connect() as conn:
            n = conn.execute(
                text("SELECT COUNT(*) FROM client_mac_addresses")
            ).scalar()
        assert n == 1
