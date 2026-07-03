import hashlib
import json
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from core.models.servers import Server, ServerFactsHistory, ServerOpenPortsHistory
from repositories.servers.server_facts_history_repository import (
    ServerFactsHistoryRepository,
)
from repositories.servers.server_open_ports_history_repository import (
    ServerOpenPortsHistoryRepository,
)
from repositories.servers.servers_repository import ServersRepository

if TYPE_CHECKING:
    from models.servers import CreateServerRequest, UpdateServerRequest

_ALLOWED_GROUP_BY = frozenset(
    {"location", "distribution_release", "distribution_version", "contact"}
)


def _hash_json(data: Dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


class ServersService:
    def __init__(
        self,
        repository: ServersRepository,
        history_repository: ServerFactsHistoryRepository,
        open_ports_history_repository: ServerOpenPortsHistoryRepository,
    ) -> None:
        self._repo = repository
        self._history_repo = history_repository
        self._open_ports_history_repo = open_ports_history_repository

    def get_all(self) -> List[Server]:
        return self._repo.get_all()

    def list_summaries(self, search: Optional[str] = None) -> List[Server]:
        return self._repo.list_summaries(search=search)

    def count_all(self) -> int:
        return self._repo.count_all()

    def get_by_id(self, server_id: int) -> Optional[Server]:
        return self._repo.get_by_id(server_id)

    def get_by_hostname(self, hostname: str) -> Optional[Server]:
        matches = self._repo.filter(hostname=hostname)
        return matches[0] if matches else None

    def create(self, data: "CreateServerRequest") -> Server:
        fields = data.model_dump()
        if fields.get("is_virtual") is None:
            facts = fields.get("ansible_facts") or {}
            fields["is_virtual"] = facts.get("ansible_virtualization_role") == "guest"
        server = self._repo.create(**fields)
        facts = fields.get("ansible_facts")
        if facts:
            self._history_repo.create(
                server_id=server.id,
                ansible_facts=facts,
                content_hash=_hash_json(facts),
            )
        open_ports = fields.get("open_ports")
        if open_ports:
            self._open_ports_history_repo.create(
                server_id=server.id,
                open_ports=open_ports,
                content_hash=_hash_json(open_ports),
            )
        return server

    def update(self, server_id: int, data: "UpdateServerRequest") -> Optional[Server]:
        fields = data.model_dump(exclude_unset=True)

        new_facts = fields.get("ansible_facts")
        new_open_ports = fields.get("open_ports")
        current = (
            self._repo.get_by_id(server_id)
            if ("ansible_facts" in fields and new_facts is not None)
            or ("open_ports" in fields and new_open_ports is not None)
            else None
        )

        should_record_history = False
        if "ansible_facts" in fields and new_facts is not None:
            current_facts = current.ansible_facts if current else None
            current_hash = _hash_json(current_facts) if current_facts else None
            should_record_history = _hash_json(new_facts) != current_hash

        should_record_ports_history = False
        if "open_ports" in fields and new_open_ports is not None:
            current_ports = current.open_ports if current else None
            current_ports_hash = _hash_json(current_ports) if current_ports else None
            should_record_ports_history = (
                _hash_json(new_open_ports) != current_ports_hash
            )

        updated = self._repo.update(server_id, **fields)
        if updated is not None and should_record_history:
            self._history_repo.create(
                server_id=server_id,
                ansible_facts=new_facts,
                content_hash=_hash_json(new_facts),
            )
        if updated is not None and should_record_ports_history:
            self._open_ports_history_repo.create(
                server_id=server_id,
                open_ports=new_open_ports,
                content_hash=_hash_json(new_open_ports),
            )
        return updated

    def get_facts_history(self, server_id: int) -> List[ServerFactsHistory]:
        return self._history_repo.get_by_server_id(server_id)

    def get_facts_history_entry(
        self, server_id: int, history_id: int
    ) -> Optional[ServerFactsHistory]:
        return self._history_repo.get_by_id_scoped(server_id, history_id)

    def get_open_ports_history(self, server_id: int) -> List[ServerOpenPortsHistory]:
        return self._open_ports_history_repo.get_by_server_id(server_id)

    def get_open_ports_history_entry(
        self, server_id: int, history_id: int
    ) -> Optional[ServerOpenPortsHistory]:
        return self._open_ports_history_repo.get_by_id_scoped(server_id, history_id)

    def delete(self, server_id: int) -> bool:
        return self._repo.delete(server_id)

    def get_grouped(self, group_by: str) -> Dict[str, List[Server]]:
        if group_by not in _ALLOWED_GROUP_BY:
            raise ValueError(f"group_by must be one of {sorted(_ALLOWED_GROUP_BY)}")
        servers = self._repo.get_all()
        groups: Dict[str, List[Server]] = {}
        for server in servers:
            raw = getattr(server, group_by, None)
            if group_by == "contact":
                if isinstance(raw, list) and raw:
                    first = raw[0]
                    key = (
                        first.get("name")
                        if isinstance(first, dict)
                        else getattr(first, "name", None)
                    ) or "Uncategorized"
                elif isinstance(raw, dict):
                    key = raw.get("name") or "Uncategorized"
                else:
                    key = "Uncategorized"
            elif isinstance(raw, dict):
                key = raw.get("name") or "Uncategorized"
            else:
                key = str(raw) if raw is not None else "Uncategorized"
            groups.setdefault(key, []).append(server)
        return dict(sorted(groups.items()))
