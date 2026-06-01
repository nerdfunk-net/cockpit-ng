from typing import Any, Dict, List, Optional

from core.models.servers import Server
from repositories.servers.servers_repository import ServersRepository


class ServersService:
    def __init__(self, repository: ServersRepository) -> None:
        self._repo = repository

    def get_all(self) -> List[Server]:
        return self._repo.get_all()

    def get_by_id(self, server_id: int) -> Optional[Server]:
        return self._repo.get_by_id(server_id)

    def create(self, **kwargs: Any) -> Server:
        if kwargs.get('is_virtual') is None:
            facts = kwargs.get('ansible_facts') or {}
            kwargs['is_virtual'] = facts.get('ansible_virtualization_role') == 'guest'
        return self._repo.create(**kwargs)

    def update(self, server_id: int, **kwargs: Any) -> Optional[Server]:
        return self._repo.update(server_id, **kwargs)

    def delete(self, server_id: int) -> bool:
        return self._repo.delete(server_id)

    def get_grouped(self, group_by: str) -> Dict[str, List[Server]]:
        """Return servers bucketed by the value of *group_by* field."""
        servers = self._repo.get_all()
        groups: Dict[str, List[Server]] = {}
        for server in servers:
            key = getattr(server, group_by, None) or "Uncategorized"
            groups.setdefault(key, []).append(server)
        return dict(sorted(groups.items()))
