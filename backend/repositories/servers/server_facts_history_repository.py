from typing import List, Optional

from sqlalchemy.orm import Session, load_only

from core.models.servers import ServerFactsHistory
from repositories.base import BaseRepository

_LIST_COLUMNS = (
    ServerFactsHistory.id,
    ServerFactsHistory.server_id,
    ServerFactsHistory.recorded_at,
)


class ServerFactsHistoryRepository(BaseRepository[ServerFactsHistory]):
    def __init__(self) -> None:
        super().__init__(ServerFactsHistory)

    def get_by_server_id(
        self, server_id: int, db: Optional[Session] = None
    ) -> List[ServerFactsHistory]:
        """Return history entries without the ansible_facts blob, newest first."""
        with self._db_session(db) as session:
            return (
                session.query(ServerFactsHistory)
                .options(load_only(*_LIST_COLUMNS))
                .filter(ServerFactsHistory.server_id == server_id)
                .order_by(ServerFactsHistory.recorded_at.desc())
                .all()
            )

    def get_by_id_scoped(
        self, server_id: int, history_id: int, db: Optional[Session] = None
    ) -> Optional[ServerFactsHistory]:
        """Return a single history entry, scoped to the owning server."""
        with self._db_session(db) as session:
            return (
                session.query(ServerFactsHistory)
                .filter(
                    ServerFactsHistory.id == history_id,
                    ServerFactsHistory.server_id == server_id,
                )
                .first()
            )
