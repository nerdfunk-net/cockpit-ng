from core.models.servers import Server
from repositories.base import BaseRepository


class ServersRepository(BaseRepository[Server]):
    def __init__(self) -> None:
        super().__init__(Server)
