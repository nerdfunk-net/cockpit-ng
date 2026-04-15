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
        """Return distinct device names from the latest collection session, sorted alphabetically."""
        with get_db_session() as session:
            rows = session.execute(
                text(
                    """
                    SELECT DISTINCT i.device_name
                    FROM client_ip_addresses i
                    JOIN (
                        SELECT session_id
                        FROM client_ip_addresses
                        GROUP BY session_id
                        ORDER BY MAX(collected_at) DESC
                        LIMIT 1
                    ) ls ON i.session_id = ls.session_id
                    ORDER BY i.device_name
                    """
                )
            ).fetchall()
        return [row[0] for row in rows]

    def delete_old_sessions(self, keep: int = 5) -> None:
        """Delete rows from sessions beyond the most recent *keep* runs.

        Runs after a successful collection to prevent unbounded table growth.
        Old session data is preserved up to *keep* runs for audit purposes.
        """
        keep_subquery = (
            "SELECT session_id FROM client_ip_addresses "
            "GROUP BY session_id ORDER BY MAX(collected_at) DESC "
            f"LIMIT {keep}"
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

        Joins client_ip_addresses → client_mac_addresses (via mac+session)
        and client_ip_addresses → client_hostnames (via ip+session).
        Applies ILIKE filters on each column. Returns (rows, total_count).
        """
        conditions = []
        params: dict = {}

        if device_name:
            conditions.append("i.device_name = :device_name")
            params["device_name"] = device_name

        if ip_address:
            conditions.append("i.ip_address ILIKE :ip_address")
            params["ip_address"] = f"%{ip_address}%"

        if mac_address:
            conditions.append(
                "(i.mac_address ILIKE :mac_address OR m.mac_address ILIKE :mac_address)"
            )
            params["mac_address"] = f"%{mac_address}%"

        if port:
            conditions.append("m.port ILIKE :port")
            params["port"] = f"%{port}%"

        if vlan:
            conditions.append("m.vlan ILIKE :vlan")
            params["vlan"] = f"%{vlan}%"

        if hostname:
            conditions.append("h.hostname ILIKE :hostname")
            params["hostname"] = f"%{hostname}%"

        where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        cte = """
            WITH latest_session AS (
                SELECT session_id
                FROM client_ip_addresses
                GROUP BY session_id
                ORDER BY MAX(collected_at) DESC
                LIMIT 1
            )
        """

        base_query = f"""
            FROM client_ip_addresses i
            JOIN latest_session ls ON i.session_id = ls.session_id
            LEFT JOIN client_mac_addresses m
                ON i.mac_address = m.mac_address AND i.session_id = m.session_id
            LEFT JOIN client_hostnames h
                ON i.ip_address = h.ip_address AND i.session_id = h.session_id
            {where_clause}
        """

        count_sql = text(f"{cte} SELECT COUNT(*) {base_query}")
        data_sql = text(
            f"""
            {cte}
            SELECT
                i.ip_address,
                COALESCE(i.mac_address, m.mac_address) AS mac_address,
                m.port,
                m.vlan,
                h.hostname,
                i.device_name,
                i.session_id,
                i.collected_at
            {base_query}
            ORDER BY i.ip_address
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
                "ip_address": row[0],
                "mac_address": row[1],
                "port": row[2],
                "vlan": row[3],
                "hostname": row[4],
                "device_name": row[5],
                "session_id": row[6],
                "collected_at": row[7].isoformat() if row[7] else None,
            }
            for row in rows
        ]
        return items, total
