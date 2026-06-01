from typing import TYPE_CHECKING, Dict, List, Optional

from core.models.servers import Server
from repositories.servers.servers_repository import ServersRepository

if TYPE_CHECKING:
    from models.servers import CreateServerRequest, UpdateServerRequest

_ALLOWED_GROUP_BY = frozenset(
    {"location", "distribution_release", "distribution_version", "contact"}
)


class ServersService:
    def __init__(self, repository: ServersRepository) -> None:
        self._repo = repository

    def get_all(self) -> List[Server]:
        return self._repo.get_all()

    def get_by_id(self, server_id: int) -> Optional[Server]:
        return self._repo.get_by_id(server_id)

    def create(self, data: "CreateServerRequest") -> Server:
        fields = data.model_dump()
        if fields.get("is_virtual") is None:
            facts = fields.get("ansible_facts") or {}
            fields["is_virtual"] = facts.get("ansible_virtualization_role") == "guest"
        return self._repo.create(**fields)

    def update(self, server_id: int, data: "UpdateServerRequest") -> Optional[Server]:
        fields = data.model_dump(exclude_unset=True)
        return self._repo.update(server_id, **fields)

    def delete(self, server_id: int) -> bool:
        return self._repo.delete(server_id)

    def get_grouped(self, group_by: str) -> Dict[str, List[Server]]:
        if group_by not in _ALLOWED_GROUP_BY:
            raise ValueError(f"group_by must be one of {sorted(_ALLOWED_GROUP_BY)}")
        servers = self._repo.get_all()
        groups: Dict[str, List[Server]] = {}
        for server in servers:
            raw = getattr(server, group_by, None)
            if isinstance(raw, dict):
                key = raw.get("name") or "Uncategorized"
            else:
                key = str(raw) if raw is not None else "Uncategorized"
            groups.setdefault(key, []).append(server)
        return dict(sorted(groups.items()))
