import hashlib
import json
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from core.models.servers import Server, ServerFactsHistory
from repositories.servers.server_facts_history_repository import (
    ServerFactsHistoryRepository,
)
from repositories.servers.servers_repository import ServersRepository

if TYPE_CHECKING:
    from models.servers import CreateServerRequest, UpdateServerRequest

_ALLOWED_GROUP_BY = frozenset(
    {"location", "distribution_release", "distribution_version", "contact"}
)


def _hash_facts(facts: Dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(facts, sort_keys=True).encode()).hexdigest()


class ServersService:
    def __init__(
        self,
        repository: ServersRepository,
        history_repository: ServerFactsHistoryRepository,
    ) -> None:
        self._repo = repository
        self._history_repo = history_repository

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
                content_hash=_hash_facts(facts),
            )
        return server

    def update(self, server_id: int, data: "UpdateServerRequest") -> Optional[Server]:
        fields = data.model_dump(exclude_unset=True)

        should_record_history = False
        new_facts = fields.get("ansible_facts")
        if "ansible_facts" in fields and new_facts is not None:
            current = self._repo.get_by_id(server_id)
            current_facts = current.ansible_facts if current else None
            current_hash = _hash_facts(current_facts) if current_facts else None
            should_record_history = _hash_facts(new_facts) != current_hash

        updated = self._repo.update(server_id, **fields)
        if updated is not None and should_record_history:
            self._history_repo.create(
                server_id=server_id,
                ansible_facts=new_facts,
                content_hash=_hash_facts(new_facts),
            )
        return updated

    def get_facts_history(self, server_id: int) -> List[ServerFactsHistory]:
        return self._history_repo.get_by_server_id(server_id)

    def get_facts_history_entry(
        self, server_id: int, history_id: int
    ) -> Optional[ServerFactsHistory]:
        return self._history_repo.get_by_id_scoped(server_id, history_id)

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
