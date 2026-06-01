from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, load_only

from core.models.servers import Server
from repositories.base import BaseRepository

_SUMMARY_COLUMNS = (
    Server.id,
    Server.hostname,
    Server.location,
    Server.cluster,
    Server.distribution_release,
    Server.distribution_version,
    Server.contact,
    Server.is_virtual,
)


class ServersRepository(BaseRepository[Server]):
    def __init__(self) -> None:
        super().__init__(Server)

    def count_all(self, db: Optional[Session] = None) -> int:
        with self._db_session(db) as session:
            return int(session.query(func.count(Server.id)).scalar() or 0)

    def list_summaries(self, search: Optional[str] = None) -> List[Server]:
        """Return servers without loading ansible_facts or other large columns."""
        with self._db_session() as session:
            query = session.query(Server).options(load_only(*_SUMMARY_COLUMNS))
            if search:
                escaped = (
                    search.replace("\\", "\\\\")
                    .replace("%", "\\%")
                    .replace("_", "\\_")
                )
                query = query.filter(
                    Server.hostname.ilike(f"%{escaped}%", escape="\\")
                )
            return query.order_by(Server.hostname.asc()).all()
