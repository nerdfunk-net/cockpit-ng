import logging
from typing import Dict, List

from services.checkmk.exceptions import CheckMKAPIError

logger = logging.getLogger(__name__)


class _TagGroupsMixin:
    def get_all_host_tag_groups(self) -> Dict:
        response = self._make_request(
            "GET", "domain-types/host_tag_group/collections/all"
        )
        return self._handle_response(response)

    def get_host_tag_group(self, name: str) -> Dict:
        response = self._make_request("GET", f"objects/host_tag_group/{name}")
        return self._handle_response(response)

    def create_host_tag_group(
        self, id: str, title: str, tags: List[Dict], topic: str = None, help: str = None
    ) -> Dict:
        json_data = {"id": id, "title": title, "tags": tags}
        if topic is not None:
            json_data["topic"] = topic
        if help is not None:
            json_data["help"] = help

        response = self._make_request(
            "POST", "domain-types/host_tag_group/collections/all", json_data=json_data
        )
        return self._handle_response(response)

    def update_host_tag_group(
        self,
        name: str,
        title: str = None,
        tags: List[Dict] = None,
        topic: str = None,
        help: str = None,
        repair: bool = False,
        etag: str = None,
    ) -> Dict:
        if etag is None:
            etag = self.get_host_tag_group_etag(name)

        json_data = {"repair": repair}
        if title is not None:
            json_data["title"] = title
        if tags is not None:
            json_data["tags"] = tags
        if topic is not None:
            json_data["topic"] = topic
        if help is not None:
            json_data["help"] = help

        response = self._make_request(
            "PUT", f"objects/host_tag_group/{name}", json_data=json_data, etag=etag
        )
        return self._handle_response(response)

    def delete_host_tag_group(
        self, name: str, repair: bool = False, mode: str = None
    ) -> bool:
        params = {"repair": repair}
        if mode is not None:
            params["mode"] = mode

        response = self._make_request(
            "DELETE", f"objects/host_tag_group/{name}", params=params
        )
        self._handle_response(response)
        return True

    def get_host_tag_group_etag(self, name: str) -> str:
        response = self._make_request("GET", f"objects/host_tag_group/{name}")

        if response.status_code == 200:
            return response.headers.get("ETag", "*")
        else:
            raise CheckMKAPIError(f"Failed to get ETag for host tag group {name}")
