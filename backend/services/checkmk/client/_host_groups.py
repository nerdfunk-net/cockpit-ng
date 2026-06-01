import logging
from typing import Dict, List

from services.checkmk.exceptions import CheckMKAPIError

logger = logging.getLogger(__name__)


class _HostGroupsMixin:
    def get_host_groups(self) -> Dict:
        response = self._make_request(
            "GET", "domain-types/host_group_config/collections/all"
        )
        return self._handle_response(response)

    def get_host_group(self, group_name: str) -> Dict:
        response = self._make_request("GET", f"objects/host_group_config/{group_name}")
        return self._handle_response(response)

    def create_host_group(self, name: str, alias: str = None) -> Dict:
        json_data = {"name": name}
        if alias:
            json_data["alias"] = alias

        response = self._make_request(
            "POST",
            "domain-types/host_group_config/collections/all",
            json_data=json_data,
        )
        return self._handle_response(response)

    def update_host_group(self, name: str, alias: str = None, etag: str = None) -> Dict:
        if etag is None:
            etag = self.get_host_group_etag(name)

        json_data = {}
        if alias is not None:
            json_data["alias"] = alias

        response = self._make_request(
            "PUT", f"objects/host_group_config/{name}", json_data=json_data, etag=etag
        )
        return self._handle_response(response)

    def delete_host_group(self, name: str) -> bool:
        response = self._make_request("DELETE", f"objects/host_group_config/{name}")
        self._handle_response(response)
        return True

    def bulk_update_host_groups(self, entries: List[Dict]) -> Dict:
        json_data = {"entries": entries}

        response = self._make_request(
            "PUT",
            "domain-types/host_group_config/actions/bulk-update/invoke",
            json_data=json_data,
        )
        return self._handle_response(response)

    def bulk_delete_host_groups(self, entries: List[str]) -> Dict:
        json_data = {"entries": entries}

        response = self._make_request(
            "DELETE",
            "domain-types/host_group_config/actions/bulk-delete/invoke",
            json_data=json_data,
        )
        return self._handle_response(response)

    def get_host_group_etag(self, name: str) -> str:
        response = self._make_request("GET", f"objects/host_group_config/{name}")

        if response.status_code == 200:
            return response.headers.get("ETag", "*")
        else:
            raise CheckMKAPIError(f"Failed to get ETag for host group {name}")
