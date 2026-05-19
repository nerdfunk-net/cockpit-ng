"""Business facade for collected client data (read paths used by API)."""

from __future__ import annotations

from typing import List, Optional, Tuple

from repositories.client_data.client_data_repository import ClientDataRepository


class ClientDataService:
    """Delegates read queries to ClientDataRepository."""

    def __init__(self, repository: ClientDataRepository | None = None) -> None:
        self._repo = repository or ClientDataRepository()

    def get_device_names(self) -> List[str]:
        return self._repo.get_device_names()

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
        return self._repo.get_client_data(
            device_name=device_name,
            ip_address=ip_address,
            mac_address=mac_address,
            port=port,
            vlan=vlan,
            hostname=hostname,
            page=page,
            page_size=page_size,
        )

    def get_client_history(
        self,
        ip_address: Optional[str] = None,
        mac_address: Optional[str] = None,
        hostname: Optional[str] = None,
    ) -> dict:
        return self._repo.get_client_history(
            ip_address=ip_address,
            mac_address=mac_address,
            hostname=hostname,
        )
