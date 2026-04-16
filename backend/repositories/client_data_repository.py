"""
Repository for client data collected by the get_client_data job type.

Provides bulk insert and query operations for the three client data tables:
  - client_ip_addresses  (ARP table entries)
  - client_mac_addresses (MAC address table entries)
  - client_hostnames     (DNS-resolved hostnames)
"""

import logging
from typing import List, Optional, Tuple

from sqlalchemy import text

from core.database import get_db_session
from core.models import ClientHostname, ClientIpAddress, ClientMacAddress

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Latest-session sub-query (reused across several methods).
# Unions both tables so the correct session is found even when one table is
# empty (e.g. collect_mac_address=False or collect_ip_address=False).
# ---------------------------------------------------------------------------
_LATEST_SESSION_SUBQUERY = """
    SELECT session_id
    FROM (
        SELECT session_id, MAX(collected_at) AS ts
          FROM client_mac_addresses GROUP BY session_id
        UNION ALL
        SELECT session_id, MAX(collected_at) AS ts
          FROM client_ip_addresses  GROUP BY session_id
    ) _combined_sessions
    GROUP BY session_id
    ORDER BY MAX(ts) DESC
    LIMIT 1
"""


class ClientDataRepository:
    """Bulk insert operations for the three client data tables."""

    def bulk_insert_ip_addresses(self, records: List[dict]) -> int:
        """Insert ARP table entries. Returns count inserted."""
        if not records:
            return 0
        with get_db_session() as session:
            session.bulk_insert_mappings(ClientIpAddress, records)
            session.commit()
        logger.debug("Inserted %s client IP address records", len(records))
        return len(records)

    def bulk_insert_mac_addresses(self, records: List[dict]) -> int:
        """Insert MAC address table entries. Returns count inserted."""
        if not records:
            return 0
        with get_db_session() as session:
            session.bulk_insert_mappings(ClientMacAddress, records)
            session.commit()
        logger.debug("Inserted %s client MAC address records", len(records))
        return len(records)

    def bulk_insert_hostnames(self, records: List[dict]) -> int:
        """Insert DNS-resolved hostname entries. Returns count inserted."""
        if not records:
            return 0
        with get_db_session() as session:
            session.bulk_insert_mappings(ClientHostname, records)
            session.commit()
        logger.debug("Inserted %s client hostname records", len(records))
        return len(records)

    def get_device_names(self) -> List[str]:
        """Return distinct device names from the latest collection session.

        Queries both client_mac_addresses and client_ip_addresses so that
        Layer-2-only devices (which have no ARP entries) are included.
        """
        with get_db_session() as session:
            rows = session.execute(
                text(
                    f"""
                    SELECT DISTINCT device_name
                    FROM (
                        SELECT device_name, session_id FROM client_mac_addresses
                        UNION
                        SELECT device_name, session_id
                          FROM client_ip_addresses
                         WHERE mac_address IS NOT NULL
                    ) all_devices
                    WHERE session_id = ({_LATEST_SESSION_SUBQUERY})
                    ORDER BY device_name
                    """
                )
            ).fetchall()
        return [row[0] for row in rows]

    def delete_old_sessions(self, keep: int = 5) -> None:
        """Delete rows from sessions beyond the most recent *keep* runs.

        Anchors on the union of both tables so that sessions that only
        collected MAC data (no ARP) are counted correctly.
        """
        keep_subquery = (
            f"SELECT session_id FROM ("
            f"  SELECT session_id, MAX(collected_at) AS ts"
            f"    FROM client_mac_addresses GROUP BY session_id"
            f"  UNION ALL"
            f"  SELECT session_id, MAX(collected_at) AS ts"
            f"    FROM client_ip_addresses  GROUP BY session_id"
            f") _keep_sessions GROUP BY session_id ORDER BY MAX(ts) DESC LIMIT {keep}"
        )
        with get_db_session() as session:
            session.execute(
                text(
                    f"DELETE FROM client_hostnames WHERE session_id NOT IN ({keep_subquery})"
                )
            )
            session.execute(
                text(
                    f"DELETE FROM client_mac_addresses WHERE session_id NOT IN ({keep_subquery})"
                )
            )
            session.execute(
                text(
                    f"DELETE FROM client_ip_addresses WHERE session_id NOT IN ({keep_subquery})"
                )
            )
            session.commit()
        logger.debug("Deleted client data sessions beyond the most recent %s", keep)

    def get_client_data(
        self,
        device_name: Optional[str] = None,
        ip_address: Optional[str] = None,
        mac_address: Optional[str] = None,
        port: Optional[str] = None,
        vlan: Optional[str] = None,
        hostname: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> Tuple[List[dict], int]:
        """Return correlated client data with pagination.

        Query strategy (MAC-centric, one row per MAC+device observation):

        1. mac_table_entries  — one row per (mac, device) from the MAC address
           table; provides port and VLAN.
        2. arp_entries        — one row per (mac, device) from ARP; provides
           the IP seen by *that* device.
        3. best_ip_for_mac    — single best IP per MAC across ALL devices; used
           as cross-device fallback so that Layer-2-only devices (no ARP) still
           show an IP obtained from a neighbouring L3 device.
        4. hostname_for_ip    — one hostname per IP from DNS resolution.
        5. all_device_mac_pairs — UNION of the MAC table and ARP universes; this
           is the driving set that ensures L2-only devices are visible.
        6. combined           — joins everything; ip_address is
           COALESCE(same-device ARP, cross-device ARP).

        Filters are applied on the outer combined result so ILIKE can operate on
        the computed ip_address column.  Returns (rows, total_count).
        """
        conditions = []
        params: dict = {}

        if device_name:
            conditions.append(
                "device_name ILIKE '%' || :device_name_filter || '%'"
            )
            params["device_name_filter"] = device_name

        if ip_address:
            conditions.append(
                "ip_address ILIKE '%' || :ip_address || '%'"
            )
            params["ip_address"] = ip_address

        if mac_address:
            conditions.append(
                "mac_address ILIKE '%' || :mac_address || '%'"
            )
            params["mac_address"] = mac_address

        if port:
            conditions.append("port ILIKE '%' || :port || '%'")
            params["port"] = port

        if vlan:
            conditions.append("vlan ILIKE '%' || :vlan || '%'")
            params["vlan"] = vlan

        if hostname:
            conditions.append(
                "hostname ILIKE '%' || :hostname || '%'"
            )
            params["hostname"] = hostname

        where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        cte = f"""
            WITH latest_session AS (
                {_LATEST_SESSION_SUBQUERY}
            ),
            mac_table_entries AS (
                SELECT DISTINCT ON (m.mac_address, m.device_name)
                    m.mac_address,
                    m.vlan,
                    m.port,
                    m.device_name,
                    m.session_id,
                    m.collected_at
                FROM client_mac_addresses m
                JOIN latest_session ls ON m.session_id = ls.session_id
                ORDER BY m.mac_address, m.device_name, m.collected_at DESC
            ),
            arp_entries AS (
                SELECT DISTINCT ON (i.mac_address, i.device_name)
                    i.mac_address,
                    i.ip_address,
                    i.interface,
                    i.device_name,
                    i.session_id,
                    i.collected_at
                FROM client_ip_addresses i
                JOIN latest_session ls ON i.session_id = ls.session_id
                WHERE i.mac_address IS NOT NULL
                ORDER BY i.mac_address, i.device_name, i.collected_at DESC
            ),
            best_ip_for_mac AS (
                SELECT DISTINCT ON (i.mac_address)
                    i.mac_address,
                    i.ip_address
                FROM client_ip_addresses i
                JOIN latest_session ls ON i.session_id = ls.session_id
                WHERE i.mac_address IS NOT NULL
                ORDER BY i.mac_address, i.collected_at DESC
            ),
            hostname_for_ip AS (
                SELECT DISTINCT ON (h.ip_address)
                    h.ip_address,
                    h.hostname
                FROM client_hostnames h
                JOIN latest_session ls ON h.session_id = ls.session_id
                ORDER BY h.ip_address, h.collected_at DESC
            ),
            all_device_mac_pairs AS (
                SELECT mac_address, device_name, session_id
                  FROM mac_table_entries
                UNION
                SELECT mac_address, device_name, session_id
                  FROM arp_entries
            ),
            combined AS (
                SELECT
                    p.mac_address,
                    p.device_name,
                    COALESCE(mt.port, ae.interface) AS port,
                    mt.vlan,
                    COALESCE(ae.ip_address, bim.ip_address) AS ip_address,
                    hfi.hostname,
                    p.session_id,
                    COALESCE(mt.collected_at, ae.collected_at) AS collected_at
                FROM all_device_mac_pairs p
                LEFT JOIN mac_table_entries mt
                    ON p.mac_address = mt.mac_address
                   AND p.device_name  = mt.device_name
                LEFT JOIN arp_entries ae
                    ON p.mac_address = ae.mac_address
                   AND p.device_name  = ae.device_name
                LEFT JOIN best_ip_for_mac bim
                    ON p.mac_address = bim.mac_address
                LEFT JOIN hostname_for_ip hfi
                    ON COALESCE(ae.ip_address, bim.ip_address) = hfi.ip_address
            )
        """

        count_sql = text(
            f"{cte} SELECT COUNT(*) FROM combined {where_clause}"
        )
        data_sql = text(
            f"""
            {cte}
            SELECT
                mac_address,
                port,
                vlan,
                ip_address,
                hostname,
                device_name,
                session_id,
                collected_at
            FROM combined
            {where_clause}
            ORDER BY ip_address NULLS LAST, mac_address, device_name
            LIMIT :limit OFFSET :offset
            """
        )

        offset = (page - 1) * page_size
        params["limit"] = page_size
        params["offset"] = offset

        with get_db_session() as session:
            total = session.execute(count_sql, params).scalar() or 0
            rows = session.execute(data_sql, params).fetchall()

        items = [
            {
                "mac_address": row[0],
                "port": row[1],
                "vlan": row[2],
                "ip_address": row[3],
                "hostname": row[4],
                "device_name": row[5],
                "session_id": row[6],
                "collected_at": row[7].isoformat() if row[7] else None,
            }
            for row in rows
        ]
        return items, total

    def get_client_history(
        self,
        ip_address: Optional[str] = None,
        mac_address: Optional[str] = None,
        hostname: Optional[str] = None,
    ) -> dict:
        """Return historical observations across all sessions for the given identifiers.

        Each tab queries a different source table so results are independent.
        Returns dict with keys: ip_history, mac_history, hostname_history.
        """
        result: dict = {
            "ip_history": [],
            "mac_history": [],
            "hostname_history": [],
        }

        with get_db_session() as session:
            if ip_address:
                rows = session.execute(
                    text(
                        """
                        SELECT DISTINCT ON (i.session_id, i.device_name)
                            i.ip_address,
                            i.mac_address,
                            COALESCE(m.port, i.interface) AS port,
                            m.vlan,
                            i.device_name,
                            i.collected_at
                        FROM client_ip_addresses i
                        LEFT JOIN client_mac_addresses m
                            ON m.mac_address = i.mac_address
                           AND m.device_name  = i.device_name
                           AND m.session_id   = i.session_id
                        WHERE i.ip_address = :ip_address
                        ORDER BY i.session_id, i.device_name, i.collected_at DESC
                        """
                    ),
                    {"ip_address": ip_address},
                ).fetchall()
                result["ip_history"] = sorted(
                    [
                        {
                            "ip_address": row[0],
                            "mac_address": row[1],
                            "port": row[2],
                            "vlan": row[3],
                            "device_name": row[4],
                            "collected_at": row[5].isoformat() if row[5] else None,
                        }
                        for row in rows
                    ],
                    key=lambda x: x["collected_at"] or "",
                    reverse=True,
                )

            if mac_address:
                rows = session.execute(
                    text(
                        """
                        SELECT DISTINCT ON (m.session_id, m.device_name)
                            m.mac_address,
                            m.port,
                            m.vlan,
                            m.device_name,
                            m.collected_at,
                            i.ip_address
                        FROM client_mac_addresses m
                        LEFT JOIN client_ip_addresses i
                            ON i.mac_address = m.mac_address
                           AND i.device_name  = m.device_name
                           AND i.session_id   = m.session_id
                        WHERE m.mac_address = :mac_address
                        ORDER BY m.session_id, m.device_name, m.collected_at DESC
                        """
                    ),
                    {"mac_address": mac_address},
                ).fetchall()
                result["mac_history"] = sorted(
                    [
                        {
                            "mac_address": row[0],
                            "port": row[1],
                            "vlan": row[2],
                            "device_name": row[3],
                            "collected_at": row[4].isoformat() if row[4] else None,
                            "ip_address": row[5],
                        }
                        for row in rows
                    ],
                    key=lambda x: x["collected_at"] or "",
                    reverse=True,
                )

            if hostname:
                rows = session.execute(
                    text(
                        """
                        SELECT DISTINCT ON (h.session_id, h.ip_address)
                            h.hostname,
                            h.ip_address,
                            h.device_name,
                            h.collected_at
                        FROM client_hostnames h
                        WHERE h.hostname = :hostname
                        ORDER BY h.session_id, h.ip_address, h.collected_at DESC
                        """
                    ),
                    {"hostname": hostname},
                ).fetchall()
                result["hostname_history"] = sorted(
                    [
                        {
                            "hostname": row[0],
                            "ip_address": row[1],
                            "device_name": row[2],
                            "collected_at": row[3].isoformat() if row[3] else None,
                        }
                        for row in rows
                    ],
                    key=lambda x: x["collected_at"] or "",
                    reverse=True,
                )

        return result
