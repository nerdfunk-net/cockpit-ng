"""
Repository for client data collected by the get_client_data job type.

Provides bulk insert and query operations for the three client data tables:
  - client_ip_addresses  (ARP table entries)
  - client_mac_addresses (MAC address table entries)
  - client_hostnames     (DNS-resolved hostnames)
"""

import logging
from typing import List, Optional, Tuple

from sqlalchemy import and_, bindparam, func, nulls_last, select, text, union, union_all

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


def _latest_session_cte():
    """CTE: single session_id for the most recent collection (MAC + IP tables)."""
    mac_sessions = (
        select(
            ClientMacAddress.session_id,
            func.max(ClientMacAddress.collected_at).label("ts"),
        ).group_by(ClientMacAddress.session_id)
    ).subquery("mac_sessions")

    ip_sessions = (
        select(
            ClientIpAddress.session_id,
            func.max(ClientIpAddress.collected_at).label("ts"),
        ).group_by(ClientIpAddress.session_id)
    ).subquery("ip_sessions")

    combined_rows = union_all(
        select(mac_sessions.c.session_id, mac_sessions.c.ts),
        select(ip_sessions.c.session_id, ip_sessions.c.ts),
    ).subquery("combined_sessions_rows")

    return (
        select(combined_rows.c.session_id)
        .group_by(combined_rows.c.session_id)
        .order_by(func.max(combined_rows.c.ts).desc())
        .limit(1)
    ).cte("latest_session")


def _client_data_combined_cte():
    """CTE pipeline matching get_client_data correlation logic (see method docstring)."""
    ls = _latest_session_cte()

    mac_table_entries = (
        select(
            ClientMacAddress.mac_address,
            ClientMacAddress.vlan,
            ClientMacAddress.port,
            ClientMacAddress.device_name,
            ClientMacAddress.session_id,
            ClientMacAddress.collected_at,
        )
        .select_from(ClientMacAddress)
        .join(ls, ClientMacAddress.session_id == ls.c.session_id)
        .distinct(ClientMacAddress.mac_address, ClientMacAddress.device_name)
        .order_by(
            ClientMacAddress.mac_address,
            ClientMacAddress.device_name,
            ClientMacAddress.collected_at.desc(),
        )
    ).cte("mac_table_entries")

    arp_entries = (
        select(
            ClientIpAddress.mac_address,
            ClientIpAddress.ip_address,
            ClientIpAddress.interface,
            ClientIpAddress.device_name,
            ClientIpAddress.session_id,
            ClientIpAddress.collected_at,
        )
        .select_from(ClientIpAddress)
        .join(ls, ClientIpAddress.session_id == ls.c.session_id)
        .where(ClientIpAddress.mac_address.isnot(None))
        .distinct(ClientIpAddress.mac_address, ClientIpAddress.device_name)
        .order_by(
            ClientIpAddress.mac_address,
            ClientIpAddress.device_name,
            ClientIpAddress.collected_at.desc(),
        )
    ).cte("arp_entries")

    best_ip_for_mac = (
        select(
            ClientIpAddress.mac_address,
            ClientIpAddress.ip_address,
        )
        .select_from(ClientIpAddress)
        .join(ls, ClientIpAddress.session_id == ls.c.session_id)
        .where(ClientIpAddress.mac_address.isnot(None))
        .distinct(ClientIpAddress.mac_address)
        .order_by(
            ClientIpAddress.mac_address,
            ClientIpAddress.collected_at.desc(),
        )
    ).cte("best_ip_for_mac")

    hostname_for_ip = (
        select(
            ClientHostname.ip_address,
            ClientHostname.hostname,
        )
        .select_from(ClientHostname)
        .join(ls, ClientHostname.session_id == ls.c.session_id)
        .distinct(ClientHostname.ip_address)
        .order_by(
            ClientHostname.ip_address,
            ClientHostname.collected_at.desc(),
        )
    ).cte("hostname_for_ip")

    pairs_from_mac = select(
        mac_table_entries.c.mac_address,
        mac_table_entries.c.device_name,
        mac_table_entries.c.session_id,
    ).select_from(mac_table_entries)

    pairs_from_arp = select(
        arp_entries.c.mac_address,
        arp_entries.c.device_name,
        arp_entries.c.session_id,
    ).select_from(arp_entries)

    all_device_mac_pairs = union(pairs_from_mac, pairs_from_arp).cte(
        "all_device_mac_pairs"
    )

    mt = mac_table_entries
    ae = arp_entries
    bim = best_ip_for_mac
    hfi = hostname_for_ip
    p = all_device_mac_pairs

    return (
        select(
            p.c.mac_address,
            p.c.device_name,
            func.coalesce(mt.c.port, ae.c.interface).label("port"),
            mt.c.vlan,
            func.coalesce(ae.c.ip_address, bim.c.ip_address).label("ip_address"),
            hfi.c.hostname,
            p.c.session_id,
            func.coalesce(mt.c.collected_at, ae.c.collected_at).label("collected_at"),
        )
        .select_from(p)
        .outerjoin(
            mt,
            (p.c.mac_address == mt.c.mac_address)
            & (p.c.device_name == mt.c.device_name),
        )
        .outerjoin(
            ae,
            (p.c.mac_address == ae.c.mac_address)
            & (p.c.device_name == ae.c.device_name),
        )
        .outerjoin(bim, p.c.mac_address == bim.c.mac_address)
        .outerjoin(
            hfi,
            func.coalesce(ae.c.ip_address, bim.c.ip_address) == hfi.c.ip_address,
        )
    ).cte("combined")


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
        combined = _client_data_combined_cte()
        conditions = []
        params: dict = {}

        if device_name:
            conditions.append(
                combined.c.device_name.ilike(
                    func.concat("%", bindparam("device_name_filter"), "%")
                )
            )
            params["device_name_filter"] = device_name

        if ip_address:
            conditions.append(
                combined.c.ip_address.ilike(
                    func.concat("%", bindparam("ip_address"), "%")
                )
            )
            params["ip_address"] = ip_address

        if mac_address:
            conditions.append(
                combined.c.mac_address.ilike(
                    func.concat("%", bindparam("mac_address"), "%")
                )
            )
            params["mac_address"] = mac_address

        if port:
            conditions.append(
                combined.c.port.ilike(func.concat("%", bindparam("port"), "%"))
            )
            params["port"] = port

        if vlan:
            conditions.append(
                combined.c.vlan.ilike(func.concat("%", bindparam("vlan"), "%"))
            )
            params["vlan"] = vlan

        if hostname:
            conditions.append(
                combined.c.hostname.ilike(
                    func.concat("%", bindparam("hostname"), "%")
                )
            )
            params["hostname"] = hostname

        where_clause = and_(*conditions) if conditions else None

        count_stmt = select(func.count()).select_from(combined)
        if where_clause is not None:
            count_stmt = count_stmt.where(where_clause)

        offset = (page - 1) * page_size
        data_stmt = select(
            combined.c.mac_address,
            combined.c.port,
            combined.c.vlan,
            combined.c.ip_address,
            combined.c.hostname,
            combined.c.device_name,
            combined.c.session_id,
            combined.c.collected_at,
        ).select_from(combined)
        if where_clause is not None:
            data_stmt = data_stmt.where(where_clause)
        data_stmt = data_stmt.order_by(
            nulls_last(combined.c.ip_address.asc()),
            combined.c.mac_address,
            combined.c.device_name,
        ).limit(page_size).offset(offset)

        with get_db_session() as session:
            total = session.execute(count_stmt, params).scalar() or 0
            rows = session.execute(data_stmt, params).fetchall()

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
