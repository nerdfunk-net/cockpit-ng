from typing import List, Optional

from sqlalchemy.orm import Session, load_only

from core.models.servers import ServerOpenPortsHistory
from repositories.base import BaseRepository

_LIST_COLUMNS = (
    ServerOpenPortsHistory.id,
    ServerOpenPortsHistory.server_id,
    ServerOpenPortsHistory.recorded_at,
)


class ServerOpenPortsHistoryRepository(BaseRepository[ServerOpenPortsHistory]):
    def __init__(self) -> None:
        super().__init__(ServerOpenPortsHistory)

    def get_by_server_id(
        self, server_id: int, db: Optional[Session] = None
    ) -> List[ServerOpenPortsHistory]:
        """Return history entries without the open_ports blob, newest first."""
        with self._db_session(db) as session:
            return (
                session.query(ServerOpenPortsHistory)
                .options(load_only(*_LIST_COLUMNS))
                .filter(ServerOpenPortsHistory.server_id == server_id)
                .order_by(ServerOpenPortsHistory.recorded_at.desc())
                .all()
            )

    def get_by_id_scoped(
        self, server_id: int, history_id: int, db: Optional[Session] = None
    ) -> Optional[ServerOpenPortsHistory]:
        """Return a single history entry, scoped to the owning server."""
        with self._db_session(db) as session:
            return (
                session.query(ServerOpenPortsHistory)
                .filter(
                    ServerOpenPortsHistory.id == history_id,
                    ServerOpenPortsHistory.server_id == server_id,
                )
                .first()
            )
